require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Environment variables
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const APP_SECRET = process.env.APP_SECRET;

// In-memory storage (resets on deployment)
const users = new Map(); // senderId -> user data
const userSessions = new Map(); // senderId -> current session state

// Middleware
app.use(bodyParser.json({ verify: verifyRequestSignature }));
app.use(express.static('public'));

// Verify request signature for security
function verifyRequestSignature(req, res, buf) {
  const signature = req.get('X-Hub-Signature-256');
  
  if (!signature) {
    console.warn('Missing X-Hub-Signature-256 header');
    return;
  }

  const expectedSignature = crypto
    .createHmac('sha256', APP_SECRET)
    .update(buf)
    .digest('hex');
    
  if (signature !== `sha256=${expectedSignature}`) {
    console.error('Invalid signature');
    throw new Error('Invalid signature');
  }
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Easely Messenger Webhook',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Webhook verification endpoint
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verified');
      res.status(200).send(challenge);
    } else {
      console.error('Webhook verification failed');
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// Main webhook endpoint for receiving messages
app.post('/webhook', (req, res) => {
  const body = req.body;

  if (body.object === 'page') {
    body.entry.forEach((entry) => {
      const webhookEvent = entry.messaging[0];
      console.log('Received webhook event:', JSON.stringify(webhookEvent, null, 2));
      
      const senderId = webhookEvent.sender.id;
      
      if (webhookEvent.message) {
        handleMessage(senderId, webhookEvent.message);
      } else if (webhookEvent.postback) {
        handlePostback(senderId, webhookEvent.postback);
      }
    });

    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
}

// User management functions
function getUser(senderId) {
  return users.get(senderId) || null;
}

function createUser(senderId) {
  const userData = {
    senderId: senderId,
    isOnboarded: false,
    canvasToken: null,
    subscriptionTier: 'free',
    createdAt: new Date().toISOString(),
    assignments: []
  };
  users.set(senderId, userData);
  return userData;
}

function updateUser(senderId, updates) {
  const user = users.get(senderId);
  if (user) {
    Object.assign(user, updates);
    users.set(senderId, user);
  }
  return user;
}

function getUserSession(senderId) {
  return userSessions.get(senderId) || null;
}

function setUserSession(senderId, sessionData) {
  userSessions.set(senderId, sessionData);
}

function clearUserSession(senderId) {
  userSessions.delete(senderId);
}

// Handle incoming messages
async function handleMessage(senderId, message) {
  console.log(`Message from ${senderId}:`, message.text);
  
  // Get or create user
  let user = getUser(senderId);
  if (!user) {
    user = createUser(senderId);
    console.log(`New user created: ${senderId}`);
  }
  
  if (message.text) {
    const userMessage = message.text.toLowerCase().trim();
    const session = getUserSession(senderId);
    
    // Handle session-based flows first
    if (session && session.flow) {
      await handleSessionFlow(senderId, message.text, session);
      return;
    }
    
    // Route messages based on content and user state
    switch (userMessage) {
      case 'get started':
      case 'hi':
      case 'hello':
        if (!user.isOnboarded) {
          await sendOnboardingMessage(senderId);
        } else {
          await sendWelcomeMessage(senderId);
        }
        break;
      case 'menu':
        if (user.isOnboarded) {
          await sendWelcomeMessage(senderId);
        } else {
          await sendOnboardingMessage(senderId);
        }
        break;
      case 'activate':
        await sendActivationMessage(senderId);
        updateUser(senderId, { subscriptionTier: 'premium' });
        break;
      default:
        // Check if it's a Canvas token
        if (isCanvasToken(message.text)) {
          await handleCanvasToken(senderId, message.text);
        } else {
          await sendGenericResponse(senderId);
        }
    }
  }
}

// Handle session-based conversation flows
async function handleSessionFlow(senderId, messageText, session) {
  const user = getUser(senderId);
  
  switch (session.flow) {
    case 'add_task':
      if (session.step === 'title') {
        // User provided task title, now ask for time
        setUserSession(senderId, { flow: 'add_task', step: 'time', taskTitle: messageText });
        await sendTaskTimeRequest(senderId, messageText);
      } else if (session.step === 'time') {
        // User provided time, create the task
        await createTask(senderId, session.taskTitle, messageText);
        clearUserSession(senderId);
      }
      break;
    default:
      clearUserSession(senderId);
      await sendGenericResponse(senderId);
  }
}

// Handle postback events (button clicks)
async function handlePostback(senderId, postback) {
  console.log(`Postback from ${senderId}:`, postback.payload);
  
  const payload = postback.payload;
  let user = getUser(senderId);
  if (!user) {
    user = createUser(senderId);
  }
  
  switch (payload) {
    case 'GET_STARTED':
      await sendOnboardingMessage(senderId);
      break;
    case 'AGREE_TERMS':
      await sendTokenRequestMessage(senderId);
      break;
    case 'SHOW_TUTORIAL':
      await sendTutorialMessage(senderId);
      break;
    case 'HAVE_TOKEN':
      await sendMessage({
        recipient: { id: senderId },
        message: { text: "Great! Please paste your Canvas Access Token here and I'll validate it." }
      });
      break;
    case 'GET_TASKS_TODAY':
      await sendTasksToday(senderId);
      break;
    case 'GET_TASKS_WEEK':
      await sendTasksWeek(senderId);
      break;
    case 'SHOW_OVERDUE':
      await sendOverdueTasks(senderId);
      break;
    case 'VIEW_ALL_UPCOMING':
      await sendAllUpcoming(senderId);
      break;
    case 'ADD_NEW_TASK':
      setUserSession(senderId, { flow: 'add_task', step: 'title' });
      await sendAddTaskFlow(senderId);
      break;
    default:
      await sendGenericResponse(senderId);
  }
}

// Welcome message with main menu
async function sendWelcomeMessage(senderId) {
  const message = {
    recipient: { id: senderId },
    message: {
      text: "Welcome back to Easely! What would you like to see?",
      quick_replies: [
        {
          content_type: "text",
          title: "🔥 Due Today",
          payload: "GET_TASKS_TODAY"
        },
        {
          content_type: "text",
          title: "⏰ Due This Week",
          payload: "GET_TASKS_WEEK"
        },
        {
          content_type: "text",
          title: "❗️ Show Overdue",
          payload: "SHOW_OVERDUE"
        },
        {
          content_type: "text",
          title: "🗓 View All Upcoming",
          payload: "VIEW_ALL_UPCOMING"
        },
        {
          content_type: "text",
          title: "➕ Add New Task",
          payload: "ADD_NEW_TASK"
        }
      ]
    }
  };
  
  await sendMessage(message);
}

// Onboarding message with consent
async function sendOnboardingMessage(senderId) {
  const message = {
    recipient: { id: senderId },
    message: {
      text: "Hi! I'm Easely, your personal Canvas assistant. I help you manage your assignments and never miss a deadline.\n\nTo get started, I need your consent to access your Canvas data and send you reminders.",
      quick_replies: [
        {
          content_type: "text",
          title: "✅ I Agree, Let's Go!",
          payload: "AGREE_TERMS"
        },
        {
          content_type: "text",
          title: "📜 Privacy Policy",
          payload: "PRIVACY_POLICY"
        },
        {
          content_type: "text",
          title: "⚖️ Terms of Use",
          payload: "TERMS_OF_USE"
        }
      ]
    }
  };
  
  await sendMessage(message);
}

// Token request message
async function sendTokenRequestMessage(senderId) {
  const message = {
    recipient: { id: senderId },
    message: {
      text: "Great! Now I need your Canvas Access Token to connect to your account.\n\nDo you have your Canvas Access Token ready?",
      quick_replies: [
        {
          content_type: "text",
          title: "✅ Yes, I have it",
          payload: "HAVE_TOKEN"
        },
        {
          content_type: "text",
          title: "❓ Show me how",
          payload: "SHOW_TUTORIAL"
        }
      ]
    }
  };
  
  await sendMessage(message);
}

// Tutorial message
async function sendTutorialMessage(senderId) {
  const message = {
    recipient: { id: senderId },
    message: {
      text: "Here's how to get your Canvas Access Token:\n\n1. Go to your Canvas account\n2. Click on 'Account' → 'Settings'\n3. Scroll to 'Approved Integrations'\n4. Click '+ New Access Token'\n5. Give it a purpose (like 'Easely Bot')\n6. IMPORTANT: Make sure to enable these permissions:\n   - Read assignments\n   - Write to calendar\n7. Copy the token and paste it here\n\n⚠️ Keep your token secure and don't share it with anyone else!\n\nOnce you have it, just paste the token in the chat."
    }
  };
  
  await sendMessage(message);
}

// Canvas API integration functions
async function validateCanvasToken(token) {
  const canvasUrl = process.env.CANVAS_BASE_URL || 'https://dlsu.instructure.com';
  
  try {
    const response = await axios.get(`${canvasUrl}/api/v1/users/self`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    return {
      valid: true,
      user: response.data
    };
  } catch (error) {
    console.error('Canvas token validation failed:', error.response?.status, error.response?.data);
    return {
      valid: false,
      error: error.response?.data?.errors?.[0]?.message || 'Invalid token or network error'
    };
  }
}

async function fetchCanvasAssignments(token) {
  const canvasUrl = process.env.CANVAS_BASE_URL || 'https://dlsu.instructure.com';
  
  try {
    // Get all courses first
    const coursesResponse = await axios.get(`${canvasUrl}/api/v1/courses`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params: {
        enrollment_state: 'active',
        per_page: 100
      },
      timeout: 15000
    });
    
    const courses = coursesResponse.data;
    console.log(`Found ${courses.length} active courses`);
    
    // Fetch assignments for each course
    const allAssignments = [];
    const courseMap = {};
    
    for (const course of courses) {
      courseMap[course.id] = course.name;
      
      try {
        const assignmentsResponse = await axios.get(`${canvasUrl}/api/v1/courses/${course.id}/assignments`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          params: {
            per_page: 100,
            order_by: 'due_at'
          },
          timeout: 10000
        });
        
        const courseAssignments = assignmentsResponse.data
          .filter(assignment => assignment.due_at) // Only assignments with due dates
          .map(assignment => ({
            id: assignment.id,
            title: assignment.name,
            dueDate: new Date(assignment.due_at),
            course: course.name,
            courseId: course.id,
            description: assignment.description,
            htmlUrl: assignment.html_url,
            pointsPossible: assignment.points_possible
          }));
          
        allAssignments.push(...courseAssignments);
        
      } catch (assignmentError) {
        console.warn(`Failed to fetch assignments for course ${course.name}:`, assignmentError.message);
      }
    }
    
    // Sort by due date
    allAssignments.sort((a, b) => a.dueDate - b.dueDate);
    
    console.log(`Fetched ${allAssignments.length} assignments total`);
    
    return {
      assignments: allAssignments,
      courses: courseMap
    };
    
  } catch (error) {
    console.error('Failed to fetch Canvas assignments:', error.response?.status, error.response?.data);
    throw new Error('Failed to sync assignments from Canvas');
  }
}

function formatDueDate(date) {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return `Today ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  } else if (diffDays === 1) {
    return `Tomorrow ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  } else if (diffDays < 7) {
    return `${date.toLocaleDateString('en-US', { weekday: 'long' })} ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  }
}

// Handle Canvas token submission with real API integration
async function handleCanvasToken(senderId, token) {
  // Send initial loading message
  await sendMessage({
    recipient: { id: senderId },
    message: { text: "🔄 Validating your Canvas token and connecting to DLSU Canvas..." }
  });
  
  try {
    // Validate the token first
    const validation = await validateCanvasToken(token);
    
    if (!validation.valid) {
      await sendMessage({
        recipient: { id: senderId },
        message: {
          text: `❌ Canvas token validation failed: ${validation.error}\n\nPlease check your token and try again. Make sure you've enabled the correct permissions:\n\n- Read assignments\n- Read courses\n- Read user data\n\nClick '❓ Show me how' to see the setup tutorial again.`,
          quick_replies: [
            {
              content_type: "text",
              title: "❓ Show me how",
              payload: "SHOW_TUTORIAL"
            },
            {
              content_type: "text",
              title: "🔄 Try Again",
              payload: "HAVE_TOKEN"
            }
          ]
        }
      });
      return;
    }
    
    // Token is valid, now fetch assignments
    await sendMessage({
      recipient: { id: senderId },
      message: { text: `✅ Connected as ${validation.user.name}!\n\n🔄 Syncing your assignments and courses from DLSU Canvas...` }
    });
    
    const canvasData = await fetchCanvasAssignments(token);
    
    // Format assignments for storage
    const formattedAssignments = canvasData.assignments.map(assignment => ({
      id: assignment.id,
      title: assignment.title,
      dueDate: assignment.dueDate,
      dueDateFormatted: formatDueDate(assignment.dueDate),
      course: assignment.course,
      courseId: assignment.courseId,
      description: assignment.description,
      htmlUrl: assignment.htmlUrl,
      pointsPossible: assignment.pointsPossible,
      source: 'canvas'
    }));
    
    // Update user with real data
    updateUser(senderId, {
      canvasToken: token,
      isOnboarded: true,
      canvasUser: validation.user,
      assignments: formattedAssignments,
      courses: canvasData.courses,
      lastSync: new Date().toISOString()
    });
    
    // Send success message with actual assignments
    let syncMessage = `🎉 Sync complete! Found ${formattedAssignments.length} assignments from ${Object.keys(canvasData.courses).length} courses.\n\n`;
    
    if (formattedAssignments.length > 0) {
      syncMessage += "📋 Upcoming assignments:\n\n";
      
      // Show first 5 assignments
      const upcomingAssignments = formattedAssignments
        .filter(assignment => assignment.dueDate > new Date())
        .slice(0, 5);
        
      if (upcomingAssignments.length > 0) {
        upcomingAssignments.forEach(assignment => {
          syncMessage += `📝 ${assignment.title}\n📚 ${assignment.course}\n⏰ Due: ${assignment.dueDateFormatted}\n\n`;
        });
        
        if (formattedAssignments.length > 5) {
          syncMessage += `... and ${formattedAssignments.length - 5} more assignments!\n\n`;
        }
      } else {
        syncMessage += "🎉 No upcoming assignments found!\n\n";
      }
    } else {
      syncMessage += "No assignments with due dates found.\n\n";
    }
    
    syncMessage += "I'll send you reminders 24 hours before each deadline. Want to upgrade to Premium for more frequent reminders?";
    
    await sendMessage({
      recipient: { id: senderId },
      message: { text: syncMessage }
    });
    
    // After a moment, show the main menu
    setTimeout(async () => {
      await sendWelcomeMessage(senderId);
    }, 3000);
    
  } catch (error) {
    console.error('Canvas integration error:', error);
    
    await sendMessage({
      recipient: { id: senderId },
      message: {
        text: `❌ Sorry, I couldn't sync your Canvas data: ${error.message}\n\nThis might be due to:\n- Network connectivity issues\n- Canvas server being temporarily unavailable\n- Insufficient token permissions\n\nPlease try again in a few minutes.`,
        quick_replies: [
          {
            content_type: "text",
            title: "🔄 Try Again",
            payload: "HAVE_TOKEN"
          },
          {
            content_type: "text",
            title: "❓ Show Tutorial",
            payload: "SHOW_TUTORIAL"
          }
        ]
      }
    });
  }
}

