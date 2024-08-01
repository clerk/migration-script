import { expect, test } from "vitest";
import { errorLogger } from "./logger";
import { readFileSync, existsSync, rmdirSync } from "node:fs";

test("errorLogger", () => {
  const dateTime = "fake-date-time";

  errorLogger(
    {
      errors: [
        {
          code: "1234",
          message: "isolinear chip failed to initialize, in jeffries tube 32",
        },
      ],
      status: "error",
      userId: "123",
    },
    dateTime,
  );

  expect(readFileSync("logs/fake-date-time.json", "utf8"))
    .toMatchInlineSnapshot(`
    "[
      [
        {
          "type": "User Creation Error",
          "userId": "123",
          "status": "error"
        }
      ]
    ]"
  `);

  existsSync("logs/fake-date-time.json") &&
    rmdirSync("logs", { recursive: true });
});
