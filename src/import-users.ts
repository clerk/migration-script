import clerkClient from "@clerk/clerk-sdk-node";
import { env } from "./envs-constants";
import { User, getDateTimeStamp, userSchema } from "./functions";
import * as p from "@clack/prompts";
import { errorLogger } from "./logger";
import { cooldown } from "./utils";

// TODO: This is likely not needed anymore
// type CliArgs = {
//   key: string;
//   file: string;
//   instance: string;
//   offest?: string;
//   begin: boolean;
// };

const s = p.spinner();
let migrated = 0;

const createUser = (userData: User) =>
  userData.password
    ? clerkClient.users.createUser({
      externalId: userData.userId,
      emailAddress: [userData.email],
      firstName: userData.firstName,
      lastName: userData.lastName,
      passwordDigest: userData.password,
      passwordHasher: userData.passwordHasher,
      username: userData.username,
      // phoneNumber: [userData.phone],
      totpSecret: userData.totpSecret,
      unsafeMetadata: userData.unsafeMetadata,
      privateMetadata: userData.privateMetadata,
      publicMetadata: userData.publicMetadata,
    })
    : clerkClient.users.createUser({
      externalId: userData.userId,
      emailAddress: [userData.email],
      firstName: userData.firstName,
      lastName: userData.lastName,
      skipPasswordRequirement: true,
      username: userData.username,
      // phoneNumber: [userData.phone],
      totpSecret: userData.totpSecret,
      unsafeMetadata: userData.unsafeMetadata,
      privateMetadata: userData.privateMetadata,
      publicMetadata: userData.publicMetadata,
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
  s.message(`Migrating users: [0/${total}]`);

  for (const user of users) {
    await processUserToClerk(user, total, dateTime);
    await cooldown(env.DELAY);
  }
  s.stop();
  p.outro("Migration complete");
};
