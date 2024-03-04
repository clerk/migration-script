import fs from "fs";
import path from "path";
import mime from "mime-types";
import csvParser from "csv-parser";
import * as z from "zod";
import * as p from "@clack/prompts";
import { validationLogger } from "./logger";
import { handlers } from "./handlers";

const s = p.spinner();

// default schema -- incoming data will be transformed to this format
export const userSchema = z.object({
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

export type User = z.infer<typeof userSchema>;

// utility function to create file path
const createImportFilePath = (file: string) => {
  return path.join(__dirname, "..", file);
};

// make sure the file exists. CLI will error if it doesn't
export const checkIfFileExists = (file: string) => {
  if (fs.existsSync(createImportFilePath(file))) {
    return true;
  } else {
    return false;
  }
};

// get the file type so we can verify if this is a JSON or CSV
export const getFileType = (file: string) => {
  return mime.lookup(createImportFilePath(file));
};

export const getDateTimeStamp = () => {
  return new Date().toISOString().split(".")[0]; // YYYY-MM-DDTHH:mm:ss
};

// emulate what Clack CLI expects for an option in a Select / MultiSelect
export type OptionType = {
  value: string;
  label: string | undefined;
  hint?: string | undefined;
};

// create a union of all transformer objects in handlers array
type KeyHandlerMap = (typeof handlers)[number];

// transform incoming data datas to match default schema
export function transformKeys<T extends KeyHandlerMap>(
  data: Record<string, unknown>,
  keys: T,
): Record<string, unknown> {
  const transformedData = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== "" && value !== '"{}"') {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        let transformedKey = key;
        if (keys.transformer[key]) transformedKey = keys.transformer[key];

        transformedData[transformedKey] = data[key];
      }
    }
  }
  return transformedData;
}

const transformUsers = (
  users: User[],
  key: keyof (typeof handlers)[number],
  dateTime: string,
) => {
  // This applies to smaller numbers. Pass in 10, get 5 back.
  const transformedData: User[] = [];
  for (let i = 0; i < users.length; i++) {
    const transformerKeys = handlers.find((obj) => obj.key === key);

    if (transformerKeys === undefined) {
      throw new Error("No transformer found for the specified key");
    }

    const transformedUser = transformKeys(users[i], transformerKeys);

    const validationResult = userSchema.safeParse(transformedUser);
    // Check if validation was successful
    if (validationResult.success) {
      // The data is valid according to the original schema
      const validatedData = validationResult.data;
      transformedData.push(validatedData);
    } else {
      // The data is not valid, handle errors
      validationLogger(
        {
          error: `${validationResult.error.errors[0].code} for required field.`,
          path: validationResult.error.errors[0].path,
          row: i,
        },
        dateTime,
      );
    }
  }
  return transformedData;
};

const addDefaultFields = (users: User[], key: string) => {
  if (handlers.find((obj) => obj.key === key)?.defaults) {
    const defaultFields = handlers.find((obj) => obj.key === key)?.defaults;

    console.log('defaults', defaultFields)

    const updatedUsers: User[] = []

    for (const user of users) {
      const updated = { ...user, ...defaultFields }
      updatedUsers.push(updated)
    }

    console.log('USERS', JSON.stringify(updatedUsers, null, 2))
    return updatedUsers
  } else {
    return users
  }
}

export const loadUsersFromFile = async (
  file: string,
  key: keyof (typeof handlers)[number],
): Promise<User[]> => {
  const dateTime = getDateTimeStamp();
  s.start();
  s.message("Loading users and perparing to migrate");

  const type = getFileType(createImportFilePath(file));

  // convert a CSV to JSON and return array
  if (type === "text/csv") {
    const users: User[] = [];
    return new Promise((resolve, reject) => {
      fs.createReadStream(createImportFilePath(file))
        .pipe(csvParser())
        .on("data", (data) => {
          users.push(data);
        })
        .on("error", (err) => reject(err))
        .on("end", () => {
          const usersWithDefaultFields = addDefaultFields(users, key)
          const transformedData: User[] = transformUsers(usersWithDefaultFields, key, dateTime);
          resolve(transformedData);
        });
    });

    // if the file is already JSON, just read and parse and return the result
  } else {
    const users: User[] = JSON.parse(
      fs.readFileSync(createImportFilePath(file), "utf-8"),
    );
    const usersWithDefaultFields = addDefaultFields(users, key)
    const transformedData: User[] = transformUsers(usersWithDefaultFields, key, dateTime);
    s.stop("Users Loaded");
    // p.log.step('Users loaded')
    return transformedData;
  }
};
