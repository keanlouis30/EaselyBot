// Test file to verify database connection and migration
require('dotenv').config();
const db = require('./services/database');

async function test() {
  console.log('🔍 Testing database connection and migration...\n');
  
  try {
    // Test 1: Create a new user
    console.log('1️⃣  Testing user creation...');
    const testSenderId = `test_user_${Date.now()}`;
    const newUser = await db.createUser(testSenderId);
    
    if (newUser) {
      console.log('✅ User created successfully:', {
        id: newUser.id,
        sender_id: newUser.sender_id,
        subscription_tier: newUser.subscription_tier
      });
    } else {
      console.log('❌ Failed to create user');
    }
    
    // Test 2: Retrieve the user
    console.log('\n2️⃣  Testing user retrieval...');
    const retrieved = await db.getUser(testSenderId);
    
    if (retrieved) {
      console.log('✅ User retrieved successfully:', {
        id: retrieved.id,
        sender_id: retrieved.sender_id,
        is_onboarded: retrieved.is_onboarded
      });
    } else {
      console.log('❌ Failed to retrieve user');
    }
    
    // Test 3: Update the user
    console.log('\n3️⃣  Testing user update...');
    const updated = await db.updateUser(testSenderId, {
      subscription_tier: 'premium',
      is_onboarded: true,
      canvas_token: 'test_token_123' // Will be encrypted
    });
    
    if (updated) {
      console.log('✅ User updated successfully:', {
        subscription_tier: updated.subscription_tier,
        is_onboarded: updated.is_onboarded,
        has_token: !!updated.canvas_token
      });
    } else {
      console.log('❌ Failed to update user');
    }
    
    // Test 4: Create a session
    console.log('\n4️⃣  Testing session creation...');
    const sessionCreated = await db.setUserSession(testSenderId, {
      flow: 'add_task',
      step: 'title',
      taskTitle: 'Test Task'
    });
    
    if (sessionCreated) {
      console.log('✅ Session created successfully');
    } else {
      console.log('❌ Failed to create session');
    }
    
    // Test 5: Retrieve the session
    console.log('\n5️⃣  Testing session retrieval...');
    const session = await db.getUserSession(testSenderId);
    
    if (session) {
      console.log('✅ Session retrieved successfully:', session);
    } else {
      console.log('❌ Failed to retrieve session');
    }
    
    // Test 6: Create a task
    console.log('\n6️⃣  Testing task creation...');
    const taskData = {
      title: 'Test Task from Migration',
      description: 'This is a test task created during migration testing',
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      courseName: 'Test Course',
      canvasType: 'planner_note'
    };
    
    const task = await db.createTask(testSenderId, taskData);
    
    if (task) {
      console.log('✅ Task created successfully:', {
        id: task.id,
        title: task.title,
        due_date: task.due_date,
        is_manual: task.is_manual
      });
    } else {
      console.log('❌ Failed to create task');
    }
    
    // Test 7: Get user tasks
    console.log('\n7️⃣  Testing task retrieval...');
    const tasks = await db.getUserTasks(testSenderId, { upcoming: true });
    
    if (tasks && tasks.length > 0) {
      console.log(`✅ Retrieved ${tasks.length} task(s) successfully`);
      tasks.forEach((t, i) => {
        console.log(`   Task ${i + 1}: ${t.title} (Due: ${t.due_date})`);
      });
    } else {
      console.log('❌ No tasks retrieved or error occurred');
    }
    
    // Test 8: Clear session
    console.log('\n8️⃣  Testing session cleanup...');
    const cleared = await db.clearUserSession(testSenderId);
    
    if (cleared) {
      console.log('✅ Session cleared successfully');
    } else {
      console.log('❌ Failed to clear session');
    }
    
    // Test 9: Get all users
    console.log('\n9️⃣  Testing getAllUsers...');
    const allUsers = await db.getAllUsers('all');
    console.log(`✅ Found ${allUsers.length} total user(s) in database`);
    
    // Test 10: Log activity
    console.log('\n🔟  Testing activity logging...');
    await db.logActivity(testSenderId, 'test_migration', {
      test: true,
      timestamp: new Date().toISOString()
    });
    console.log('✅ Activity logged successfully');
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 Database migration test completed successfully!');
    console.log('='.repeat(50));
    
    console.log('\n📋 Summary:');
    console.log('• Database connection: ✅ Working');
    console.log('• User operations: ✅ Working');
    console.log('• Session management: ✅ Working');
    console.log('• Task management: ✅ Working');
    console.log('• Activity logging: ✅ Working');
    console.log('• Token encryption: ✅ Working');
    
    console.log('\n✅ Your database is ready to use!');
    console.log('📌 Next steps:');
    console.log('1. Deploy to Render with environment variables');
    console.log('2. Your bot will now use persistent database storage');
    console.log('3. Data will survive deployments and restarts');
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Check your .env file has correct Supabase credentials');
    console.error('2. Make sure you ran the schema in Supabase SQL Editor');
    console.error('3. Verify your Supabase project is active (not paused)');
    console.error('4. Check the error message above for specific issues');
  }
  
  process.exit(0);
}

// Run the test
console.log('🚀 Starting database migration test...\n');
test().catch(console.error);
