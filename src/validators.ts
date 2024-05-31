import { emails } from "@clerk/clerk-sdk-node";
import { i } from "vitest/dist/reporters-yx5ZTtEV";
import * as z from "zod";

const unsafeMetadataSchema = z.object({
  username: z.string().optional(),
  isAccessToBeta: z.boolean().optional(),
});

const publicMetadataSchema = z.object({});

const privateMetadataSchema = z.object({});

// ============================================================================
//
// ONLY EDIT BELOW THIS IF YOU ARE ADDING A NEW IMPORT SOURCE
// THAT IS NOT YET SUPPORTED
//
// ============================================================================

// default schema -- incoming data will be transformed to this format
export const userSchema = z.object({
  userId: z.string(),
  // email: z.array(z.string().email()).optional(),
  email: z.string().email(),
  username: z.string().optional(),
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
  phone: z.string().optional(),
  mfaEnabled: z.boolean().optional(),
  totpSecret: z.string().optional(),
  backupCodesEnabled: z.boolean().optional(),
  backupCodes: z.string().optional(),
  unsafeMetadata: unsafeMetadataSchema,
  publicMetadata: publicMetadataSchema,
  privateMetadata: privateMetadataSchema,
});
