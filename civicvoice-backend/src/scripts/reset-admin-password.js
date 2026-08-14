#!/usr/bin/env node

/**
 * reset-admin-password.js
 * -----------------------------------------------------------------------------
 * Standalone "break glass" recovery script for administrative accounts.
 * Bypasses normal web-facing API endpoints and updates credentials directly in DB.
 * Connects directly using configuration variables loaded from the env.
 * 
 * Usage:
 *  - Interactive prompt fallback (Recommended, avoids shell history leaks):
 *    node src/scripts/reset-admin-password.js
 * 
 *  - CLI flags:
 *    node src/scripts/reset-admin-password.js --id ADM-1001 --newPassword tempPassword123
 * 
 * Security:
 *  - Only runnable directly on the server by someone with database access.
 *  - Forces "passwordResetRequested: true" to compel the admin to update details on login.
 *  - Bumps "tokenVersion" to instantly force invalidation of active sessions/tokens.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const connectDB = require('../config/db');
const User = require('../models/User');

// Parse CLI args
const args = process.argv.slice(2);
let adminIdArg = null;
let newPasswordArg = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--id' && args[i + 1]) {
    adminIdArg = args[i + 1];
    i++;
  } else if (args[i] === '--newPassword' && args[i + 1]) {
    newPasswordArg = args[i + 1];
    i++;
  }
}

async function promptInput(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function runReset() {
  let adminId = adminIdArg;
  let newPassword = newPasswordArg;

  if (!adminId || !newPassword) {
    console.log('\n--- CivicVoice Break-Glass Admin Password Recovery Tool ---');
    console.log('Ensure this script is run only by authorized personnel with direct server/DB access.');
    
    if (!adminId) {
      adminId = await promptInput('\nEnter Administrator ID or Email address: ');
    }
    
    if (!newPassword) {
      newPassword = await promptInput('Enter New Password (will display in cleartext): ');
    }
  }

  if (!adminId || !newPassword) {
    console.error('Error: Admin ID/Email and New Password are both required.');
    process.exit(1);
  }

  // Connect to DB
  console.log('Connecting to database...');
  await connectDB();

  try {
    const query = {
      $or: [
        { username: adminId.toLowerCase().trim() },
        { email: adminId.toLowerCase().trim() }
      ],
      role: { $in: ['admin', 'superadmin'] }
    };

    const user = await User.findOne(query);

    if (!user) {
      console.error(`Error: Admin/Superadmin account matching "${adminId}" not found in database.`);
      process.exit(1);
    }

    console.log(`Matching account found: ${user.name} (${user.username.toUpperCase()}) - Role: ${user.role}`);
    
    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update user
    user.passwordHash = passwordHash;
    user.passwordResetRequested = true; // Force password change on next login
    user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate current JWT sessions
    await user.save();

    console.log('Password updated successfully!');
    console.log('Account is set to require password change on next login.');
    console.log('Prior active login sessions have been invalidated.');

    // Log to local audit log
    const auditLogPath = path.join(__dirname, '../../recovery-audit.log');
    const logEntry = `[${new Date().toISOString()}] PASSWORD RESET: Account "${user.username}" (${user.email}) recovered via CLI tool. tokenVersion bumped to ${user.tokenVersion}\n`;
    fs.appendFileSync(auditLogPath, logEntry, 'utf8');
    
    console.log(`Recovery event appended to ${auditLogPath}`);

  } catch (err) {
    console.error('Failed to reset password:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Database disconnected.');
  }
}

runReset().catch((err) => {
  console.error('Unhandled script failure:', err);
  process.exit(1);
});
