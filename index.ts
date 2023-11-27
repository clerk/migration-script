import { config } from "dotenv";
config();

import * as fs from "fs";
import * as z from "zod";
import clerkClient from "@clerk/clerk-sdk-node";
import Listr from "listr";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const DELAY = Number(process.env.DELAY ?? 2_000);
const RATE_LIMIT_DELAY = Number(process.env.RATE_LIMIT_DELAY ?? 5_000);
const IMPORT_TO_DEV_INSTANCE = process.env.IMPORT_TO_DEV_INSTANCE ?? "false";
const BATCH = Number(process.env.BATCH ?? 10);

if (!CLERK_SECRET_KEY) {
  throw new Error(
    "CLERK_SECRET_KEY is required. Please copy .env.example to .env and add your key."
  );
}

if (
  CLERK_SECRET_KEY.split("_")[1] !== "live" &&
  IMPORT_TO_DEV_INSTANCE === "false"
) {
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

export interface User extends z.infer<typeof userSchema> {}

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

export async function processUserToClerk(userData: User) {
  try {
    const parsedUserData = userSchema.safeParse(userData);
    if (!parsedUserData.success) {
      return { error: parsedUserData.error, type: "validation" } as const;
    }

    return { data: await createUser(parsedUserData.data) } as const;
  } catch (error) {
    if (error.status === 422) {
      return { error, type: "already_exists" } as const;
    }

    if (error.status === 429) {
      return { error, type: "rate_limit" } as const;
    }

    return { error, type: "unknown" } as const;
  }
}

async function cooldown() {
  await new Promise((r) => setTimeout(r, DELAY));
}

async function main() {
  const parsedUserData: User[] = JSON.parse(
    fs.readFileSync("users.json", "utf-8")
  );

  const queue = [...parsedUserData];

  while (queue.length > 0) {
    const batchedQueue = queue.splice(0, BATCH);
    let rateLimited = false;

    const migrations = new Listr(
      batchedQueue.map((user) => ({
        title: `Migrating user ${user.userId}`,
        task: async (_, task) => {
          const result = await processUserToClerk(user);

          if (result.error) {
            if (result.type === "rate_limit") {
              task.skip(`Rate limit exceeded, will be retried later`);
              queue.push(user);
              rateLimited = true;
              return;
            }

            appendLog({ userId: user.userId, ...result.error });
            task.skip(`Failed to migrate user ${user.userId}`);
            return;
          }

          if (result.data) {
            task.title = `Migrated user ${user.userId}`;
          }

          return;
        },
      })),
      { concurrent: true }
    );

    await migrations.run();

    if (rateLimited) {
      await new Listr([
        {
          title: `Rate Limited - cooldown for ${
            RATE_LIMIT_DELAY / 1000
          } seconds...`,
          task: async () => new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY)),
        },
      ]).run();
    } else if (queue.length) {
      await new Listr([
        {
          title: `Cooldown for ${DELAY / 1000} seconds...`,
          task: cooldown,
        },
      ]).run();
    }
  }
}

main();
