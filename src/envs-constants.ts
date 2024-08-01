import { TypeOf, z } from "zod";
import { config } from "dotenv";
config();

// TODO: Revisit if we need this. Left to easily implement
export const withDevDefault = <T extends z.ZodTypeAny>(
  schema: T,
  val: TypeOf<T>,
) => (process.env["NODE_ENV"] !== "production" ? schema.default(val) : schema);

const envSchema = z.object({
  CLERK_SECRET_KEY: z.string(),
  DELAY: z.coerce.number().optional().default(550),
  RETRY_DELAY_MS: z.coerce.number().optional().default(10000),
  OFFSET: z.coerce.number().optional().default(0),
  IMPORT_TO_DEV: z.coerce.boolean().optional().default(false),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables:",
    JSON.stringify(parsed.error.format(), null, 4),
  );
  process.exit(1);
}

export const env = parsed.data;
