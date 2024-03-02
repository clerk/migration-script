import { config } from "dotenv";
config();
import * as p from '@clack/prompts';
import color from 'picocolors'
import { setTimeout } from 'node:timers/promises';

import * as fs from "fs";
import * as z from "zod";
import clerkClient from "@clerk/clerk-sdk-node";
import ora, { Ora } from "ora";
import { authjsUserSchema } from "./src/validators";
import { env } from "./src/env";
import { runCLI } from "./src/cli";

if (env.CLERK_SECRET_KEY.split("_")[1] !== "live" && env.IMPORT_TO_DEV === false) {
  throw new Error(
    "The Clerk Secret Key provided is for a development instance. Development instances are limited to 500 users and do not share their userbase with production instances. If you want to import users to your development instance, please set 'IMPORT_TO_DEV_INSTANCE' in your .env to 'true'."
  );
}



type User = z.infer<typeof authjsUserSchema>;

const createUser = (userData: User) =>
  userData.password
    ? clerkClient.users.createUser({
      externalId: userData.userId,
      emailAddress: [userData.email],
      firstName: userData.firstName,
      lastName: userData.lastName,
      passwordDigest: userData.password,
      passwordHasher: userData.passwordHasher,
    })
    : clerkClient.users.createUser({
      externalId: userData.userId,
      emailAddress: [userData.email],
      firstName: userData.firstName,
      lastName: userData.lastName,
      skipPasswordRequirement: true,
    });

const now = new Date().toISOString().split(".")[0]; // YYYY-MM-DDTHH:mm:ss
function appendLog(payload: any) {
  fs.appendFileSync(
    `./migration-log-${now}.json`,
    `\n${JSON.stringify(payload, null, 2)}`
  );
}

let migrated = 0;
let alreadyExists = 0;

async function processUserToClerk(userData: User, spinner: Ora) {
  const txt = spinner.text;
  try {
    const parsedUserData = authjsUserSchema.safeParse(userData);
    if (!parsedUserData.success) {
      throw parsedUserData.error;
    }
    console.log('USER', parsedUserData.data)
    // await createUser(parsedUserData.data);

    migrated++;
  } catch (error) {
    if (error.status === 422) {
      appendLog({ userId: userData.userId, ...error });
      alreadyExists++;
      return;
    }

    // Keep cooldown in case rate limit is reached as a fallback if the thread blocking fails
    if (error.status === 429) {
      spinner.text = `${txt} - rate limit reached, waiting for ${env.RETRY_DELAY_MS} ms`;
      await rateLimitCooldown();
      spinner.text = txt;
      return processUserToClerk(userData, spinner);
    }

    appendLog({ userId: userData.userId, ...error });
  }
}

async function cooldown() {
  await new Promise((r) => setTimeout(r, env.DELAY));
}

async function rateLimitCooldown() {
  await new Promise((r) => setTimeout(r, env.RETRY_DELAY_MS));
}

async function mainOld() {
  console.log(`Clerk User Migration Utility`);

  const inputFileName = process.argv[2] ?? "users.json";

  console.log(`Fetching users from ${inputFileName}`);

  const parsedUserData: any[] = JSON.parse(
    fs.readFileSync(inputFileName, "utf-8")
  );
  const offsetUsers = parsedUserData.slice(env.DELAY);
  console.log(
    `users.json found and parsed, attempting migration with an offset of ${env.OFFSET}`
  );

  let i = 0;
  const spinner = ora(`Migrating users`).start();

  for (const userData of offsetUsers) {
    spinner.text = `Migrating user ${i}/${offsetUsers.length}, cooldown`;
    await cooldown();
    i++;
    spinner.text = `Migrating user ${i}/${offsetUsers.length}`;
    await processUserToClerk(userData, spinner);
  }

  spinner.succeed(`Migration complete`);
  return;
}



async function main() {

  const args = await runCLI()

  console.log('PARAMS', args)
}





main()
