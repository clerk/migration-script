import { config } from "dotenv";
config();

import * as fs from "fs";
import * as z from "zod";
import clerkClient from "@clerk/clerk-sdk-node";
import ora, { Ora } from "ora";

const SECRET_KEY = process.env.CLERK_SECRET_KEY;
const DELAY = parseInt(process.env.DELAY_MS ?? `1_000`);
const RETRY_DELAY = parseInt(process.env.RETRY_DELAY_MS ?? `10_000`);
const IMPORT_TO_DEV = process.env.IMPORT_TO_DEV_INSTANCE ?? "false";
const OFFSET = parseInt(process.env.OFFSET ?? `0`);
const CONCURRENCY_LIMIT = parseInt(process.env.CONCURRENCY_LIMIT ?? `10`);

if (!SECRET_KEY) {
	throw new Error(
		"CLERK_SECRET_KEY is required. Please copy .env.example to .env and add your key."
	);
}

if (SECRET_KEY.split("_")[1] !== "live" && IMPORT_TO_DEV === "false") {
	throw new Error(
		"The Clerk Secret Key provided is for a development instance. Development instances are limited to 500 users and do not share their userbase with production instances. If you want to import users to your development instance, please set 'IMPORT_TO_DEV_INSTANCE' in your .env to 'true'."
	);
}

const userSchema = z.object({
	/** The ID of the user as used in your external systems or your previous authentication solution. Must be unique across your instance. */
	userId: z.string(),
	/** Email address to set as User's primary email address. */
	email: z.string().email(),
	/** The first name to assign to the user */
	firstName: z.string().optional(),
	/** The last name to assign to the user */
	lastName: z.string().optional(),
	/** The plaintext password to give the user. Must be at least 8 characters long, and can not be in any list of hacked passwords. */
	password: z.string().optional(),
	/** The hashing algorithm that was used to generate the password digest.
	 * @see https://clerk.com/docs/reference/backend-api/tag/Users#operation/CreateUser!path=password_hasher&t=request
	 */
	passwordHasher: z
		.enum([
			"argon2i",
			"argon2id",
			"bcrypt",
			"bcrypt_sha256_django",
			"ldap_ssha",
			"md5",
			"md5_phpass",
			"pbkdf2_sha256",
			"pbkdf2_sha256_django",
			"pbkdf2_sha1",
			"phpass",
			"scrypt_firebase",
			"scrypt_werkzeug",
			"sha256",
		])
		.optional(),
	/** Metadata saved on the user, that is visible to both your Frontend and Backend APIs */
	public_metadata: z.record(z.string(), z.unknown()).optional(),
	/** Metadata saved on the user, that is only visible to your Backend APIs */
	private_metadata: z.record(z.string(), z.unknown()).optional(),
	/** Metadata saved on the user, that can be updated from both the Frontend and Backend APIs. Note: Since this data can be modified from the frontend, it is not guaranteed to be safe. */
	unsafe_metadata: z.record(z.string(), z.unknown()).optional(),
});

type User = z.infer<typeof userSchema>;

const createUser = (userData: User) =>
	userData.password
		? clerkClient.users.createUser({
				externalId: userData.userId,
				emailAddress: [userData.email],
				firstName: userData.firstName,
				lastName: userData.lastName,
				passwordDigest: userData.password,
				passwordHasher: userData.passwordHasher as any, // Clerk SDK type issue
				privateMetadata: userData.private_metadata,
				publicMetadata: userData.public_metadata,
				unsafeMetadata: userData.unsafe_metadata,
		  })
		: clerkClient.users.createUser({
				externalId: userData.userId,
				emailAddress: [userData.email],
				firstName: userData.firstName,
				lastName: userData.lastName,
				skipPasswordRequirement: true,
				privateMetadata: userData.private_metadata,
				publicMetadata: userData.public_metadata,
				unsafeMetadata: userData.unsafe_metadata,
		  });

const now = new Date().toISOString().split(".")[0]; // YYYY-MM-DDTHH:mm:ss
const logFilePath = `./migration-log-${now}.json`;

// Use a write stream for better performance
let logStream: fs.WriteStream | null = null;

function initLogStream() {
	if (!logStream) {
		logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
	}
}

function appendLog(payload: any) {
	initLogStream();
	logStream!.write(`\n${JSON.stringify(payload, null, 2)}`);
}

// Ensure log stream is closed on exit
process.on('exit', () => {
	if (logStream) {
		logStream.end();
	}
});

process.on('SIGINT', () => {
	if (logStream) {
		logStream.end();
	}
	process.exit(0);
});

let migrated = 0;
let alreadyExists = 0;

