#!/usr/bin/env node

/**
 * Cron job script to send reminders for upcoming deadlines
 * This should be run periodically (e.g., every hour) to check and send reminders
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const reminderService = require('../services/reminderService');

// Check for required environment variables
const requiredEnvVars = [
  'PAGE_ACCESS_TOKEN',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

console.log('========================================');
console.log('🔔 Reminder Job Started');
console.log('Time:', new Date().toISOString());
console.log('========================================\n');

async function main() {
  try {
    // Process all reminders
    const result = await reminderService.processReminders();
    
    console.log('\n========================================');
    console.log('✅ Reminder Job Completed Successfully');
    console.log('Results:');
    console.log(`  • Reminders Created: ${result.remindersCreated}`);
    console.log(`  • Reminders Processed: ${result.processed}`);
    console.log(`  • Successfully Sent: ${result.sent}`);
    console.log(`  • Failed: ${result.failed}`);
    console.log('========================================\n');
    
    // Exit with success code
    process.exit(0);
  } catch (error) {
    console.error('\n========================================');
    console.error('❌ Reminder Job Failed');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('========================================\n');
    
    // Exit with error code
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the main function
main();
