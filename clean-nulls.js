const fs = require('fs');
const path = require('path');

// Read the users.json file
const filePath = path.join(__dirname, 'users.json');
const usersData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Process each user object to remove null values
const cleanedUsers = usersData.map((user) => {
  // Keep only non-null properties
  return Object.fromEntries(
    Object.entries(user).filter(([_, value]) => value !== null)
  );
});

// Write the cleaned data back to the file
fs.writeFileSync(filePath, JSON.stringify(cleanedUsers, null, 2), 'utf8');

console.log(`Processed ${usersData.length} users.`);

// Count removed properties
const originalProps = usersData.reduce(
  (sum, user) => sum + Object.values(user).filter((v) => v === null).length,
  0
);

console.log(`Removed ${originalProps} null properties.`);