// Set to track users already being processed or completed
const processedUsers = new Set<string>();

async function processUserToClerk(userData: User, spinner: Ora, retryCount = 0) {
	const txt = spinner.text;
	
	// Check if this user is already being processed or has been completed
	if (processedUsers.has(userData.userId)) {
		return;
	}
	
	// Mark user as being processed
	processedUsers.add(userData.userId);
	
	try {
		// User data is already validated, so we can directly create the user
		await createUser(userData);
		migrated++;
	} catch (error) {
		if (error.status === 422) {
			appendLog({ userId: userData.userId, ...error });
			alreadyExists++;
			return;
		}

		// Keep cooldown in case rate limit is reached as a fallback if the thread blocking fails
		if (error.status === 429) {
			// Remove from processed set since we're going to retry
			processedUsers.delete(userData.userId);
			
			// Add exponential backoff and jitter to prevent thundering herd
			const backoffMs = RETRY_DELAY * Math.pow(2, retryCount) + Math.random() * 1000;
			spinner.text = `${txt} - rate limit reached, waiting for ${Math.round(backoffMs)} ms (retry ${retryCount + 1})`;
			await new Promise((r) => setTimeout(r, backoffMs));
			spinner.text = txt;
			
			// Limit retries to prevent infinite recursion
			if (retryCount < 3) {
				return processUserToClerk(userData, spinner, retryCount + 1);
			} else {
				appendLog({ userId: userData.userId, error: 'Max retries exceeded for rate limit', ...error });
				return;
			}
		}

		appendLog({ userId: userData.userId, ...error });
	}
}

async function cooldown() {
	// No delay needed - removed for performance
	return Promise.resolve();
}

async function rateLimitCooldown() {
	console.log(`Rate limit reached, waiting for ${RETRY_DELAY} ms...`);
	await new Promise((r) => setTimeout(r, RETRY_DELAY));
}

// Process users concurrently with a limit
async function processConcurrently<T>(
	items: T[],
	processor: (item: T, index: number) => Promise<void>,
	concurrencyLimit: number,
	spinner: Ora
): Promise<void> {
	let completed = 0;
	let running = 0;
	let index = 0;

	return new Promise((resolve, reject) => {
		const processNext = async () => {
			if (index >= items.length) {
				if (running === 0) resolve();
				return;
			}

			const currentIndex = index++;
			const item = items[currentIndex];
			running++;

			try {
				spinner.text = `Processing user ${completed + 1}/${items.length} (${running} concurrent)`;
				await processor(item, currentIndex);
				completed++;
				running--;
				
				if (completed === items.length) {
					resolve();
				} else {
					processNext();
				}
			} catch (error) {
				running--;
				reject(error);
			}
		};

		// Start initial batch of concurrent operations
		for (let i = 0; i < Math.min(concurrencyLimit, items.length); i++) {
			processNext();
		}
	});
}

async function main() {
	console.log(`Clerk User Migration Utility`);

	const inputFileName = process.argv[2] ?? "users.json";

	console.log(`Fetching users from ${inputFileName}`);

	const parsedUserData: any[] = JSON.parse(
		fs.readFileSync(inputFileName, "utf-8")
	);
	const offsetUsers = parsedUserData.slice(OFFSET);
	console.log(
		`users.json found and parsed, attempting migration with an offset of ${OFFSET}`
	);
	console.log(`Processing ${offsetUsers.length} users with concurrency limit of ${CONCURRENCY_LIMIT}`);

	// Pre-validate all user data to catch errors early
	const validatedUsers: User[] = [];
	const validationErrors: any[] = [];
	
	for (let i = 0; i < offsetUsers.length; i++) {
		const parsed = userSchema.safeParse(offsetUsers[i]);
		if (parsed.success) {
			validatedUsers.push(parsed.data);
		} else {
			validationErrors.push({ 
				index: i, 
				userId: offsetUsers[i]?.userId, 
				error: "error" in parsed ? parsed.error.errors : "Unknown validation error"
			});
		}
	}

	if (validationErrors.length > 0) {
		console.log(`${validationErrors.length} users failed validation and will be skipped`);
		validationErrors.forEach(err => appendLog(err));
	}

	const spinner = ora(`Migrating users`).start();

	// Process users concurrently
	await processConcurrently(
		validatedUsers,
		async (userData: User, index: number) => {
			await processUserToClerk(userData, spinner);
		},
		CONCURRENCY_LIMIT,
		spinner
	);

	spinner.succeed(`Migration complete`);
	return;
}

main().then(() => {
	console.log(`${migrated} users migrated`);
	console.log(`${alreadyExists} users failed to upload`);
});
