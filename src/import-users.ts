import clerkClient from "@clerk/clerk-sdk-node";
import { env } from "./envs-constants";
import { User, getDateTimeStamp, userSchema } from "./functions";
import * as p from "@clack/prompts";
import { errorLogger } from "./logger";

// TODO: This is likely not needed anymore
type CliArgs = {
  key: string;
  file: string;
  instance: string;
  offest?: string;
  begin: boolean;
};

const s = p.spinner();
let migrated = 0;

async function cooldown(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

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

async function processUserToClerk(
  userData: User,
  total: number,
  dateTime: string,
) {
  try {
    const parsedUserData = userSchema.safeParse(userData);
    if (!parsedUserData.success) {
      throw parsedUserData.error;
    }
    await createUser(parsedUserData.data);
    migrated++;
    s.message(`Migrating users: [${migrated}/${total}]`);
  } catch (error) {
    // Keep cooldown in case rate limit is reached as a fallback if the thread blocking fails
    if (error.status === 429) {
      await cooldown(env.RETRY_DELAY_MS);
      return processUserToClerk(userData, total, dateTime);
    }
    // if (error.status === "form_identifier_exists") {
    //   console.log("ERROR", error);
    // }
    errorLogger(
      { userId: userData.userId, status: error.status, errors: error.errors },
      dateTime,
    );
  }
}

export const importUsers = async (users: User[]) => {
  const dateTime = getDateTimeStamp();
  s.start();
  const total = users.length;
  s.message(`Migration users: [0/${total}]`);

  for (const user of users) {
    await processUserToClerk(user, total, dateTime);
    await cooldown(env.DELAY);
  }
  s.stop();
  p.outro("Migration complete");
};