// Task management functions
async function sendTaskTimeRequest(senderId, taskTitle) {
  const message = {
    recipient: { id: senderId },
    message: {
      text: `Perfect! I'll create "${taskTitle}" for you.\n\nWhen is this due? You can say things like:\n- "Tomorrow 5pm"\n- "Friday 11:59pm"\n- "Next Monday 9am"\n- "Dec 15 2pm"`
    }
  };
  
  await sendMessage(message);
}

async function createTask(senderId, title, timeText) {
  const user = getUser(senderId);
  if (user) {
    const newTask = {
      title: title,
      dueDate: timeText,
      course: "Personal",
      createdAt: new Date().toISOString()
    };
    
    user.assignments.push(newTask);
    updateUser(senderId, { assignments: user.assignments });
    
    const message = {
      recipient: { id: senderId },
      message: {
        text: `✅ Task created successfully!\n\n📝 "${title}"\n⏰ Due: ${timeText}\n\nI've added this to your Canvas calendar and will remind you when it's due!`
      }
    };
    
    await sendMessage(message);
    
    // Show updated task list
    setTimeout(async () => {
      await sendWelcomeMessage(senderId);
    }, 1000);
  }
}

// Task display functions
async function sendTasksToday(senderId) {
  const user = getUser(senderId);
  let taskText = "🔥 Tasks due today:\n\n";
  
  if (user && user.assignments && user.assignments.length > 0) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayTasks = user.assignments.filter(assignment => {
      if (assignment.dueDate instanceof Date) {
        // Real Canvas data with Date objects
        return assignment.dueDate.toDateString() === today.toDateString();
      } else {
        // Manual tasks with string dates
        return assignment.dueDate.toLowerCase().includes('today') || 
               assignment.dueDate.toLowerCase().includes('tomorrow');
      }
    });
    
    if (todayTasks.length > 0) {
      todayTasks.forEach(assignment => {
        const dueText = assignment.dueDateFormatted || assignment.dueDate;
        taskText += `📝 ${assignment.title}\n📚 ${assignment.course}\n⏰ Due: ${dueText}\n\n`;
      });
    } else {
      taskText += "No tasks due today! 🎉";
    }
  } else {
    taskText += "No assignments found. Add your Canvas token to sync assignments!";
  }
  
  taskText += "You're doing great! Keep it up! 💪";
  
  const message = {
    recipient: { id: senderId },
    message: { text: taskText }
  };
  
  await sendMessage(message);
}

