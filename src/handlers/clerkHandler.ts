export const options = {
  key: "clerk",
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
};
