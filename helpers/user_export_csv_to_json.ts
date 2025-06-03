#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';

interface CSVRow {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  primary_email_address: string;
  primary_phone_number: string;
  verified_email_addresses: string;
  unverified_email_addresses: string;
  verified_phone_numbers: string;
  unverified_phone_numbers: string;
  totp_secret: string;
  password_digest: string;
  password_hasher: string;
}

interface UserRecord {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  passwordHasher?: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  line = line.trim();
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function csvToJson(csvFilePath: string, outputPath: string): void {
  try {
    console.log(`Reading CSV file: ${csvFilePath}`);
    const csvContent = readFileSync(csvFilePath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }
    
    const headers = parseCSVLine(lines[0]).map(h => h.trim());
    console.log('Headers found:', headers);
    
    const users: UserRecord[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      
      if (values.length !== headers.length) {
        console.warn(`Row ${i + 1} has ${values.length} values but expected ${headers.length}. Continuing with available data...`);
      }
      
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      const user: UserRecord = {
        userId: row.id || '',
        email: row.primary_email_address || '',
      };
      
      if (row.first_name && row.first_name.trim() !== '') {
        user.firstName = row.first_name.trim();
      }
      
      if (row.last_name && row.last_name.trim() !== '') {
        user.lastName = row.last_name.trim();
      }
      
      if (row.password_digest && row.password_digest.trim() !== '') {
        user.password = row.password_digest.trim();
      }
      
      if (row.password_hasher && row.password_hasher.trim() !== '') {
        user.passwordHasher = row.password_hasher.trim();
      }
      
      if (!user.userId || !user.email) {
        console.warn(`Row ${i + 1} missing required userId or email. Skipping...`);
        continue;
      }
      
      users.push(user);
    }
    
    console.log(`Processed ${users.length} users`);
    
    const jsonOutput = JSON.stringify(users, null, 2);
    writeFileSync(outputPath, jsonOutput, 'utf-8');
    
    console.log(`✅ Successfully converted CSV to JSON!`);
    console.log(`📁 Output file: ${outputPath}`);
    console.log(`👥 Total users: ${users.length}`);
    
    if (users.length > 0) {
      console.log('\n📋 Sample of converted users:');
      console.log(JSON.stringify(users.slice(0, 3), null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error converting CSV to JSON:', error);
    process.exit(1);
  }
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: node helpers/user_export_csv_to_json.ts <csv-file-path> [output-path]');
    console.log('');
    console.log('Examples:');
    console.log('  node helpers/user_export_csv_to_json.ts users.csv');
    console.log('  node helpers/user_export_csv_to_json.ts users.csv output/users.json');
    process.exit(1);
  }
  
  const csvFilePath = args[0];
  const outputPath = args[1] || 'users.json';
  
  csvToJson(csvFilePath, outputPath);
}

if (process.argv[1]?.endsWith('user_export_csv_to_json.ts')) {
  main();
}

export { csvToJson };
