# Clerk User Import Script

## Description

This repository contains a script that takes a JSON file as input, containing a list of users, and creates a user in Clerk using Clerk's backend API. The script respects rate limits and handles errors.

## Getting Started

Clone the repository and install the dependencies.

```bash
git clone github.com/clerk/migration-script

cd migration-script

npm install
```

### Users.json file
Create a `users.json` file. This file should be populated with all the users that need to be imported. The users should pass this schema:


```ts
[
  {
    "userId": "string",
    "email": "email",
    "name": "string (optional)",
    "agreedTerms": true/false,
  }
]
```

The required fields are `userId`, `email`, and  `agreedTerms`. Name is optional in the database, so it may not be present.

Here are a couple examples.

```json
[
  {
    "userId": "1",
    "email": "dev@clerk.com",
    "name": "Dev Agrawal",
    "agreedTerms": true,
  },
  {
    "userId": "2",
    "email": "john@blurp.com",
    "agreedTerms": false
  }
]
```

~~The samples/ folder contains some samples, including issues that will produce errors when running the import.~~ These are wrong, with our edits.

### Secret Key

Create a `.env` file in the root of the folder and add your `CLERK_SECRET_KEY` to it. You can find your secret key in the [Clerk dashboard](https://dashboard.clerk.dev/).

```bash
CLERK_SECRET_KEY=your-secret-key
```

### Run the script

```bash
npm start
```

The script will begin process the users and attempting to import them into Clerk. The script has a built in delay to respect the rate limits for the Clerk Backend API. If the script does hit a rate limit then it will wait the required 10 seconds and resume. Any errors will be logged to a `migration-log.json` file.

The script can be run on the same data multiple times, Clerk automatically uses the email as a unique key so users can't be created again.

### Configuration

The script can be configured through the following environment variables:

| Variable | Description | Default |
| -------- | ----------- | ------- |
| `CLERK_SECRET_KEY` | Your Clerk secret key | `undefined` |
| `DELAY_MS` | Delay between requests to respect rate limits | `1000` |
| `RETRY_DELAY_MS` | Delay when the rate limit is hit | `10000` |
| `OFFSET` | Offset to start migration (number of users to skip) | `0` |

## Handling the Foreign Key constraint

If you were using a database, you will have data tied to your previous auth system's userIDs. You will need to handle this in some way to maintain data consistency as you move to Clerk. Below are a few strategies you can use.

### Custom session claims

Our sessions allow for conditional expressions. This would allow you add a session claim that will return either the `externalId` (the previous id for your user) when it exists, or the `userId` from Clerk. This will result in your imported users returning their `externalId` while newer users will return the Clerk `userId`.

In your Dashboard, go to Sessions -> Edit. Add the following: 

```json
{
	"userId": "{{user.external_id || user.id}}"
}
```

You can now access this value using the following:
```ts 
const { sessionClaims } = auth();
console.log(sessionClaims.userId) 
```

You can add the following for typescript: 
```js
// types/global.d.ts

export { };

declare global {
  interface CustomJwtSessionClaims {
    userId?: string;
  }
}
```

### Other options

You could continue to generate unique ids for the database as done previously, and then store those in `externalId`. This way all users would have an `externalId` that would be used for DB interactions.

You could add a column in your user table inside of your database called `ClerkId`. Use that column to store the userId from Clerk directly into your database.