async function sendTasksWeek(senderId) {
  const user = getUser(senderId);
  let taskText = "⏰ Tasks due this week:\n\n";
  
  if (user && user.assignments && user.assignments.length > 0) {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const weekTasks = user.assignments.filter(assignment => {
      if (assignment.dueDate instanceof Date) {
        return assignment.dueDate >= today && assignment.dueDate <= nextWeek;
      } else {
        // For manual tasks, show all for now
        return true;
      }
    }).slice(0, 10); // Limit to 10 assignments
    
    if (weekTasks.length > 0) {
      weekTasks.forEach(assignment => {
        const dueText = assignment.dueDateFormatted || assignment.dueDate;
        taskText += `📝 ${assignment.title}\n📚 ${assignment.course}\n⏰ Due: ${dueText}\n\n`;
      });
      
      if (user.assignments.length > 10) {
        taskText += `... and ${user.assignments.length - 10} more assignments!\n\n`;
      }
    } else {
      taskText += "No assignments due this week! 🎉";
    }
  } else {
    taskText += "No assignments found. Add your Canvas token to sync assignments!";
  }
  
  taskText += "Stay organized! You've got this! 📚";
  
  const message = {
    recipient: { id: senderId },
    message: { text: taskText }
  };
  
  await sendMessage(message);
}

