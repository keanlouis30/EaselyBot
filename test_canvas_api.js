// Test Canvas API endpoints to debug task creation
console.log('=== Canvas API Debug Test ===');

const axios = require('axios');

// You'll need to replace this with your actual Canvas token and URL for testing
const CANVAS_TOKEN = 'YOUR_CANVAS_TOKEN_HERE';
const CANVAS_URL = 'https://dlsu.instructure.com';

async function testCanvasAPI() {
  if (CANVAS_TOKEN === 'YOUR_CANVAS_TOKEN_HERE') {
    console.log('⚠️  Please replace CANVAS_TOKEN with your actual token in this test file');
    return;
  }
  
  console.log('🌐 Testing Canvas API endpoints...');
  console.log('📍 Canvas URL:', CANVAS_URL);
  
  try {
    // Test 1: Basic user info
    console.log('\n--- Test 1: User Info ---');
    const userResponse = await axios.get(`${CANVAS_URL}/api/v1/users/self`, {
      headers: { 'Authorization': `Bearer ${CANVAS_TOKEN}` }
    });
    console.log('✅ User API works');
    console.log('👤 User:', userResponse.data.name);
    console.log('🆔 User ID:', userResponse.data.id);
    
    // Test 2: Planner Notes
    console.log('\n--- Test 2: Planner Notes ---');
    try {
      const plannerResponse = await axios.get(`${CANVAS_URL}/api/v1/planner_notes`, {
        headers: { 'Authorization': `Bearer ${CANVAS_TOKEN}` },
        params: { per_page: 5 }
      });
      console.log('✅ Planner Notes API accessible');
      console.log('📝 Current planner notes count:', plannerResponse.data.length);
      
      // Test creating a planner note
      console.log('\n--- Test 2b: Create Planner Note ---');
      const testNote = {
        title: 'Test Note from EaselyBot',
        details: 'This is a test note created by EaselyBot API test',
        todo_date: new Date().toISOString()
      };
      
      const createResponse = await axios.post(`${CANVAS_URL}/api/v1/planner_notes`, testNote, {
        headers: { 
          'Authorization': `Bearer ${CANVAS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ Planner Note created successfully!');
      console.log('📝 Created note ID:', createResponse.data.id);
      console.log('💡 Check your Canvas Dashboard > Planner to see the test note');
      
    } catch (plannerError) {
      console.log('❌ Planner Notes API failed');
      console.log('Status:', plannerError.response?.status);
      console.log('Error:', plannerError.response?.data);
    }
    
    // Test 3: Calendar Events
    console.log('\n--- Test 3: Calendar Events ---');
    try {
      const calendarResponse = await axios.get(`${CANVAS_URL}/api/v1/calendar_events`, {
        headers: { 'Authorization': `Bearer ${CANVAS_TOKEN}` },
        params: { per_page: 5 }
      });
      console.log('✅ Calendar Events API accessible');
      console.log('📅 Current calendar events count:', calendarResponse.data.length);
      
    } catch (calendarError) {
      console.log('❌ Calendar Events API failed');
      console.log('Status:', calendarError.response?.status);
      console.log('Error:', calendarError.response?.data);
    }
    
    // Test 4: Courses
    console.log('\n--- Test 4: Courses ---');
    try {
      const coursesResponse = await axios.get(`${CANVAS_URL}/api/v1/courses`, {
        headers: { 'Authorization': `Bearer ${CANVAS_TOKEN}` },
        params: { enrollment_state: 'active', per_page: 10 }
      });
      console.log('✅ Courses API accessible');
      console.log('📚 Active courses count:', coursesResponse.data.length);
      coursesResponse.data.slice(0, 3).forEach(course => {
        console.log(`   - ${course.name} (ID: ${course.id})`);
      });
      
    } catch (coursesError) {
      console.log('❌ Courses API failed');
      console.log('Status:', coursesError.response?.status);
      console.log('Error:', coursesError.response?.data);
    }
    
  } catch (error) {
    console.log('❌ Basic Canvas API test failed');
    console.log('Error:', error.message);
    console.log('Response:', error.response?.data);
  }
  
  console.log('\n=== Canvas API Test Complete ===');
  console.log('💡 If Planner Notes worked, your tasks should appear in:');
  console.log('   • Canvas Dashboard > Planner');  
  console.log('   • Canvas Dashboard > To-Do list');
  console.log('   • Canvas Mobile app > Planner');
}

// Run the test
testCanvasAPI().catch(console.error);
