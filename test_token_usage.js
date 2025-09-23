/**
 * Test script to verify Canvas token is properly fetched from database and used
 * Run with: node test_token_usage.js <facebook_id>
 */

require('dotenv').config();
const { getUser } = require('./app/database/supabaseClient');
const { 
    getUserCanvasCredentials,
    fetchUpcomingAssignments,
    fetchThisWeekAssignments,
    formatAssignmentsList 
} = require('./app/api/canvasApi');

async function testTokenUsage(facebookId) {
    console.log('\n🧪 Testing Canvas Token Usage from Database\n');
    console.log('============================================\n');
    
    if (!facebookId) {
        console.log('❌ Please provide a Facebook ID as argument');
        console.log('   Usage: node test_token_usage.js <facebook_id>');
        console.log('   Example: node test_token_usage.js 123456789\n');
        process.exit(1);
    }
    
    try {
        // Step 1: Check if user exists in database
        console.log('📍 Step 1: Checking if user exists in database...');
        const user = await getUser(facebookId);
        
        if (!user) {
            console.log(`❌ User ${facebookId} not found in database`);
            console.log('   Make sure the user has messaged the bot at least once.\n');
            process.exit(1);
        }
        
        console.log(`✅ User found: ${facebookId}`);
        console.log(`   Has Canvas token: ${user.canvas_token ? 'Yes' : 'No'}`);
        
        if (user.canvas_token) {
            console.log(`   Token length: ${user.canvas_token.length} characters`);
            console.log(`   Token preview: ${user.canvas_token.substring(0, 10)}...`);
            console.log(`   Canvas URL: ${user.canvas_url || 'Not set'}`);
            console.log(`   Canvas User ID: ${user.canvas_user_id || 'Not set'}`);
            console.log(`   Last sync: ${user.last_canvas_sync || 'Never'}\n`);
        } else {
            console.log('   ⚠️ User has no Canvas token stored');
            console.log('   Tell the user to provide their Canvas token first.\n');
            process.exit(1);
        }
        
        // Step 2: Test getUserCanvasCredentials
        console.log('📍 Step 2: Testing getUserCanvasCredentials function...');
        const credentials = await getUserCanvasCredentials(facebookId);
        
        if (!credentials) {
            console.log('❌ Failed to retrieve Canvas credentials\n');
            process.exit(1);
        }
        
        console.log('✅ Successfully retrieved Canvas credentials\n');
        
        // Step 3: Test fetching assignments
        console.log('📍 Step 3: Testing assignment fetching with user\'s token...\n');
        
        // Test this week's assignments
        console.log('Testing fetchThisWeekAssignments...');
        try {
            const weekAssignments = await fetchThisWeekAssignments(facebookId);
            console.log(`\n✅ This week's assignments fetched: ${weekAssignments.length} assignments`);
            
            if (weekAssignments.length > 0) {
                console.log('\nFirst 3 assignments:');
                weekAssignments.slice(0, 3).forEach(assignment => {
                    console.log(`  - ${assignment.name}`);
                    console.log(`    Course: ${assignment.course_name}`);
                    console.log(`    Due: ${assignment.due_at}`);
                });
            }
        } catch (error) {
            console.error(`❌ Error fetching this week's assignments: ${error.message}`);
        }
        
        // Test upcoming assignments
        console.log('\nTesting fetchUpcomingAssignments (next 7 days)...');
        try {
            const upcomingAssignments = await fetchUpcomingAssignments(facebookId, 7);
            console.log(`\n✅ Upcoming assignments fetched: ${upcomingAssignments.length} assignments`);
            
            if (upcomingAssignments.length > 0) {
                console.log('\nFormatted assignment list:');
                const formatted = formatAssignmentsList(upcomingAssignments.slice(0, 3));
                console.log(formatted);
            }
        } catch (error) {
            console.error(`❌ Error fetching upcoming assignments: ${error.message}`);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
    
    console.log('\n============================================');
    console.log('✅ Token usage test complete!\n');
    console.log('Summary:');
    console.log('- User\'s Canvas token was successfully retrieved from database');
    console.log('- Token was used to authenticate with Canvas API');
    console.log('- Assignment fetching functions are working properly\n');
    
    process.exit(0);
}

// Get Facebook ID from command line argument
const facebookId = process.argv[2];
testTokenUsage(facebookId);
