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

// transform incoming data datas to match default schema
// TODO : Remove any -- not sure how to handle this
export const transformKeys = (
  data: Record<string, unknown>,
  keys: any,
): Record<string, unknown> => {
  const transformedData: Record<string, any> = {};
  // for (const key in data) {
  for (const [key, value] of Object.entries(data)) {
    if (value !== "" && value !== '"{}"') {
      if (data.hasOwnProperty(key)) {
        let transformedKey = key;
        if (keys.transformer[key]) transformedKey = keys.transformer[key];

        transformedData[transformedKey] = data[key];
      }
    }
  }
  return transformedData;
};

const transformUsers = (users: User[], key: string, dateTime: string) => {
  const transformerKeys = handlers.find((obj) => obj.key === key);

  // This applies to smaller numbers. Pass in 10, get 5 back.
  const transformedData: User[] = [];
  for (let i = 0; i < users.length; i++) {
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

export const loadUsersFromFile = async (
  file: string,
  key: string,
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
          const transformedData: User[] = transformUsers(users, key, dateTime);
          resolve(transformedData);
        });
    });

    // if the file is already JSON, just read and parse and return the result
  } else {
    const users: User[] = JSON.parse(
      fs.readFileSync(createImportFilePath(file), "utf-8"),
    );

    const transformedData: User[] = transformUsers(users, key, dateTime);
    s.stop("Users Loaded");
    // p.log.step('Users loaded')
    return transformedData;
  }
};

// Make sure that Auth.js is the first option for the script
// TODO: Is this needed?
export const authjsFirstSort = (a: any, b: any): number => {
  // If 'authjs' is present in either 'a' or 'b', prioritize it
  if (a.key === "authjs") return -1;
  if (b.key === "authjs") return 1;

  // Otherwise, maintain the original order
  return 0;
};
