require('dotenv').config();
const db = require('./services/database');

async function debugTasks() {
  console.log('🔍 Debug: Checking database tasks...');
  
  try {
    // Test with a sample sender ID (replace with your actual Facebook sender ID)
    const sampleSenderId = 'test_user_id';
    
    console.log('\n📊 Database connection test...');
    
    // Try to get user
    const user = await db.getUser(sampleSenderId);
    console.log('User found:', user ? 'Yes' : 'No');
    
    if (user) {
      console.log('User ID:', user.id);
      console.log('User canvas_token exists:', !!user.canvas_token);
      console.log('User is_onboarded:', user.is_onboarded);
      
      // Get all tasks for this user
      console.log('\n📝 All tasks for this user:');
      const allTasks = await db.getUserTasks(sampleSenderId, {});
      console.log('Total tasks found:', allTasks.length);
      
      allTasks.forEach((task, index) => {
        console.log(`  ${index + 1}. "${task.title}"`);
        console.log(`     Due: ${task.due_date}`);
        console.log(`     Due (parsed): ${new Date(task.due_date).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
        console.log(`     Manual: ${task.is_manual}`);
        console.log(`     Course: ${task.course_name}`);
        console.log('');
      });
      
      // Test all different query types
      console.log('\n🔥 Tasks due today:');
      const todayTasks = await db.getUserTasks(sampleSenderId, { dueToday: true });
      console.log('Tasks due today:', todayTasks.length);
      todayTasks.forEach((task, index) => {
        console.log(`  ${index + 1}. "${task.title}" - ${new Date(task.due_date).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
      });
      
      console.log('\n📅 Tasks due this week (upcoming 7 days):');
      const weekTasks = await db.getUserTasks(sampleSenderId, { upcoming: true, daysAhead: 7 });
      console.log('Tasks due this week:', weekTasks.length);
      weekTasks.forEach((task, index) => {
        console.log(`  ${index + 1}. "${task.title}" - ${new Date(task.due_date).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
      });
      
      console.log('\n⚠ Overdue tasks:');
      const overdueTasks = await db.getUserTasks(sampleSenderId, { overdue: true });
      console.log('Overdue tasks:', overdueTasks.length);
      overdueTasks.forEach((task, index) => {
        console.log(`  ${index + 1}. "${task.title}" - ${new Date(task.due_date).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
      });
      
      console.log('\n🗓 All upcoming tasks (next 30 days):');
      const allUpcoming = await db.getUserTasks(sampleSenderId, { upcoming: true, daysAhead: 30 });
      console.log('All upcoming tasks:', allUpcoming.length);
      allUpcoming.forEach((task, index) => {
        console.log(`  ${index + 1}. "${task.title}" - ${new Date(task.due_date).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
      });
      
    } else {
      console.log('❌ No user found. Create a user first by interacting with the bot.');
    }
    
    // Show current Manila time for reference
    console.log('\n⏰ Current Manila time:', new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    console.log('Current UTC time:', new Date().toISOString());
    
  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
  
  process.exit(0);
}

debugTasks();
