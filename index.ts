import { config } from "dotenv";
config();

import * as fs from "fs";
import * as z from "zod";
import clerkClient from "@clerk/clerk-sdk-node";
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

const userSchema = z.object({
  id: z.string(),
  encrypted_email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  password: z.string().optional(),
  passwordHasher: z
    .enum([
      "argon2i",
      "argon2id",
      "bcrypt",
      "md5",
      "pbkdf2_sha256",
      "pbkdf2_sha256_django",
      "pbkdf2_sha1",
      "scrypt_firebase",
    ])
    .optional(),
});

type User = z.infer<typeof userSchema>;

const createUser = (userData: User) =>
  userData.password
    ? clerkClient.users.createUser({
      externalId: userData.id,
      emailAddress: [userData.encrypted_email],
      firstName: userData.firstName,
      lastName: userData.lastName,
      passwordDigest: userData.password,
      passwordHasher: userData.passwordHasher,
    })
    : clerkClient.users.createUser({
      externalId: userData.id,
      emailAddress: [userData.encrypted_email],
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
    const parsedUserData = userSchema.safeParse(userData);
    if (!parsedUserData.success) {
      throw parsedUserData.error;
    }
    await createUser(parsedUserData.data);

    migrated++;
  } catch (error) {
    if (error.status === 422) {
      appendLog({ userId: userData.id, ...error });
      alreadyExists++;
      return;
    }

    // Keep cooldown in case rate limit is reached as a fallback if the thread blocking fails
    if (error.status === 429) {
      spinner.text = `${txt} - rate limit reached, waiting for ${RETRY_DELAY} ms`;
      await rateLimitCooldown();
      spinner.text = txt;
      return processUserToClerk(userData, spinner);
    }

    appendLog({ userId: userData.id, ...error });
  }
}

async function cooldown() {
  await new Promise((r) => setTimeout(r, DELAY));
}

async function rateLimitCooldown() {
  await new Promise((r) => setTimeout(r, RETRY_DELAY));
}

async function main() {
  console.log(`Clerk User Migration Utility`);

  const inputFileName = process.argv[2] ?? "users.json";

  console.log(`Fetching users from ${inputFileName}`);

  const parsedUserData: any[] = JSON.parse(
    fs.readFileSync(inputFileName, "utf-8")
  );
  const offsetUsers = parsedUserData.slice(OFFSET);
  console.log(
    `users.json found and parsed, attempting migration with an offset of ${OFFSET}`
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

main().then(() => {
  console.log(`${migrated} users migrated`);
  console.log(`${alreadyExists} users failed to upload`);
});
