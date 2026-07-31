import fs from 'fs';
import csvParser from 'csv-parser';
import * as p from '@clack/prompts';
import { validationLogger } from '../logger';
import { transformers } from '../transformers';
import { userSchema } from './validator';
import type { TransformerMapKeys, User } from '../types';
import { PASSWORD_HASHERS } from '../types';
import {
	createImportFilePath,
	getDateTimeStamp,
	getFileType,
	transformKeys,
} from '../lib';
import type { TransformerMapUnion } from '../types';

// Re-export for backwards compatibility
export type { PreTransformResult } from '../types';

const s = p.spinner();

type TransformUsersOptions = {
	validate?: boolean;
};

type LoadUsersOptions = TransformUsersOptions & {
	showSpinner?: boolean;
};

const getTransformer = (key: string): TransformerMapUnion => {
	const transformer = transformers.find((obj) => obj.key === key);
	if (transformer === undefined) {
		throw new Error(`Transformer not found for key: ${key}`);
	}
	return transformer;
};

const parseDelimitedStrings = (field: unknown): string[] => {
	if (Array.isArray(field)) return field as string[];
	if (typeof field === 'string' && field) {
		return field
			.split(/[,|]/)
			.map((value: string) => value.trim())
			.filter(Boolean);
	}
	return [];
};

const consolidateClerkIdentifiers = (
	transformedUser: Record<string, unknown>
) => {
	const primaryEmail = transformedUser.email as string | undefined;
	const verifiedEmails = parseDelimitedStrings(transformedUser.emailAddresses);
	const unverifiedEmails = parseDelimitedStrings(
		transformedUser.unverifiedEmailAddresses
	);

	const allEmails: string[] = [];
	if (primaryEmail) allEmails.push(primaryEmail);
	for (const email of [...verifiedEmails, ...unverifiedEmails]) {
		if (!allEmails.includes(email)) allEmails.push(email);
	}
	if (allEmails.length > 0) {
		transformedUser.email = allEmails;
	}
	delete transformedUser.emailAddresses;
	delete transformedUser.unverifiedEmailAddresses;

	const primaryPhone = transformedUser.phone as string | undefined;
	const verifiedPhones = parseDelimitedStrings(transformedUser.phoneNumbers);
	const unverifiedPhones = parseDelimitedStrings(
		transformedUser.unverifiedPhoneNumbers
	);

	const allPhones: string[] = [];
	if (primaryPhone) allPhones.push(primaryPhone);
	for (const phone of [...verifiedPhones, ...unverifiedPhones]) {
		if (!allPhones.includes(phone)) allPhones.push(phone);
	}
	if (allPhones.length > 0) {
		transformedUser.phone = allPhones;
	}
	delete transformedUser.phoneNumbers;
	delete transformedUser.unverifiedPhoneNumbers;
};

const validatePreparedUsers = (
	users: Record<string, unknown>[],
	dateTime: string
): { users: User[]; validationFailed: number } => {
	const validatedUsers: User[] = [];
	let validationFailed = 0;

	for (let i = 0; i < users.length; i++) {
		const user = users[i];
		const validationResult = userSchema.safeParse(user);

		if (validationResult.success) {
			validatedUsers.push(validationResult.data);
			continue;
		}

		validationFailed++;
		const firstIssue = validationResult.error.issues[0];

		if (firstIssue.path.includes('passwordHasher') && user.passwordHasher) {
			const userId = user.userId as string;
			const invalidHasher =
				typeof user.passwordHasher === 'string'
					? user.passwordHasher
					: JSON.stringify(user.passwordHasher);
			s.stop('Validation Error');
			throw new Error(
				`Invalid password hasher detected.\n` +
					`User ID: ${userId}\n` +
					`Row: ${i + 1}\n` +
					`Invalid hasher: "${invalidHasher}"\n` +
					`Expected one of: ${PASSWORD_HASHERS.join(', ')}`
			);
		}

		validationLogger(
			{
				error: firstIssue.message,
				path: firstIssue.path as (string | number)[],
				userId: (user.userId as string) || `row-${i}`,
				row: i,
			},
			dateTime
		);
	}

	return { users: validatedUsers, validationFailed };
};

/**
 * Transforms and validates an array of users for import
 *
 * Processes each user through:
 * 1. Field transformation using the transformer's transformer config
 * 2. Special handling for Clerk-to-Clerk migrations (email/phone array consolidation)
 * 3. Transformer-specific postTransform logic (if defined)
 * 4. Schema validation
 * 5. Validation error logging for failed users
 *
 * Throws immediately if an invalid password hasher is detected.
 * Logs other validation errors and excludes invalid users from the result.
 *
 * @param users - Array of raw user data to transform
 * @param key - Transformer key identifying the source platform
 * @param dateTime - Timestamp for log file naming
 * @returns Object containing transformed users array and validation failure count
 * @throws Error if an invalid password hasher is detected
 */
