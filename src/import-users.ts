import clerkClient from "@clerk/clerk-sdk-node";
import { env } from "./envs-constants";
import { boolean } from "zod";
import { User, userSchema } from "./functions";

type CliArgs = {
  key: string,
  file: string,
  instance: string,
  offest?: string,
  begin: boolean
}

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



async function processUserToClerk(userData: User) {
  try {
    const parsedUserData = userSchema.safeParse(userData);
    if (!parsedUserData.success) {
      throw parsedUserData.error;
    }
    await createUser(parsedUserData.data);

  } catch (error) {
    if (error.status === 422) {
      // appendLog({ userId: userData.userId, ...error });
      return;
    }

    // Keep cooldown in case rate limit is reached as a fallback if the thread blocking fails
    if (error.status === 429) {
      await cooldown(env.RETRY_DELAY_MS)
      return processUserToClerk(userData);
    }

    // appendLog({ userId: userData.userId, ...error });
  }
}



export const importUsers = async (users: User[], args: CliArgs) => {

  console.log('STARTING IMPORT')

  for (const user of users) {
    await cooldown(env.DELAY)
    await processUserToClerk(user)
  }

}
