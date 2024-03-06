import { expect, test } from "vitest";
import { loadUsersFromFile } from "./functions";

test("loadUsersFromFile CSV", async () => {
  const userClerk = await loadUsersFromFile("/samples/clerk.csv", "clerk");
  const userSupabase = await loadUsersFromFile(
    "/samples/supabase.csv",
    "clerk",
  );

  expect(userSupabase).toMatchInlineSnapshot(`
    [
      {
        "email": "test@test.com",
        "userId": "76b196c8-d5c4-4907-9746-ed06ef829a67",
      },
      {
        "email": "test2@test2.com",
        "userId": "926f3b49-9687-4d05-8557-2673387a1f3c",
      },
    ]
  `);

  expect(userClerk.slice(0, 2)).toMatchInlineSnapshot(`
    [
      {
        "email": "janedoe@clerk.dev",
        "firstName": "Jane",
        "lastName": "Doe",
        "passwordHasher": "bcrypt",
        "userId": "user_2YDryYFVMM1W1plDDKz7Gzf4we6",
      },
      {
        "email": "johndoe@gmail.com",
        "firstName": "John",
        "lastName": "Doe",
        "userId": "user_2ZZCgLE7kJG2CRBxTZ6YUIvzS10",
      },
    ]
  `);
});

test("loadUsersFromFile JSON", async () => {
  const userAuthjs = await loadUsersFromFile("/samples/authjs.json", "clerk");
  const userSupabase = await loadUsersFromFile(
    "/samples/supabase.json",
    "clerk",
  );
  const userAuth0 = await loadUsersFromFile("/samples/auth0.json", "clerk");

  expect(userAuthjs.slice(0, 2)).toMatchInlineSnapshot(`
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
  expect(userSupabase).toMatchInlineSnapshot(`
    [
      {
        "email": "janedoe@clerk.dev",
        "userId": "2971a33d-5b7c-4c11-b8fe-61b7f185f211",
      },
      {
        "email": "johndoe@clerk.dev",
        "userId": "2971a33d-5b7c-4c11-b8fe-61b7f185f234",
      },
    ]
  `);
  expect(userAuth0).toMatchInlineSnapshot(`[]`);
});