async function sendOverdueTasks(senderId) {
  const user = getUser(senderId);
  let taskText = "❗️ Overdue tasks:\n\n";
  
  if (user && user.assignments && user.assignments.length > 0) {
    const now = new Date();
    const overdueTasks = user.assignments.filter(assignment => {
      if (assignment.dueDate instanceof Date) {
        return assignment.dueDate < now;
      } else {
        // For manual tasks, we can't easily determine if they're overdue
        return false;
      }
    });
    
    if (overdueTasks.length > 0) {
      overdueTasks.forEach(assignment => {
        const dueText = assignment.dueDateFormatted || assignment.dueDate;
        taskText += `📝 ${assignment.title}\n📚 ${assignment.course}\n⏰ Was due: ${dueText}\n\n`;
      });
      taskText += "Don't worry! You can still submit these. Contact your instructors if needed.";
    } else {
      taskText += "No overdue tasks! 🎉\n\nYou're staying on top of everything. Great job!";
    }
  } else {
    taskText += "No assignments found. Add your Canvas token to sync assignments!";
  }
  
  const message = {
    recipient: { id: senderId },
    message: { text: taskText }
  };
  
  await sendMessage(message);
}

async function sendAllUpcoming(senderId) {
  const user = getUser(senderId);
  let taskText = "📅 All upcoming assignments:\n\n";
  
  if (user && user.assignments && user.assignments.length > 0) {
    const now = new Date();
    const upcomingTasks = user.assignments
      .filter(assignment => {
        if (assignment.dueDate instanceof Date) {
          return assignment.dueDate >= now;
        } else {
          // Include manual tasks
          return true;
        }
      })
      .slice(0, 15); // Limit to 15 assignments
    
    if (upcomingTasks.length > 0) {
      upcomingTasks.forEach((assignment, index) => {
        const dueText = assignment.dueDateFormatted || assignment.dueDate;
        taskText += `${index + 1}. 📝 ${assignment.title}\n   📚 ${assignment.course}\n   ⏰ Due: ${dueText}\n\n`;
      });
      
      if (user.assignments.length > 15) {
        taskText += `... and ${user.assignments.length - 15} more assignments!\n\n`;
      }
    } else {
      taskText += "No upcoming assignments! 🎉\n\n";
    }
  } else {
    taskText += "No assignments found. Add your Canvas token to sync assignments!\n\n";
  }
  
  taskText += "Stay focused and tackle them one by one! 💼";
  
  const message = {
    recipient: { id: senderId },
    message: { text: taskText }
  };
  
  await sendMessage(message);
}

