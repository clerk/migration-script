import clerkClient from "@clerk/clerk-sdk-node";
import { env } from "./envs-constants";
import { User, userSchema } from "./functions";
import * as p from '@clack/prompts'

type CliArgs = {
  key: string,
  file: string,
  instance: string,
  offest?: string,
  begin: boolean
}

const s = p.spinner()
let migrated = 0

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



async function processUserToClerk(userData: User, total: number) {
  try {
    const parsedUserData = userSchema.safeParse(userData);
    if (!parsedUserData.success) {
      throw parsedUserData.error;
    }
    await createUser(parsedUserData.data);
    migrated++
    s.message(`Migrating users: [${migrated}/${total}]`)

  } catch (error) {
    if (error.status === 422) {
      // appendLog({ userId: userData.userId, ...error });
      return;
    }

    // Keep cooldown in case rate limit is reached as a fallback if the thread blocking fails
    if (error.status === 429) {
      await cooldown(env.RETRY_DELAY_MS)
      return processUserToClerk(userData, total);
    }

    // appendLog({ userId: userData.userId, ...error });
  }
}



export const importUsers = async (users: User[], args: CliArgs) => {

  s.start()
  const total = users.length
  s.message(`Migration users: [0/${total}]`)

  for (const user of users) {
    await cooldown(env.DELAY)
    await processUserToClerk(user, total)
  }
  s.stop()
  p.outro('Migration complete')
}
