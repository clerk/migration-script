import { config } from "dotenv";
config();

import * as fs from "fs";
import * as z from "zod";
import { clerkClient, User } from "@clerk/clerk-sdk-node";
import ora, { Ora } from "ora";

const SECRET_KEY = process.env.CLERK_SECRET_KEY;
const DELAY = parseInt(process.env.DELAY_MS ?? `1_000`);
const RETRY_DELAY = parseInt(process.env.RETRY_DELAY_MS ?? `10_000`);
const IMPORT_TO_DEV = process.env.IMPORT_TO_DEV_INSTANCE ?? "false";
const OFFSET = parseInt(process.env.OFFSET ?? `0`);

if (!SECRET_KEY) {
  throw new Error(
    "CLERK_SECRET_KEY is required. Please copy .env.example to .env and add your key."
  );
}

if (SECRET_KEY.split("_")[1] !== "live" && IMPORT_TO_DEV === "false") {
  throw new Error(
    "The Clerk Secret Key provided is for a development instance. Development instances are limited to 500 users and do not share their userbase with production instances. If you want to import users to your development instance, please set 'IMPORT_TO_DEV_INSTANCE' in your .env to 'true'."
  );
}

const now = new Date().toISOString().split(".")[0]; // YYYY-MM-DDTHH:mm:ss
function appendLog(payload: any) {
  fs.appendFileSync(
    `./migration-log-${now}.json`,
    `\n${JSON.stringify(payload, null, 2)}`
  );
}

let migrated = 0;
let alreadyExists = 0;

async function deleteUser(id: string) {
    return 
}

async function processUserToClerk(user: User, spinner: Ora) {
  const txt = spinner.text;
  try {
    // inspect the user's data
    const hasExternalId = !!user.externalId
    const hasCorrectMetadata = !!(user.publicMetadata["agreedTerms"] === false || user.publicMetadata["agreedTerms"] === true)

    if (hasExternalId) {
        // This user should exist in our database, so they may only need correction to metadata
        if (!hasCorrectMetadata) {
            await clerkClient.users.updateUserMetadata(user.id, { publicMetadata: { agreedTerms: false } })
        }
    } else {
        // This user does not exist in our database but exists in Clerk, delete them
        await clerkClient.users.deleteUser(user.id)
    }

    migrated++;
  } catch (error) {
    if (error.status === 422) {
      appendLog({ userId: user.id, ...error });
      alreadyExists++;
      return;
    }

    // Keep cooldown in case rate limit is reached as a fallback if the thread blocking fails
    if (error.status === 429) {
      spinner.text = `${txt} - rate limit reached, waiting for ${RETRY_DELAY} ms`;
      await rateLimitCooldown();
      spinner.text = txt;
      return processUserToClerk(user, spinner);
    }

    appendLog({ userId: user.id, ...error });
  }
}

async function cooldown() {
  await new Promise((r) => setTimeout(r, DELAY));
}

async function rateLimitCooldown() {
  await new Promise((r) => setTimeout(r, RETRY_DELAY));
}

async function main() {
  console.log(`Clerk User Clearing Utility`);

  console.log(`Fetching users from Clerk`);
  let offset = 0
  const limit = 500
  const response = await clerkClient.users.getUserList({ limit, orderBy: "+created_at" })
  // The API has a limit of 500 users so this will have to be paginated
  let users: User[] = response.data
  let total = response.totalCount
  let hasMoreUsers = total > users.length
  while(hasMoreUsers) {
    offset = offset + limit
    const nextBatch = await clerkClient.users.getUserList({ offset, limit, orderBy: "+created_at" })
    users.push(...nextBatch.data)
    hasMoreUsers = total > users.length
  }
  console.log(total)
  console.log(hasMoreUsers)

  let i = 0;
  const spinner = ora(`Migrating users`).start();

  for (const user of users) {
    spinner.text = `Migrating user ${i}/${users.length}, cooldown`;
    await cooldown();
    i++;
    spinner.text = `Migrating user ${i}/${users.length}`;
    await processUserToClerk(user, spinner);
  }

  spinner.succeed(`Migration complete`);
  return;
}

main().then(() => {
  console.log(`${migrated} users migrated`);
  console.log(`${alreadyExists} users failed to upload`);
});
