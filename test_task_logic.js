require('dotenv').config();
const db = require('./services/database');

// Mock the required functions from index.js
async function mockGetUser(senderId) {
  return await db.getUser(senderId);
}

async function mockCreateUser(senderId) {
  return await db.createUser(senderId);
}

async function mockGetUserSession(senderId) {
  return await db.getUserSession(senderId);
}

async function mockSetUserSession(senderId, sessionData) {
  return await db.setUserSession(senderId, sessionData);
}

async function mockClearUserSession(senderId) {
  return await db.clearUserSession(senderId);
}

// Mock the date/time functions (FIXED for Manila timezone)
function getManilaDate(date = new Date()) {
  // Get the current Manila time using proper timezone conversion
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find(p => p.type === 'year').value);
  const month = parseInt(parts.find(p => p.type === 'month').value);
  const day = parseInt(parts.find(p => p.type === 'day').value);
  const hour = parseInt(parts.find(p => p.type === 'hour').value);
  const minute = parseInt(parts.find(p => p.type === 'minute').value);
  
  // Create a proper Manila time Date object
  return buildManilaDateFromParts({ year, month, day, hour, minute });
}

function buildManilaDateFromParts({ year, month, day, hour = 17, minute = 0 }) {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return new Date(`${y}-${m}-${d}T${hh}:${mm}:00+08:00`);
}

function combineDateAndTime(dateObj, timeObj) {
  // Extract date parts in Manila timezone using Intl.DateTimeFormat
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(dateObj);
  const year = parseInt(parts.find(p => p.type === 'year').value);
  const month = parseInt(parts.find(p => p.type === 'month').value);
  const day = parseInt(parts.find(p => p.type === 'day').value);
  
  return buildManilaDateFromParts({
    year,
    month,
    day,
    hour: timeObj.hour,
    minute: timeObj.minute
  });
}

