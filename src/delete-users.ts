import clerkClient, { User } from "@clerk/clerk-sdk-node";
import { env } from "./envs-constants";
import * as p from "@clack/prompts";
import color from "picocolors";
import { cooldown } from "./utils";

const LIMIT = 500;
const users: User[] = [];
const s = p.spinner();
let total: number;
let count = 0;

const fetchUsers = async (offset: number) => {
  console.log("fetch users", offset, users.length);
  const res = await clerkClient.users.getUserList({ offset, limit: LIMIT });

  if (res.length > 0) {
    console.log("res length", res.length);
    for (const user of res) {
      console.log("USER:", user.firstName);
      users.push(user);
    }
  }

  if (res.length === LIMIT) {
    return fetchUsers(offset + LIMIT);
  }

  return users;
};

//
//
// async function deleteUsers(
//   userData: User,
//   total: number,
//   dateTime: string,
// ) {
//   try {
//     const parsedUserData = userSchema.safeParse(userData);
//     if (!parsedUserData.success) {
//       throw parsedUserData.error;
//     }
//     await createUser(parsedUserData.data);
//     migrated++;
//     s.message(`Migrating users: [${migrated}/${total}]`);
//   } catch (error) {
//     // Keep cooldown in case rate limit is reached as a fallback if the thread blocking fails
//     if (error.status === 429) {
//       await cooldown(env.RETRY_DELAY_MS);
//       return processUserToClerk(userData, total, dateTime);
//     }
//     // if (error.status === "form_identifier_exists") {
//     //   console.log("ERROR", error);
//     // }
//     errorLogger(
//       { userId: userData.userId, status: error.status, errors: error.errors },
//       dateTime,
//     );
//   }
// }

const deleteUsers = async (users: User[]) => {
  for (const user of users) {
    await clerkClient.users.deleteUser(user.id);
    total = total - 1;
  }
  s.message(`Migrating users: [${count}/${total}]`);
  cooldown(1000);
};

export const processUsers = async () => {
  p.intro(
    `${color.bgCyan(color.black("Clerk User Migration Utility - Deleting Users"))}`,
  );
  s.start();
  s.message("Fetching current user list");

  const users = await fetchUsers(0);
  total = users.length;

  s.message(`Deleting users: [0/${total}]`);

  deleteUsers(users);

  s.stop();
  p.outro("User deletion complete");
};

processUsers();
