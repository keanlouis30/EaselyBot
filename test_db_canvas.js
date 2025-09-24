require('dotenv').config();
const db = require('./services/database');

async function testDatabaseConnection() {
  console.log('🔧 Testing database connection...');
  
  try {
    // Test basic database connectivity
    const { data, error } = await db.supabase
      .from('users')
      .select('*')
      .limit(1);
      
    if (error) {
      console.error('❌ Database connection failed:', error);
      return false;
    }
    
    console.log('✅ Database connection successful');
    return true;
  } catch (err) {
    console.error('❌ Database connection error:', err);
    return false;
  }
}

async function testCanvasConnection() {
  console.log('🎯 Testing Canvas API endpoint...');
  
  const axios = require('axios');
  const canvasUrl = process.env.CANVAS_BASE_URL || 'https://dlsu.instructure.com';
  
  try {
    // Test Canvas API base endpoint (should return 401 without token, which is expected)
    const response = await axios.get(`${canvasUrl}/api/v1/users/self`, {
      timeout: 10000,
      validateStatus: (status) => status < 500 // Accept 4xx errors as "reachable"
    });
    
    console.log(`✅ Canvas API reachable (HTTP ${response.status})`);
    return true;
  } catch (err) {
    console.error('❌ Canvas API connection failed:', err.message);
    return false;
  }
}

async function testUserSession() {
  console.log('👤 Testing user session management...');
  
  const testUserId = 'TEST_USER_123';
  
  try {
    // Create a test user if it doesn't exist
    let user = await db.getUser(testUserId);
    if (!user) {
      console.log('Creating test user...');
      user = await db.createUser(testUserId);
    }
    
    if (!user) {
      console.error('❌ Failed to create test user');
      return false;
    }
    
    console.log('✅ User created/found:', user.sender_id);
    
    // Test session management
    const sessionData = {
      flow: 'add_task',
      step: 'time',
      taskTitle: 'Test Task',
      description: 'Test Description',
      courseName: 'Personal',
      courseId: null,
      taskDate: new Date()
    };
    
    const sessionSet = await db.setUserSession(testUserId, sessionData);
    if (!sessionSet) {
      console.error('❌ Failed to set user session');
      return false;
    }
    
    const retrievedSession = await db.getUserSession(testUserId);
    if (!retrievedSession) {
      console.error('❌ Failed to retrieve user session');
      return false;
    }
    
    console.log('✅ Session management working:', retrievedSession.flow);
    
    // Clean up
    await db.clearUserSession(testUserId);
    
    return true;
  } catch (err) {
    console.error('❌ Session test failed:', err);
    return false;
  }
}

async function main() {
  console.log('🧪 Running connectivity tests...\n');
  
  const dbOk = await testDatabaseConnection();
  console.log('');
  
  const canvasOk = await testCanvasConnection();
  console.log('');
  
  const sessionOk = await testUserSession();
  console.log('');
  
  if (dbOk && canvasOk && sessionOk) {
    console.log('✅ All tests passed! The issue is likely in the task creation logic.');
  } else {
    console.log('❌ Some tests failed. This could explain why task creation gets stuck.');
  }
}

if (require.main === module) {
  main().catch(console.error);
}
