import * as z from "zod";

export const options = {
  value: 'supabase',
  label: 'Supabase',
  schema: 'supabaseUserSchema'
}

const supabaseUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  encrypted_password: z.string().optional(),
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
    .default('bcrypt'),
});

export default supabaseUserSchema
