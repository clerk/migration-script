import { expect, test } from "vitest";
import { loadUsersFromFile } from "./functions";

test("loadUsersFromFile", async () => {
  const user = await loadUsersFromFile("/samples/clerk.csv", "clerk");

  expect(user).toMatchInlineSnapshot(`
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
      {
        "email": "johnhncock@clerk.dev",
        "firstName": "John",
        "lastName": "Hancock",
        "userId": "user_2cWszPHuo6P2lCdnhhZbVMfbAIC",
      },
      {
        "email": "janehancock@clerk.dev",
        "firstName": "Jane",
        "lastName": "Hancock",
        "userId": "user_2cukOsyNsh0J3MCEvrgM6PkoB0I",
      },
    ]
  `);
});
