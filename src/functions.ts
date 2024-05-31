import fs from "fs";
import csvParser from "csv-parser";
import * as p from "@clack/prompts";
import { validationLogger } from "./logger";
import { handlers } from "./handlers";
import { userSchema } from "./validators";
import { HandlerMapKeys, HandlerMapUnion, User } from "./types";
import { createImportFilePath, getDateTimeStamp, getFileType } from "./utils";

const s = p.spinner();

// transform incoming data datas to match default schema
export function transformKeys<T extends HandlerMapUnion>(
  data: Record<string, unknown>,
  keys: T,
): Record<string, unknown> {
  const transformedData = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== "" && value !== '"{}"' && value !== null) {
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
  key: HandlerMapKeys,
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

    // if (key === "clerk") {
    //   console.log(transformedUser);
    // }

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
    const defaultFields =
      handlers.find((obj) => obj.key === key)?.defaults ?? {};

    const updatedUsers: User[] = [];

    for (const user of users) {
      const updated = {
        ...user,
        ...defaultFields,
      };
      updatedUsers.push(updated);
    }

    return updatedUsers;
  } else {
    return users;
  }
};

export const loadUsersFromFile = async (
  file: string,
  key: HandlerMapKeys,
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
          const usersWithDefaultFields = addDefaultFields(users, key);
          const transformedData: User[] = transformUsers(
            usersWithDefaultFields,
            key,
            dateTime,
          );
          resolve(transformedData);
        });
    });

    // if the file is already JSON, just read and parse and return the result
  } else {
    const users: User[] = JSON.parse(
      fs.readFileSync(createImportFilePath(file), "utf-8"),
    );
    const usersWithDefaultFields = addDefaultFields(users, key);

    const transformedData: User[] = transformUsers(
      usersWithDefaultFields,
      key,
      dateTime,
    );

    s.stop("Users Loaded");
    // p.log.step('Users loaded')
    return transformedData;
  }
};
