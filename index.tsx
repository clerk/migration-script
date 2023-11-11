import { config } from "dotenv";
config();

import * as fs from "fs";
import * as z from "zod";
import clerkClient from "@clerk/clerk-sdk-node";
import React, { useState, useEffect } from "react";
// @ts-expect-error
import { render, Text } from "ink";

const retryDelay = 10_000; // 10 seconds
const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) {
  throw new Error("CLERK_SECRET_KEY is required");
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

type User = z.infer<typeof userSchema>;

const errors: any[] = [];

const attemptCreateUser = (userData: User) =>
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

// Read the user data from the JSON file
const getUserData = async () =>
  userSchema
    .array()
    .parse(JSON.parse(await fs.promises.readFile("users.json", "utf-8")));

const Counter = () => {
  const [migrated, setMigrated] = useState(0);
  const [alreadyExists, setAlreadyExists] = useState(0);
  const [status, setStatus] = useState<
    "initing" | "validating" | "migrating" | "chilling"
  >("initing");

  const [retryCountdown, setRetryCountdown] = useState(0);

  useEffect(() => {
    if (retryCountdown > 0) {
      const handle = setTimeout(() => {
        setRetryCountdown((prev) => prev - 1000);
      }, 1000);

      return () => clearTimeout(handle);
    }
  }, [retryCountdown]);

  useEffect(() => {
    async function createUser(userData: User) {
      try {
        await attemptCreateUser(userData);

        setMigrated((prev) => prev + 1);
      } catch (error) {
        errors.push(error);
        if (error.status === 422) {
          setAlreadyExists((prev) => prev + 1);
          return;
        }
        if (error.status === 429) {
          setStatus("chilling");
          setRetryCountdown(retryDelay);

          await new Promise((r) => setTimeout(r, retryDelay));

          setStatus("migrating");
          return createUser(userData);
        }
        console.error("Error creating user:", error);
      }
    }

    async function createUsers() {
      setStatus("validating");
      const validatedUserData = await getUserData();
      setStatus("migrating");
      try {
        for (let i = 0; i < validatedUserData.length; i++) {
          await createUser(validatedUserData[i]);
        }

        await fs.promises.writeFile(
          "errors.json",
          JSON.stringify(errors, null, 2)
        );

        return validatedUserData;
      } catch (error) {
        console.error("Error validating user data:", error);
      }
    }

    createUsers();
  }, []);

  return (
    <>
      <Text color="white" bold>
        Clerk User Migration Utility
      </Text>
      {status === "initing" && <Text color="yellow">Initializing...</Text>}
      {status === "validating" && (
        <Text color="blue">Validating user data...</Text>
      )}
      {status === "migrating" && <Text color="green">Migrating users...</Text>}
      {status === "chilling" && (
        <Text color="#A69C40">
          Waiting for rate limit to reset...
          {retryCountdown > 0 && ` ${retryCountdown / 100}s`}
        </Text>
      )}
      <Text color={migrated === 0 ? "red" : "green"}>
        {migrated} users migrated
      </Text>
      {alreadyExists > 0 && (
        <Text color="yellow">{alreadyExists} users already exist</Text>
      )}
    </>
  );
};

render(<Counter />);