function formatDateTimeManila(date) {
  return date.toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// Mock sendMessage function
async function mockSendMessage(messageData) {
  console.log('📤 Would send message:', messageData.message.text);
}

// Mock sendWelcomeMessage function  
async function mockSendWelcomeMessage(senderId) {
  console.log(`🏠 Would send welcome message to ${senderId}`);
}

// Mock createCanvasPlannerNote (simulate it failing)
async function mockCreateCanvasPlannerNote(senderId, taskData) {
  console.log(`🎯 Mock createCanvasPlannerNote called for user ${senderId}:`, {
    title: taskData.title,
    dueDate: taskData.dueDate.toISOString(),
    course: taskData.courseName
  });
  
  // Simulate Canvas failure (no Canvas token)
  console.log('❌ Simulating Canvas creation failure (no token)');
  return null;
}

// Simplified version of handleTaskTimeQuickReply for testing
async function testHandleTaskTimeQuickReply(senderId, hour, minute) {
  console.log(`⏰ Processing time selection for user ${senderId}: ${hour}:${minute}`);
  
  const session = await mockGetUserSession(senderId);
  if (!session || session.flow !== 'add_task' || session.step !== 'time' || !session.taskDate) {
    console.error(`❌ Invalid session state for user ${senderId}:`, {
      hasSession: !!session,
      flow: session?.flow,
      step: session?.step,
      hasTaskDate: !!session?.taskDate
    });
    return false;
  }
  
  console.log(`📝 Task details:`, {
    title: session.taskTitle,
    description: session.description,
    course: session.courseName,
    courseId: session.courseId,
    taskDate: session.taskDate
  });
  
  try {
    // Ensure taskDate is a Date object (it might be stored as string in database)
    const taskDate = session.taskDate instanceof Date ? session.taskDate : new Date(session.taskDate);
    console.log(`📅 Retrieved task date:`, taskDate.toISOString());
    
    // Combine stored date with selected time
    const finalDateTime = combineDateAndTime(taskDate, { hour, minute });
    console.log(`🗓️ Final task date/time: ${finalDateTime.toISOString()}`);
    
    // Send immediate acknowledgment to user
    await mockSendMessage({
      recipient: { id: senderId },
      message: { text: `⏳ Creating your task "${session.taskTitle}"...` }
    });
    
    // Create the task in Canvas using Planner Notes
    console.log(`🔄 Starting Canvas task creation for user ${senderId}`);
    const createdTask = await mockCreateCanvasPlannerNote(senderId, {
      title: session.taskTitle,
      description: session.description || '',
      dueDate: finalDateTime,
      courseId: session.courseId || null,
      courseName: session.courseName || 'Personal'
    });
    
    if (createdTask) {
      console.log(`✅ Canvas task created successfully:`, createdTask.title);
      
      // If task was successfully created in Canvas, also store it in database
      try {
        await db.createTask(senderId, createdTask);
        console.log(`💾 Task '${createdTask.title}' stored in database for user ${senderId}`);
      } catch (dbError) {
        console.error('❌ Database storage failed:', dbError);
        // Still continue even if database storage fails
      }
    } else {
      console.warn(`⚠️ Canvas task creation failed, creating local fallback task`);
      
      // Create a fallback local task when Canvas creation fails
      const fallbackTask = {
        title: session.taskTitle,
        dueDate: finalDateTime,
        course: session.courseName || 'Personal',
        courseId: session.courseId || null,
        description: session.description || '',
        createdAt: new Date().toISOString(),
        isManual: true,
        canvasId: null,
        canvasType: null // NULL for local-only tasks
      };
      
      try {
        await db.createTask(senderId, fallbackTask);
        console.log(`💾 Fallback task stored in database for user ${senderId}`);
        
        // Send success message with note about Canvas sync failure
        await mockSendMessage({
          recipient: { id: senderId },
          message: { 
            text: `✅ Task "${session.taskTitle}" created successfully!\\n\\n🗓️ Due: ${formatDateTimeManila(finalDateTime)}\\n💻 Course: ${session.courseName || 'Personal'}\\n\\n⚠️ Note: Could not sync to Canvas Dashboard. You may need to add it manually to Canvas if needed.` 
          }
        });
      } catch (dbError) {
        console.error('❌ Fallback task creation also failed:', dbError);
        
        // Last resort: just acknowledge the task was received
        await mockSendMessage({
          recipient: { id: senderId },
          message: { 
            text: `❌ Sorry, I couldn't save your task "${session.taskTitle}" to the system. Please add it manually to Canvas.\\n\\n🗓️ Due: ${formatDateTimeManila(finalDateTime)}\\n💻 Course: ${session.courseName || 'Personal'}` 
          }
        });
      }
    }
    
  } catch (error) {
    console.error(`💥 Unexpected error in handleTaskTimeQuickReply for user ${senderId}:`, error);
    
    // Send error message to user
    await mockSendMessage({
      recipient: { id: senderId },
      message: { 
        text: `❌ Sorry, there was an error creating your task "${session.taskTitle}". Please try again or add it manually to Canvas.` 
      }
    });
  } finally {
    // Always clean up session and show welcome message
    console.log(`🧹 Cleaning up session for user ${senderId}`);
    await mockClearUserSession(senderId);
    
    // Show updated task list after a moment
    setTimeout(async () => {
      console.log(`🏠 Showing welcome message to user ${senderId}`);
      await mockSendWelcomeMessage(senderId);
    }, 1000);
  }
  
  return true;
}

async function setupTestUser() {
  const testUserId = 'TEST_USER_TASK_123';
  
  console.log('🛠️ Setting up test user and session...');
  
  // Create test user
  let user = await mockGetUser(testUserId);
  if (!user) {
    user = await mockCreateUser(testUserId);
  }
  
  if (!user) {
    throw new Error('Failed to create test user');
  }
  
  // Set up session as if user went through the full task creation flow
  // Use proper Manila timezone for "today"
  const getManilaDateParts = (date) => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(date);
    return {
      year: parseInt(parts.find(p => p.type === 'year').value),
      month: parseInt(parts.find(p => p.type === 'month').value),
      day: parseInt(parts.find(p => p.type === 'day').value)
    };
  };
  
  const todayParts = getManilaDateParts(new Date());
  console.log('🗓️ Using today in Manila timezone:', todayParts);
  
  const sessionData = {
    flow: 'add_task',
    step: 'time',
    taskTitle: 'Test Task for Today (Manila)',
    description: 'This task should be due TODAY in Manila timezone',
    courseName: 'Personal',
    courseId: null,
    taskDate: buildManilaDateFromParts({
      year: todayParts.year,
      month: todayParts.month,
      day: todayParts.day,
      hour: 0,
      minute: 0
    })
  };
  
  const sessionSet = await mockSetUserSession(testUserId, sessionData);
  if (!sessionSet) {
    throw new Error('Failed to set user session');
  }
  
  console.log('✅ Test user and session ready');
  return testUserId;
}

async function main() {
  console.log('🧪 Testing task creation logic directly...\n');
  
  try {
    const testUserId = await setupTestUser();
    console.log('');
    
    // Test the problematic scenario: selecting 11:59 PM
    console.log('🕘 Simulating "⏰ 11:59 PM" selection...\n');
    
    const success = await testHandleTaskTimeQuickReply(testUserId, 23, 59);
    
    if (success) {
      console.log('\n✅ Task creation logic completed without getting stuck!');
      
      // Check if task was created in database
      const tasks = await db.getUserTasks(testUserId);
      console.log(`📋 Tasks in database: ${tasks.length}`);
      
      if (tasks.length > 0) {
        console.log('📝 Created task:', tasks[tasks.length - 1].title);
      }
    } else {
      console.log('\n❌ Task creation logic failed');
    }
    
  } catch (error) {
    console.error('💥 Test failed with error:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
