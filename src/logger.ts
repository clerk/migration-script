import { ClerkAPIError } from "@clerk/types";
import fs from "fs";
import path from "path";

type ErrorPayload = {
  userId: string;
  status: string;
  errors: ClerkAPIError[];
};

type ValidationErrorPayload = {
  error: string;
  path: (string | number)[];
  row: number;
};

type ErrorLog = {
  type: string;
  userId: string;
  status: string;
  error: string | undefined;
};

type LogType = ErrorLog[] | ValidationErrorPayload | { message: string }[];

const confirmOrCreateFolder = (path: string) => {
  try {
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path);
    }
  } catch (err) {
    console.error("❌ Error creating directory for logs:", err);
  }
};

function logger<T extends LogType>(payload: T, dateTime: string) {
  const logPath = path.join(__dirname, "..", "logs");
  confirmOrCreateFolder(logPath);

  try {
    if (!fs.existsSync(`${logPath}${path.sep}${dateTime}.json`)) {
      const log = [payload];
      fs.writeFileSync(
        `${logPath}${path.sep}${dateTime}.json`,
        JSON.stringify(log, null, 2),
      );
    } else {
      const log = JSON.parse(
        fs.readFileSync(`${logPath}${path.sep}${dateTime}.json`, "utf-8"),
      );
      log.push(payload);

      fs.writeFileSync(
        `${logPath}${path.sep}${dateTime}.json`,
        JSON.stringify(log, null, 2),
      );
    }
  } catch (err) {
    console.error("❌ Error creating directory for logs:", err);
  }
}

export const infoLogger = (message: string, dateTime: string) => {
  confirmOrCreateFolder(path.join(__dirname, "..", "logs"));
  logger([{ message: message }], dateTime);
};

export const errorLogger = (payload: ErrorPayload, dateTime: string) => {
  const errorsPath = path.join(__dirname, "..", "logs");
  confirmOrCreateFolder(errorsPath);

  const errors: ErrorLog[] = [];
  for (const err of payload.errors) {
    const errorToLog = {
      type: "User Creation Error",
      userId: payload.userId,
      status: payload.status,
      error: err.longMessage,
    };
    errors.push(errorToLog);
  }
  logger(errors, dateTime);
};

export const validationLogger = (
  payload: ValidationErrorPayload,
  dateTime: string,
) => {
  const errorsPath = path.join(__dirname, "..", "logs");
  confirmOrCreateFolder(errorsPath);

  const error = {
    type: "Validation Error",
    row: payload.row,
    error: payload.error,
    path: payload.path,
  };
  logger(error, dateTime);
};
