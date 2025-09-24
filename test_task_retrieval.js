require('dotenv').config();
const db = require('./services/database');

async function testTaskRetrieval() {
  console.log('🧪 Testing task retrieval after database migration fix...\n');
  
  const testUserId = `test_task_retrieval_${Date.now()}`;
  
  try {
    // 1. Create a test user
    console.log('1️⃣  Creating test user...');
    const user = await db.createUser(testUserId);
    console.log('✅ User created:', user.sender_id);
    
    // 2. Create a manual task in the database
    console.log('\n2️⃣  Creating manual task in database...');
    const taskData = {
      title: 'Test Manual Task',
      description: 'This is a test task created directly in database',
      dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
      course: 'Test Course',
      courseName: 'Test Course',
      isManual: true,
      canvasId: null,
      canvasType: null
    };
    
    const createdTask = await db.createTask(testUserId, taskData);
    console.log('✅ Task created in database:', createdTask.title);
    
    // 3. Test different retrieval methods
    console.log('\n3️⃣  Testing task retrieval methods...');
    
    // Test getUserTasks with upcoming filter
    const upcomingTasks = await db.getUserTasks(testUserId, { upcoming: true, daysAhead: 1 });
    console.log(`📋 Upcoming tasks (next 1 day): ${upcomingTasks.length}`);
    upcomingTasks.forEach(task => {
      console.log(`   • ${task.title} (Due: ${task.due_date})`);
    });
    
    // Test getUserTasks with broader upcoming filter
    const allUpcomingTasks = await db.getUserTasks(testUserId, { upcoming: true, daysAhead: 30 });
    console.log(`\n📅 All upcoming tasks (next 30 days): ${allUpcomingTasks.length}`);
    allUpcomingTasks.forEach(task => {
      console.log(`   • ${task.title} (Due: ${task.due_date}, Manual: ${task.is_manual})`);
    });
    
    // Test the mapping transformation used in the fix
    console.log('\n4️⃣  Testing task transformation (matching fix logic)...');
    const transformedTasks = allUpcomingTasks.map(dbTask => ({
      id: dbTask.canvas_id || dbTask.id,
      title: dbTask.title,
      dueDate: new Date(dbTask.due_date),
      course: dbTask.course_name,
      courseId: dbTask.canvas_course_id,
      description: dbTask.description,
      isManual: true,
      canvasType: dbTask.canvas_type
    }));
    
    console.log(`🔄 Transformed tasks: ${transformedTasks.length}`);
    transformedTasks.forEach(task => {
      console.log(`   • ${task.title} (Due: ${task.dueDate.toISOString()}, Course: ${task.course})`);
    });
    
    // 5. Create an overdue task to test overdue retrieval
    console.log('\n5️⃣  Creating overdue task...');
    const overdueTaskData = {
      title: 'Test Overdue Task',
      description: 'This task is overdue',
      dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      course: 'Test Course',
      courseName: 'Test Course',
      isManual: true,
      canvasId: null,
      canvasType: null
    };
    
    const overdueTask = await db.createTask(testUserId, overdueTaskData);
    console.log('✅ Overdue task created:', overdueTask.title);
    
    // Test overdue retrieval
    const overdueTasks = await db.getUserTasks(testUserId, { overdue: true });
    console.log(`⚠️  Overdue tasks: ${overdueTasks.length}`);
    overdueTasks.forEach(task => {
      console.log(`   • ${task.title} (Due: ${task.due_date})`);
    });
    
    console.log('\n✅ Task retrieval test completed successfully!');
    console.log('🔧 The fix should now include database tasks in user queries.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testTaskRetrieval();
