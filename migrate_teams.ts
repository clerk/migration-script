import { config } from "dotenv";
config();

import * as fs from "fs";
import * as z from "zod";
import { clerkClient } from "@clerk/clerk-sdk-node";
import ora, { Ora } from "ora";

const SECRET_KEY = process.env.CLERK_SECRET_KEY;
const DELAY_MS = parseInt(process.env.DELAY_MS ?? `1000`);
const RETRY_DELAY_MS = parseInt(process.env.RETRY_DELAY_MS ?? `10000`);
const IMPORT_TO_DEV = process.env.IMPORT_TO_DEV_INSTANCE ?? "false";

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
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().email(),
});

const teamSchema = z.object({
  id: z.string(),
  name: z.string(),
  domains: z.string().array(),
});

const teamMemberSchema = z.object({
  teamId: z.string(),
  userId: z.string(),
});

type User = z.infer<typeof userSchema>;
type Team = z.infer<typeof teamSchema>;
type TeamMember = z.infer<typeof teamMemberSchema>;

const now = new Date().toISOString().split(".")[0]; // YYYY-MM-DDTHH:mm:ss
function appendLog(payload: any) {
  fs.appendFileSync(
    `./migration-log-${now}.json`,
    `\n${JSON.stringify(payload, null, 2)}`
  );
}

let migrated = 0;
let alreadyExists = 0;

function nameToSlug(name: string) {
  const allowed = 'qwertyuiopasdfghjklzxcvbnm1234567890-'
  const slug = name.toLocaleLowerCase().split('').filter(cc => allowed.includes(cc)).join('')
  console.log(`nameToSlug [name=${name}, slug=${slug}]`)
  return slug
}

async function processTeamMemberToClerk(spinner: Ora, member: TeamMember, user: User, team: Team) {
  const txt = spinner.text;
  try {
    const users = await clerkClient.users.getUserList({emailAddress: [user.email]})
    if (users.data.length === 0) throw `Error: no clerk user found. [users=${users.data.length}, email=${user.email}]`
    if (users.data.length > 1) throw `Error: more than one user. [users=${users.data.length}, email=${user.email}]`
    const clerkUser = users.data[0]
    console.log(`found clerk user [clerkUserId=${clerkUser.id}]\n`)

    const slug = nameToSlug(team.name)

    let org
    try {
      org = await clerkClient.organizations.getOrganization({ slug })
        console.log(`found org [org=${org.id}]\n`)
    } catch (e) {
      if (e.status === 404) {
        org = await clerkClient.organizations.createOrganization({ name: team.name, slug, createdBy: clerkUser.id })
        console.log(`created new org [org=${org.id}]\n`)
      }
    }

    const member = await clerkClient.organizations.createOrganizationMembership({ organizationId: org.id, userId: clerkUser.id, role: 'org:admin' })
    console.log(`created new member [member=${member.id}]\n`)

    migrated++;
  } catch (error) {
    // 422: Unprocessable Content
    if (error.status === 422) {
      appendLog({ userId: member.userId, teamId: member.teamId, ...error });
      alreadyExists++;
      return;
    }

    // Keep cooldown in case rate limit is reached as a fallback if the thread blocking fails
    // 429: Too Many Requests
    if (error.status === 429) {
      spinner.text = `${txt} - rate limit reached, waiting for ${RETRY_DELAY_MS} ms`;
      await rateLimitCooldown();
      spinner.text = txt;
      return processTeamMemberToClerk(spinner, member, user, team)
    }

    appendLog({ userId: member.userId, teamId: member.teamId, ...error });
  }
}

async function cooldown() {
  await new Promise((r) => setTimeout(r, DELAY_MS));
}

async function rateLimitCooldown() {
  await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
}

async function main() {
  console.log(`Clerk Team Migration Utility`);
  const spinner = ora(`Migrating users`).start();

  const usersFile = process.argv[2] ?? "users.json";
  const teamsFile = process.argv[2] ?? "team.json";
  const teamMembersFile = process.argv[2] ?? "team_members.json";

  const parsedUsersData: any[] = JSON.parse(fs.readFileSync(usersFile, "utf-8"));
  const parsedTeamsData: any[] = JSON.parse(fs.readFileSync(teamsFile, "utf-8"));
  const parsedTeamMembersData: any[] = JSON.parse(fs.readFileSync(teamMembersFile, "utf-8"));

  // Check all users for errors.
  spinner.text = 'Verifying users...'
  for (let i = 0; i < parsedUsersData.length; i++) {
    const userData = parsedUsersData[i]
    console.log(`user ${i} of ${parsedUsersData.length}:`, JSON.stringify(userData))
    const parsedUser = userSchema.safeParse(userData);
    if (!parsedUser.success) {
      throw parsedUser.error;
    }
  }
  await cooldown();

  // Check all teams for errors.
  spinner.text = 'Verifying teams...'
  for (let i = 0; i < parsedTeamsData.length; i++) {
    const teamData = parsedTeamsData[i]
    console.log(`team ${i} of ${parsedTeamsData.length}:`, JSON.stringify(teamData))
    const parsedTeam = teamSchema.safeParse(teamData)
    if (!parsedTeam.success) {
      throw parsedTeam.error;
    }
  }
  await cooldown();

  // Check all team members for errors.
  spinner.text = 'Verifying team members...'
  for (let i = 0; i < parsedTeamMembersData.length; i++) {
    const teamMemberData = parsedTeamMembersData[i]
    console.log(`team member ${i} of ${parsedTeamMembersData.length}:`, JSON.stringify(teamMemberData))
    const parsedTeamMember = teamMemberSchema.safeParse(teamMemberData)
    if (!parsedTeamMember.success) {
      throw parsedTeamMember.error;
    }
  }
  await cooldown();

  const total = parsedTeamMembersData.length
  for (let i = 0; i < total; i++) {
    await cooldown();
    const member = teamMemberSchema.safeParse(parsedTeamMembersData[i])
    if (!member.success) throw member.error
    const user = userSchema.safeParse(parsedUsersData.find(uu => uu.id === member.data.userId))
    const team = teamSchema.safeParse(parsedTeamsData.find(tt => tt.id === member.data.teamId))
    if (!user.success) throw user.error
    if (!team.success) throw team.error
    spinner.text = `Migrating ${i} of ${total} [member=${JSON.stringify(member)}]`;
    await processTeamMemberToClerk(spinner, member.data, user.data, team.data)
  }

  spinner.succeed(`Migration complete`);
  return;
}

await main()

console.log(`${migrated} team members migrated`);
console.log(`${alreadyExists} team members already failed to upload`);
