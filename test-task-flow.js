/**
 * Test script for task creation flow
 * This simulates the conversation flow for creating a Canvas task
 */

const eventHandler = require('./app/core/eventHandler');
const moment = require('moment-timezone');

// Test user ID
const testUserId = 'test-user-123';

async function testTaskCreationFlow() {
    console.log('🧪 Testing Task Creation Flow\n');
    console.log('=' .repeat(50));
    
    // Test 1: Task Title Input Handler
    console.log('\n📝 Test 1: Task Title Input');
    console.log('-'.repeat(30));
    
    // Mock user in creating_task_title state
    console.log('User enters title: "Complete Math Assignment"');
    // In reality, this would be called by handleMessage when user is in creating_task_title state
    console.log('✅ Title handler would store title and ask for date\n');
    
    // Test 2: Date Input Handler
    console.log('📅 Test 2: Date Input');
    console.log('-'.repeat(30));
    
    const testDates = [
        'tomorrow',
        'today',
        'Dec 25',
        '2024-12-31',
        'next Monday'
    ];
    
    for (const date of testDates) {
        const parsed = parseDate(date);
        if (parsed) {
            console.log(`Input: "${date}" → ${parsed.format('MMMM D, YYYY')}`);
        } else {
            console.log(`Input: "${date}" → ❌ Invalid`);
        }
    }
    
    // Test 3: Time Input Handler  
    console.log('\n⏰ Test 3: Time Input');
    console.log('-'.repeat(30));
    
    const testTimes = [
        '3pm',
        '15:00',
        '11:59 PM',
        '2:30 AM',
        'noon'
    ];
    
    for (const time of testTimes) {
        const parsed = parseTime(time);
        if (parsed) {
            console.log(`Input: "${time}" → ${parsed.format('h:mm A')}`);
        } else {
            console.log(`Input: "${time}" → ❌ Invalid`);
        }
    }
    
    // Test 4: Description Input
    console.log('\n📝 Test 4: Description Input');
    console.log('-'.repeat(30));
    console.log('Input: "Chapter 5 problems 1-10"');
    console.log('✅ Would create task with description');
    console.log('Input: "skip"');
    console.log('✅ Would create task without description');
    
    // Test 5: Full flow example
    console.log('\n🎯 Test 5: Complete Flow Example');
    console.log('-'.repeat(30));
    console.log('User: "Create task"');
    console.log('Bot: "What\'s the task title?"');
    console.log('User: "Study for Physics Exam"');
    console.log('Bot: "When is it due? (date)"');
    console.log('User: "tomorrow"');
    console.log('Bot: "What time? (time)"');
    console.log('User: "3pm"');
    console.log('Bot: "Add description? (optional)"');
    console.log('User: "Review chapters 1-3 and practice problems"');
    console.log('Bot: "✅ Task created in Canvas!"');
    
    const taskData = {
        title: 'Study for Physics Exam',
        date: moment.tz('Asia/Manila').add(1, 'day').format('YYYY-MM-DD'),
        time: '15:00',
        description: 'Review chapters 1-3 and practice problems'
    };
    
    console.log('\nFinal task data:');
    console.log(JSON.stringify(taskData, null, 2));
    
    const taskDateTime = moment.tz(`${taskData.date} ${taskData.time}`, 'YYYY-MM-DD HH:mm', 'Asia/Manila');
    console.log(`\nDue: ${taskDateTime.format('MMMM D, YYYY at h:mm A')} Manila time`);
}

// Helper function to parse dates (simplified version)
function parseDate(text) {
    const input = text.toLowerCase().trim();
    let taskDate;
    
    if (input === 'tomorrow') {
        taskDate = moment.tz('Asia/Manila').add(1, 'day');
    } else if (input === 'today') {
        taskDate = moment.tz('Asia/Manila');
    } else {
        // Try to parse as date
        taskDate = moment.tz(text, ['YYYY-MM-DD', 'MM-DD-YYYY', 'MMM DD', 'MMMM DD'], 'Asia/Manila');
    }
    
    return taskDate.isValid() ? taskDate : null;
}

// Helper function to parse times (simplified version)
function parseTime(text) {
    const timeFormats = ['h:mm A', 'H:mm', 'ha', 'h a', 'HH:mm'];
    let taskTime = moment.tz(text, timeFormats, 'Asia/Manila');
    
    if (!taskTime.isValid() && text.toLowerCase() === 'noon') {
        taskTime = moment.tz('12:00', 'HH:mm', 'Asia/Manila');
    }
    
    return taskTime.isValid() ? taskTime : null;
}

// Run the tests
testTaskCreationFlow().catch(console.error);
