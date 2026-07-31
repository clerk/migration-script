import * as z from 'zod';
import { passwordHasherEnum } from '../types';

const metadataSchema = z.record(z.string(), z.unknown());
const dateStringSchema = z
	.string()
	.refine((value) => !Number.isNaN(new Date(value).getTime()), {
		message: 'Expected a valid date string',
	});

// ============================================================================
//
// ONLY EDIT THIS IF YOU ARE ADDING A NEW FIELD
//
// Generally you only need to add or edit a transformer and do not need to
// touch any of the schema.
//
// ============================================================================

/**
 * User validation schema for Clerk user imports
 *
 * Validates user data before sending to Clerk API.
 * All fields are optional except:
 * - userId is required (for tracking and logging)
 * - passwordHasher is required when password is provided
 * - user must have at least one identifier (email, phone, or username)
 *
 * @remarks
 * Fields can accept single values or arrays (e.g., email: string | string[])
 * Metadata fields accept any value for flexibility
 */
export const userSchema = z
	.object({
		userId: z.string(),
		// Email fields
		email: z.union([z.email(), z.array(z.email())]).optional(),
		emailAddresses: z.union([z.email(), z.array(z.email())]).optional(),
		unverifiedEmailAddresses: z
			.union([z.email(), z.array(z.email())])
			.optional(),
		// Phone fields
		phone: z.union([z.string(), z.array(z.string())]).optional(),
		phoneNumbers: z.union([z.string(), z.array(z.string())]).optional(),
		unverifiedPhoneNumbers: z
			.union([z.string(), z.array(z.string())])
			.optional(),
		// User info
		username: z.string().optional(),
		firstName: z.string().optional(),
		lastName: z.string().optional(),
		// Password
		password: z.string().optional(),
		passwordHasher: passwordHasherEnum.optional(),
		// 2FA
		totpSecret: z.string().optional(),
		backupCodesEnabled: z.boolean().optional(),
		backupCodes: z.array(z.string()).optional(),
		// Metadata
		unsafeMetadata: metadataSchema.optional(),
		publicMetadata: metadataSchema.optional(),
		privateMetadata: metadataSchema.optional(),
		// Additional Clerk API fields
		banned: z.boolean().optional(),
		bypassClientTrust: z.boolean().optional(),
		createOrganizationEnabled: z.boolean().optional(),
		createOrganizationsLimit: z.number().int().optional(),
		createdAt: dateStringSchema.optional(),
		deleteSelfEnabled: z.boolean().optional(),
		legalAcceptedAt: dateStringSchema.optional(),
		skipLegalChecks: z.boolean().optional(),
		skipPasswordChecks: z.boolean().optional(),
	})
	.refine((data) => !data.password || data.passwordHasher, {
		message: 'passwordHasher is required when password is provided',
		path: ['passwordHasher'],
	})
	.refine(
		(data) => {
			// Helper to check if field has value
			const hasValue = (field: unknown): boolean => {
				if (!field) return false;
				if (typeof field === 'string') return field.length > 0;
				if (Array.isArray(field)) return field.length > 0;
				return false;
			};
			// Must have at least one identifier: email, phone, or username
			const hasVerifiedEmail =
				hasValue(data.email) || hasValue(data.emailAddresses);
			const hasUnverifiedEmail = hasValue(data.unverifiedEmailAddresses);
			const hasVerifiedPhone =
				hasValue(data.phone) || hasValue(data.phoneNumbers);
			const hasUnverifiedPhone = hasValue(data.unverifiedPhoneNumbers);
			const hasUsername = hasValue(data.username);
			return (
				hasVerifiedEmail ||
				hasUnverifiedEmail ||
				hasVerifiedPhone ||
				hasUnverifiedPhone ||
				hasUsername
			);
		},
		{
			message:
				'User must have at least one identifier (email, phone, unverified email, unverified phone, or username)',
			path: ['email'],
		}
	);
