import { expect, test } from "vitest";
import { loadUsersFromFile } from "./functions";

// test("loadUsersFromFile CSV", async () => {
//   const userSupabase = await loadUsersFromFile(
//     "/samples/supabase.csv",
//     "clerk",
//   );
//
//   expect(userSupabase).toMatchInlineSnapshot(`
//     [
//       {
//         "email": "test@test.com",
//         "userId": "76b196c8-d5c4-4907-9746-ed06ef829a67",
//       },
//       {
//         "email": "test2@test2.com",
//         "userId": "926f3b49-9687-4d05-8557-2673387a1f3c",
//       },
//     ]
//   `);
// });

test("Clerk - loadUsersFromFile - JSON", async () => {
  const usersFromClerk = await loadUsersFromFile(
    "/samples/clerk.json",
    "clerk",
  );

  expect(usersFromClerk).toMatchInlineSnapshot(`
[
  {
    "backupCodesEnabled": false,
    "email": "johndoe@gmail.com",
    "firstName": "John",
    "lastName": "Doe",
    "mfaEnabled": false,
    "privateMetadata": {},
    "publicMetadata": {},
    "unsafeMetadata": {
      "username": "johndoe",
    },
    "userId": "user_2fT3OpCuU3elx0CXE3cNyStBC9u",
  },
  {
    "backupCodesEnabled": false,
    "email": "janedoe@gmail.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "mfaEnabled": false,
    "privateMetadata": {},
    "publicMetadata": {},
    "unsafeMetadata": {
      "username": "janedoe",
    },
    "userId": "user_2fTPmPJJGj6SZV1e8xN7yapuoim",
  },
]
`);
});

test("Auth.js - loadUsersFromFile - JSON", async () => {
  const usersFromAuthjs = await loadUsersFromFile(
    "/samples/authjs.json",
    "authjs",
  );

  expect(usersFromAuthjs.slice(0, 2)).toMatchInlineSnapshot(`
    [
      {
        "email": "john@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "password": "$2a$12$9HhLqMJxqBKhlZasxjlhger67GFcC4aOAtpcU.THpcSLiQve4mq6.",
        "passwordHasher": "bcrypt",
        "userId": "1",
      },
      {
        "email": "alice@example.com",
        "firstName": "Alice",
        "lastName": "Smith",
        "password": "$2a$12$9HhLqMJxqBKhlZasxjlhger67GFcC4aOAtpcU.THpcSLiQve4mq6.",
        "passwordHasher": "bcrypt",
        "userId": "2",
      },
    ]
  `);
});

test("Supabase - loadUsersFromFile - JSON", async () => {
  const usersFromSupabase = await loadUsersFromFile(
    "/samples/supabase.json",
    "supabase",
  );

  expect(usersFromSupabase).toMatchInlineSnapshot(`
    [
      {
        "email": "janedoe@clerk.dev",
        "password": "$2a$10$hg4EXrEHfcqoKhNtENsYCO5anpp/C9WCUAAAtXEqpZkdCcxL/hcGG",
        "passwordHasher": "bcrypt",
        "userId": "2971a33d-5b7c-4c11-b8fe-61b7f185f211",
      },
      {
        "email": "johndoe@clerk.dev",
        "password": "$2a$10$hg4EXrEHfcqoKhNtENsYCO5anpp/C9WCUAAAtXEqpZkdCcxL/hcGG",
        "passwordHasher": "bcrypt",
        "userId": "2971a33d-5b7c-4c11-b8fe-61b7f185f234",
      },
    ]
  `);
});

test("Auth0 - loadUsersFromFile - JSON", async () => {
  const usersFromAuth0 = await loadUsersFromFile(
    "/samples/auth0.json",
    "auth0",
  );

  expect(usersFromAuth0).toMatchInlineSnapshot(`[]`);
});
