# Helpers

## CSV to JSON User Migration Script

This script converts Clerk user export CSV files to the JSON format required to run the main script of this repo to import users in to Clerk.

### Usage

```bash
# Basic usage - outputs to users.json
npx tsx helpers/user_export_csv_to_json.ts csv_exports/your_export.csv

# Specify custom output file
npx tsx helpers/user_export_csv_to_json.ts csv_exports/your_export.csv output/my_users.json
```

### Input CSV Format

The script expects a CSV file with the following headers:
- `id` - The user ID (maps to `userId` in JSON)
- `first_name` - User's first name (optional)
- `last_name` - User's last name (optional)
- `primary_email_address` - User's email (required)
- `password_digest` - Hashed password (optional)
- `password_hasher` - Password hashing algorithm (optional)
- Other fields are ignored but can be present

### Output JSON Format

The script generates a JSON file compatible with Clerk's user migration format:

```json
[
  {
    "userId": "string",
    "email": "email",
    "firstName": "string (optional)",
    "lastName": "string (optional)", 
    "password": "string (optional)",
    "passwordHasher": "bcrypt"
  }
]
```

### Features

- Handles empty fields gracefully
- Validates required fields (userId and email)
- Skips invalid rows with warnings
- Supports various password hashers (bcrypt, argon2, etc.)
- Flexible CSV parsing with field count tolerance
- Clean console output with progress information

### Example

Input CSV:
```csv
id,first_name,last_name,username,primary_email_address,primary_phone_number,verified_email_addresses,unverified_email_addresses,verified_phone_numbers,unverified_phone_numbers,totp_secret,password_digest,password_hasher
user_123,John,Doe,,john@example.com,,john@example.com,,,,,$2a$10$hash123,bcrypt
```

Output JSON:
```json
[
  {
    "userId": "user_123",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "password": "$2a$10$hash123",
    "passwordHasher": "bcrypt"
  }
]
``` 