export function transformUsers(
	users: Record<string, unknown>[],
	key: TransformerMapKeys,
	dateTime: string,
	options: TransformUsersOptions = {}
): { transformedData: User[]; validationFailed: number } {
	const transformedData: Record<string, unknown>[] = [];

	const transformer = getTransformer(key);

	for (let i = 0; i < users.length; i++) {
		const transformedUser = transformKeys(users[i], transformer);

		// Transform email to array for clerk transformer (merges primary + verified + unverified emails)
		if (key === 'clerk') {
			consolidateClerkIdentifiers(transformedUser);
		}

		// Apply transformer-specific post-transformation if defined
		if (typeof transformer.postTransform === 'function') {
			transformer.postTransform(transformedUser);
		}

		transformedData.push(transformedUser);
	}

	if (options.validate === false) {
		return { transformedData: transformedData as User[], validationFailed: 0 };
	}

	const validationResult = validatePreparedUsers(transformedData, dateTime);
	return {
		transformedData: validationResult.users,
		validationFailed: validationResult.validationFailed,
	};
}

/**
 * Adds default field values from the transformer configuration to all users
 *
 * Some transformers define default values that should be applied to all users.
 * For example, the Supabase transformer defaults passwordHasher to "bcrypt".
 *
 * @param users - Array of user objects
 * @param key - Transformer key identifying which defaults to apply
 * @returns Array of users with default fields applied (if transformer has defaults)
 */
function addDefaultFields(
	users: Record<string, unknown>[],
	key: string
): Record<string, unknown>[] {
	const transformer = transformers.find((obj) => obj.key === key);
	const defaultFields =
		transformer && 'defaults' in transformer ? transformer.defaults : null;

	if (defaultFields) {
		const updatedUsers: Record<string, unknown>[] = [];

		for (const user of users) {
			const updated = {
				...user,
				...defaultFields,
			};
			updatedUsers.push(updated);
		}

		return updatedUsers;
	}
	return users;
}

export function validateUsersForImport(
	users: Record<string, unknown>[],
	key: TransformerMapKeys,
	dateTime = getDateTimeStamp()
): { validationFailed: number; logFile: string } {
	const usersWithDefaultFields = addDefaultFields(users, key);
	const validationResult = validatePreparedUsers(
		usersWithDefaultFields,
		dateTime
	);

	return {
		validationFailed: validationResult.validationFailed,
		logFile: `migration-${dateTime}.log`,
	};
}

const readUsersFromFile = async (
	file: string,
	key: TransformerMapKeys
): Promise<Record<string, unknown>[]> => {
	let filePath = createImportFilePath(file);
	const type = getFileType(filePath);
	const transformer = getTransformer(key);

	let preExtractedData: User[] | undefined;

	if (typeof transformer.preTransform === 'function') {
		const preTransformResult = await Promise.resolve(
			transformer.preTransform(filePath, type || '')
		);
		filePath = preTransformResult.filePath;
		preExtractedData = preTransformResult.data;
	}

	if (type === 'text/csv') {
		return new Promise((resolve, reject) => {
			const users: Record<string, unknown>[] = [];
			fs.createReadStream(filePath)
				.pipe(csvParser({ skipComments: true }))
				.on('data', (data: Record<string, unknown>) => {
					users.push(data);
				})
				.on('error', (err) => {
					reject(err);
				})
				.on('end', () => {
					resolve(users);
				});
		});
	}

	return preExtractedData
		? preExtractedData
		: (JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<
				string,
				unknown
			>[]);
};

export async function loadTransformedUsersFromFile(
	file: string,
	key: TransformerMapKeys,
	options: LoadUsersOptions = {}
): Promise<{ users: User[]; validationFailed: number }> {
	const dateTime = getDateTimeStamp();

	if (options.showSpinner) {
		s.start();
		s.message('Loading users and preparing to migrate');
	}

	try {
		const rawUsers = await readUsersFromFile(file, key);
		const usersWithDefaultFields = addDefaultFields(rawUsers, key);
		const { transformedData, validationFailed } = transformUsers(
			usersWithDefaultFields,
			key,
			dateTime,
			options
		);

		if (options.showSpinner) {
			s.stop('Users Loaded');
		}

		return { users: transformedData, validationFailed };
	} catch (error) {
		if (options.showSpinner) {
			s.stop('Error loading users');
		}
		throw error;
	}
}

export async function loadRawUsers(
	file: string,
	key: TransformerMapKeys
): Promise<Record<string, unknown>[]> {
	const { users } = await loadTransformedUsersFromFile(file, key, {
		validate: false,
	});
	return users;
}

/**
 * Loads, transforms, and validates users from a JSON or CSV file
 *
 * Main entry point for loading user data. Performs the following:
 * 1. Reads users from file (supports JSON and CSV)
 * 2. Applies transformer default fields
 * 3. Transforms field names to Clerk schema
 * 4. Validates each user against schema
 * 5. Logs validation errors
 * 6. Returns only successfully validated users and validation failure count
 *
 * Displays a spinner during the loading process.
 *
 * @param file - File path to load users from (relative or absolute)
 * @param key - Transformer key identifying the source platform
 * @returns Object containing validated users array and validation failure count
 * @throws Error if file cannot be read or contains invalid data
 */
export async function loadUsersFromFile(
	file: string,
	key: TransformerMapKeys
): Promise<{ users: User[]; validationFailed: number }> {
	return loadTransformedUsersFromFile(file, key, { showSpinner: true });
}
