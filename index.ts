import { config } from "dotenv";
config();

import * as fs from "fs";
import * as z from "zod";
import clerkClient from "@clerk/clerk-sdk-node";
import ora, { Ora } from "ora";

const SECRET_KEY = process.env.CLERK_SECRET_KEY;
const DELAY = parseInt(process.env.DELAY ?? `1_000`);
const RETRY_DELAY = parseInt(process.env.RETRY_DELAY ?? `10_000`);
const IMPORT_TO_DEV = process.env.IMPORT_TO_DEV_INSTANCE ?? "false";

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
  userId: z.string(),
  email: z.string().email(),
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

async function processUserToClerk(userData: User) {
  const spinner = ora(`Migrating user ${userData.userId}`).start();
  try {
    const parsedUserData = userSchema.safeParse(userData);
    if (!parsedUserData.success) {
      throw parsedUserData.error;
    }
    await createUser(parsedUserData.data);

    migrated++;
    spinner.succeed(`Migrated user ${userData.userId}`);
  } catch (error) {
    if (error.status === 422) {
      appendLog({ userId: userData.userId, ...error });
      alreadyExists++;
      spinner.warn(`User ${userData.userId} already exists`);
      return;
    }

    // Keep cooldown in case rate limit is reached as a fallback if the thread blocking fails
    if (error.status === 429) {
      spinner.warn(`Rate limit reached`);
      const cooldownSpinner = ora(`Cooldown`).start();
      await rateLimitCooldown();
      cooldownSpinner.stop();
      // conditional recursion
      return processUserToClerk(userData);
    }

    appendLog({ userId: userData.userId, ...error });
    spinner.fail(`Failed to migrate user ${userData.userId}`);
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
  console.log(`Fetching users.json...`);

  const parsedUserData = JSON.parse(fs.readFileSync("users.json", "utf-8"));

  console.log(`users.json found and parsed, attempting migration...`);

  for (const userData of parsedUserData) {
    const spinner = ora(`Cooldown`).start();
    await cooldown();
    spinner.stop();

    await processUserToClerk(userData);
  }

  return;
}

main().then(() => {
  console.log(`${migrated} users migrated`);
  console.log(`${alreadyExists} users failed to upload`);
});
