# Clerk User Import Script

## Description

This repository contains a script that takes a JSON file as input, containing a list of users, and creates a user in Clerk using Clerk's backend API. The script respects rate limits and handles errors.

## Getting Started

Clone the repository and install the dependencies.

```bash
git clone github.com/clerk/migration-script

cd migration-script

bun install
```

### Users.json file
Create a `users.json` file. This file should be populated with all the users that need to be imported. The users should pass this schema:


```ts
z.object({
  userId: z.string(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  password: z.string().optional(),
  passwordHasher: z.string().optional(),
})
```

The only required fields are `userId` and `email`. First and last names can be added if available. Clerk will also accept hashed password values along with the hashing algorithm used (the default is `bcrypt`).

Here are a couple examples.

```json
[
  {
    "userId": "1",
    "email": "dev@clerk.com",
    "firstName": "Dev",
    "lastName": "Agrawal"
  },
  {
    "userId": "2",
    "email": "john@blurp.com",
    "password": "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
    "passwordHasher": "bcrypt"  // default value
  }
]
```

### Secret Key

Create a `.env` file in the root of the folder and add your `CLERK_SECRET_KEY` to it. You can find your secret key in the [Clerk dashboard](https://dashboard.clerk.dev/).

```bash
CLERK_SECRET_KEY=your-secret-key
```

### Run the script

```bash
bun ./index.ts
```

The script will attempt importing the data into Clerk until it hits rate limit errors. It will wait for 10 seconds then attempt to import the data again. It will continue to do this until all the data has been imported.

The script can be run on the same data multiple times, Clerk automatically uses the email as a unique key so users can't be created again.

