import * as z from "zod";

export const options = {
  value: 'authjs',
  label: 'Authjs (Next-Auth)',
  schema: 'authjsUserSchema'
}

export const authjsUserSchema = z.object({
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



