
import { TypeOf, z } from 'zod'
import * as fs from 'fs';
import * as path from 'path';
import { config } from "dotenv";
config();
// require('dotenv').config()

// TODO: Revisit if we need this. Left to easily implement
export const withDevDefault = <T extends z.ZodTypeAny>(
  schema: T,
  val: TypeOf<T>,
) => (process.env['NODE_ENV'] !== 'production' ? schema.default(val) : schema)

const envSchema = z.object({
  CLERK_SECRET_KEY: z.string(),
  DELAY: z.coerce.number().optional().default(550),
  RETRY_DELAY_MS: z.coerce.number().optional().default(10000),
  OFFSET: z.coerce.number().optional().default(0),
  IMPORT_TO_DEV: z.coerce.boolean().optional().default(false)
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error(
    '❌ Invalid environment variables:',
    JSON.stringify(parsed.error.format(), null, 4),
  )
  process.exit(1)
}

export const env = parsed.data


// Dynamically read what validators are present and generate array for use in script

type Validator = {
  value: string;
  label: string;
  schema: string;
};

// 
const validatorsDirectory = path.join(__dirname, '/validators');
export const VALIDATORS: Validator[] = [];
const files = fs.readdirSync(validatorsDirectory);


files.forEach((file) => {
  if (file.endsWith('.ts')) {
    const filePath = path.join(validatorsDirectory, file);
    const validatorModule = require(filePath); // Use `require` for dynamic imports in Node.js

    if (validatorModule.options && validatorModule.options.value && validatorModule.options.schema) {
      VALIDATORS.push({
        value: validatorModule.options.value,
        label: validatorModule.options.label || '',
        schema: validatorModule.options.schema,
      });
    }
  }
});
