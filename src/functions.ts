import mime from 'mime-types'
import fs from 'fs';
import path from 'path'
import csvParser from 'csv-parser';
import { VALIDATORS } from './envs-constants';
import * as z from "zod";
// import { Option } from '@clack/prompts';


const createFilePath = (file: string) => {
  return path.join(__dirname, '..', file)
}

export const checkIfFileExists = (file: string) => {
  console.log('file', file)

  if (fs.existsSync(createFilePath(file))) {
    console.log('exist')
    return true
  }
  else {
    console.log('does not exist')
    return false
  }
}

export const getFileType = (file: string) => {
  return mime.lookup(createFilePath(file))
}


export const loadUsersFromFile = async (file: string, source: string) => {

  // const userSchema = loadValidator(source)
  // type User = z.infer<typeof userSchema>;
  //
  const type = getFileType(createFilePath(file))
  if (type === "text/csv") {

    const users = [{}];
    return new Promise((resolve, reject) => {
      fs.createReadStream(createFilePath(file))
        .pipe(csvParser())
        .on('data', (data) => users.push(data))
        .on('error', (err) => reject(err))
        .on('end', () => {
          resolve(users)
        })
    });
  } else {

    // TODO: Can we deal with the any here?
    const users = JSON.parse(
      fs.readFileSync(createFilePath(file), "utf-8")
    );

    return users
  }
}

// emulate what Clack expects for an option in a Select / MultiSelect
export type OptionType = {
  value: string;
  label: string | undefined;
  hint?: string | undefined;
}

export const createValidatorOptions = () => {
  const options: OptionType[] = [];

  for (const validator of VALIDATORS) {
    options.push({ "value": validator.value, "label": validator.label })
  }

  return options
}

export const loadValidator = (validatorName: string) => {
  const validatorsDirectory = path.join(__dirname, 'validators');

  const filePath = path.join(validatorsDirectory, `${validatorName}Validator`);
  const validatorModule = require(filePath);

  const userSchema = validatorModule.default;

  console.log(`Imported:`, userSchema);

  return userSchema


}



export const authjsFirstSort = (a: any, b: any): number => {
  // If 'authjs' is present in either 'a' or 'b', prioritize it
  if (a.value === 'authjs') return -1;
  if (b.value === 'authjs') return 1;

  // Otherwise, maintain the original order
  return 0;
};