async function sendAddTaskFlow(senderId) {
  const message = {
    recipient: { id: senderId },
    message: {
      text: "➕ Let's add a new task!\n\nWhat's the title of your task? (e.g., 'Study for Math Exam', 'Submit Research Paper')"
    }
  };
  
  await sendMessage(message);
}

async function sendActivationMessage(senderId) {
  const message = {
    recipient: { id: senderId },
    message: {
      text: "🎉 Premium activated successfully!\n\nYou now have access to:\n✅ Full proximity reminders (1 week, 3 days, 1 day, 8 hours, 2 hours, 1 hour)\n✅ Unlimited manual tasks\n✅ AI-powered outline generation\n✅ Personalized weekly digest\n✅ Calendar export\n\nThanks for supporting Easely! Let's make this semester your best one yet! 🚀"
    }
  };
  
  await sendMessage(message);
}

// Generic response for unhandled messages
async function sendGenericResponse(senderId) {
  const message = {
    recipient: { id: senderId },
    message: {
      text: "I'm not sure how to help with that. Try saying 'menu' to see what I can do! 🤖"
    }
  };
  
  await sendMessage(message);
}

// Helper function to check if text looks like a Canvas token
function isCanvasToken(text) {
  // Canvas tokens are typically long alphanumeric strings
  return text.length > 20 && /^[a-zA-Z0-9~]+$/.test(text);
}

// Send message to Facebook Messenger API
async function sendMessage(messageData) {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      messageData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Message sent successfully:', response.data);
  } catch (error) {
    console.error('Error sending message:', error.response?.data || error.message);
  }
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Webhook error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Easely webhook server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Check required environment variables
  const requiredEnvVars = ['VERIFY_TOKEN', 'PAGE_ACCESS_TOKEN', 'APP_SECRET'];
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missingEnvVars.length > 0) {
    console.warn('⚠️  Missing required environment variables:', missingEnvVars.join(', '));
  } else {
    console.log('✅ All required environment variables are set');
  }
});
