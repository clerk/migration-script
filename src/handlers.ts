export const handlers = [
  {
    key: "clerk",
    value: "clerk",
    label: "Clerk",
    transformer: {
      id: "userId",
      email_addresses: "email",
      first_name: "firstName",
      last_name: "lastName",
      phone_number: "phoneNumber",
      password_digest: "passwordDigest",
      password_hasher: "passwordHasher",
    },
  },
  {
    key: "authjs",
    value: "authjs",
    label: "Authjs (Next-Auth)",
    transformer: {
      id: "userId",
      email_addresses: "email",
      first_name: "firstName",
      last_name: "lastName",
    },
  },
  {
    key: "supabase",
    value: "supabase",
    label: "Supabase",
    transformer: {
      id: "userId",
      email: "email",
      first_name: "firstName",
      last_name: "lastName",
      encrypted_password: "password",
      phone: "phone",
    },
    defaults: {
      passwordHasher: "bcrypt",
    },
  },
  {
    key: "auth0",
    value: "auth0",
    label: "Auth0",
    transformer: {
      id: "userId",
      email: "email",
      given_name: "firstName",
      family_name: "lastName",
      phone_number: "phone",
      passwordHash: "password",
      user_metadata: "publicMetadata",
    },
    defaults: {
      passwordHasher: "bcrypt",
    },
  },
];
