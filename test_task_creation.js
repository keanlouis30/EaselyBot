const axios = require('axios');
const crypto = require('crypto');

// Test environment variables
const APP_SECRET = process.env.APP_SECRET || '8ece01cd54dfdbb847c59d5d427a293e';
const TEST_WEBHOOK_URL = 'http://localhost:5000/webhook';

function createSignature(payload) {
  return 'sha256=' + crypto
    .createHmac('sha256', APP_SECRET)
    .update(payload, 'utf8')
    .digest('hex');
}

async function testTaskCreationFlow() {
  const senderId = 'TEST_USER_123';
  
  console.log('🧪 Testing task creation flow that gets stuck...\n');
  
  // Step 1: Add New Task (should set session to flow: 'add_task', step: 'title')
  console.log('1️⃣  Simulating: ADD_NEW_TASK');
  const addTaskPayload = JSON.stringify({
    object: 'page',
    entry: [{
      messaging: [{
        sender: { id: senderId },
        postback: { payload: 'ADD_NEW_TASK' }
      }]
    }]
  });
  
  await axios.post(TEST_WEBHOOK_URL, addTaskPayload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': createSignature(addTaskPayload)
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Step 2: Send task title
  console.log('2️⃣  Simulating: "test task"');
  const titlePayload = JSON.stringify({
    object: 'page',
    entry: [{
      messaging: [{
        sender: { id: senderId },
        message: { text: 'test task' }
      }]
    }]
  });
  
  await axios.post(TEST_WEBHOOK_URL, titlePayload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': createSignature(titlePayload)
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Step 3: Select Personal course
  console.log('3️⃣  Simulating: SELECT_COURSE_PERSONAL');
  const coursePayload = JSON.stringify({
    object: 'page',
    entry: [{
      messaging: [{
        sender: { id: senderId },
        message: { 
          quick_reply: { payload: 'SELECT_COURSE_PERSONAL' }
        }
      }]
    }]
  });
  
  await axios.post(TEST_WEBHOOK_URL, coursePayload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': createSignature(coursePayload)
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Step 4: Send description
  console.log('4️⃣  Simulating: "test description"');
  const descPayload = JSON.stringify({
    object: 'page',
    entry: [{
      messaging: [{
        sender: { id: senderId },
        message: { text: 'test description' }
      }]
    }]
  });
  
  await axios.post(TEST_WEBHOOK_URL, descPayload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': createSignature(descPayload)
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Step 5: Select Tomorrow date
  console.log('5️⃣  Simulating: TASK_DATE_TOMORROW');
  const datePayload = JSON.stringify({
    object: 'page',
    entry: [{
      messaging: [{
        sender: { id: senderId },
        message: { 
          quick_reply: { payload: 'TASK_DATE_TOMORROW' }
        }
      }]
    }]
  });
  
  await axios.post(TEST_WEBHOOK_URL, datePayload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': createSignature(datePayload)
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Step 6: Select 11:59 PM time (this is where it gets stuck)
  console.log('6️⃣  Simulating: TASK_TIME_11_59PM (where it gets stuck)');
  const timePayload = JSON.stringify({
    object: 'page',
    entry: [{
      messaging: [{
        sender: { id: senderId },
        message: { 
          quick_reply: { payload: 'TASK_TIME_11_59PM' }
        }
      }]
    }]
  });
  
  await axios.post(TEST_WEBHOOK_URL, timePayload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': createSignature(timePayload)
    }
  });
  
  console.log('\n✅ Test completed! Check the server logs for detailed output.');
  console.log('📋 Look for the emoji logs to trace the execution flow.');
}

if (require.main === module) {
  testTaskCreationFlow().catch(console.error);
}

module.exports = { testTaskCreationFlow };
