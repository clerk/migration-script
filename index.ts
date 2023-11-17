import { config } from "dotenv";
config();

import * as fs from "fs";
import * as z from "zod";
import clerkClient from "@clerk/clerk-sdk-node";

const DELAY = process.env.DELAY;
const RETRY_DELAY = process.env.RETRY_DELAY;
const SECRET_KEY = process.env.CLERK_SECRET_KEY;
const IMPORT_TO_DEV = process.env.IMPORT_TO_DEV_INSTANCE
if (!SECRET_KEY || !IMPORT_TO_DEV || !DELAY || !RETRY_DELAY) {
  throw new Error("CLERK_SECRET_KEY is required. Please copy .env.example to .env and add your key.");
}

if (SECRET_KEY.split('_')[1] !== 'live' && IMPORT_TO_DEV === 'false') {
  throw new Error("The Clerk Secret Key provided is for a development instance. Development instances are limited to 500 users and do not share their userbase with production instances. If you want to import users to your development instance, please set 'IMPORT_TO_DEV_ISNTANCE' in your .env to 'true'.")
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

let migrated = 0;
let alreadyExists = 0;

async function processUserToClerk(userData: User) {
  try {
    await createUser(userData);

    migrated++;
  } catch (error) {
    if (error.status === 422) {
      fs.writeFileSync("./migration-log.json", JSON.stringify(error, null, 2));
      alreadyExists++;
      return;
    }

    // Keep cooldown in case rate limit is reached as a fallback if the thread blocking fails
    if (error.status === 429) {
      console.log(`Waiting for rate limit to reset`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY));

      console.log("Retrying");
      // conditional recursion
      return processUserToClerk(userData);
    }

    fs.writeFileSync("./migration-log.json", JSON.stringify(error, null, 2));
    console.error("Error creating user:", error);
  }
}

async function main() {
  console.log("Validating user data...");
  const validatedUserData = userSchema
    .array()
    .parse(JSON.parse(await fs.promises.readFile("users.json", "utf-8")));

  for (const userData of validatedUserData) {
    await new Promise((r) => setTimeout(r, DELAY ?? 1_000));
    await processUserToClerk(userData);
  }

  return validatedUserData;
}

console.log(`Clerk User Migration Utility`);

console.log(`Migrating users...`);

main().then(() => {
  console.log(`${migrated} users migrated`);
  console.log(`${alreadyExists} users already exist`);
});
