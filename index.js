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
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN; // For admin dashboard authentication

// Database integration
const db = require('./services/database');

// Clean up expired sessions periodically (every hour)
setInterval(async () => {
  await db.cleanupExpiredSessions();
}, 60 * 60 * 1000);

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

// Admin authentication middleware
function requireAdminAuth(req, res, next) {
  const adminToken = req.get('X-Admin-Token');
  
  if (!ADMIN_API_TOKEN) {
    console.error('ADMIN_API_TOKEN not configured');
    return res.status(500).json({ error: 'Admin API not configured' });
  }
  
  if (!adminToken) {
    return res.status(401).json({ error: 'Missing X-Admin-Token header' });
  }
  
  if (adminToken !== ADMIN_API_TOKEN) {
    console.warn('Invalid admin token attempt');
    return res.status(403).json({ error: 'Invalid admin token' });
  }
  
  next();
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

// Debug endpoint to check messenger profile settings
app.get('/debug/menu', async (req, res) => {
  try {
    const profileResponse = await axios.get(
      `https://graph.facebook.com/v18.0/me/messenger_profile?fields=persistent_menu,get_started,greeting&access_token=${PAGE_ACCESS_TOKEN}`
    );
    
    const hasMenu = profileResponse.data?.data?.[0]?.persistent_menu?.length > 0;
    const hasGetStarted = profileResponse.data?.data?.[0]?.get_started?.payload === 'GET_STARTED';
    
    res.json({
      status: 'success',
      messenger_profile: profileResponse.data,
      configured: {
        menu: hasMenu,
        get_started: hasGetStarted
      },
      note: 'If menu is missing on Android, try these steps:',
      android_fixes: [
        '1. Force close and reopen Messenger app',
        '2. Clear Messenger app cache (Settings > Apps > Messenger > Clear Cache)',
        '3. Update Messenger to latest version',
        '4. Switch to a different conversation and back',
        '5. Wait 5-10 minutes for Facebook to propagate changes',
        '6. Try accessing via m.facebook.com in Chrome on Android',
        '7. Use /debug/refresh-menu endpoint to force refresh'
      ]
    });
  } catch (error) {
    if (error.response?.data?.error?.code === 613) {
      res.status(429).json({
        status: 'rate_limited',
        message: 'Facebook API rate limit exceeded. Menu might still be configured.',
        suggestion: 'Wait a few minutes and try again, or use POST /debug/refresh-menu?retry=true',
        error_details: error.response?.data
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: error.message,
        details: error.response?.data
      });
    }
  }
});

// Endpoint to force refresh the menu with retry logic
app.post('/debug/refresh-menu', async (req, res) => {
  const useRetry = req.query.retry === 'true';
  const forceSetup = req.query.force === 'true';
  
  try {
    console.log(`Menu refresh requested (retry: ${useRetry}, force: ${forceSetup})`);
    
    // Check current status first (unless forcing)
    let currentStatus = { hasMenu: false, hasGetStarted: false };
    if (!forceSetup) {
      currentStatus = await verifyMenuConfiguration();
    }
    
    const results = {
      before: currentStatus,
      actions: [],
      success: true
    };
    
    // Setup Get Started button if needed or forced
    if (forceSetup || !currentStatus.hasGetStarted) {
      try {
        await setupGetStartedButton();
        results.actions.push('✓ Get Started button configured');
        if (useRetry) await delay(1500); // Longer delay when retrying
      } catch (error) {
        results.actions.push(`✗ Get Started button: ${error.message}`);
        if (error.response?.data?.error?.code !== 613) {
          results.success = false;
        }
      }
    }
    
    // Setup menu if needed or forced
    if (forceSetup || !currentStatus.hasMenu) {
      try {
        await setupPersistentMenu();
        results.actions.push('✓ Persistent menu configured');
      } catch (error) {
        results.actions.push(`✗ Persistent menu: ${error.message}`);
        if (error.response?.data?.error?.code !== 613) {
          results.success = false;
        }
      }
    }
    
    if (results.actions.length === 0) {
      results.actions.push('Menu already configured, no action needed');
    }
    
    res.json({
      status: results.success ? 'success' : 'partial_success',
      message: 'Menu refresh completed. Changes may take 5-10 minutes to appear.',
      results,
      android_note: 'Android users may need to clear Messenger cache for menu to appear'
    });
  } catch (error) {
    if (error.response?.data?.error?.code === 613 && !useRetry) {
      res.status(429).json({
        status: 'rate_limited',
        message: 'Rate limit exceeded. Try again with ?retry=true to use exponential backoff',
        error: error.response?.data
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: error.message,
        details: error.response?.data
      });
    }
  }
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
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'page') {
    // Process each entry asynchronously
    for (const entry of body.entry) {
      const webhookEvent = entry.messaging[0];
      console.log('Received webhook event:', JSON.stringify(webhookEvent, null, 2));
      
      const senderId = webhookEvent.sender.id;
      
      if (webhookEvent.message) {
        await handleMessage(senderId, webhookEvent.message);
      } else if (webhookEvent.postback) {
        await handlePostback(senderId, webhookEvent.postback);
      }
    }

    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// Admin endpoint for broadcasting announcements
app.post('/admin/broadcast', express.json(), requireAdminAuth, async (req, res) => {
  const { message, targetUsers = 'all', testMode = false } = req.body;
  
  if (!message || !message.text) {
    return res.status(400).json({ error: 'Message with text property is required' });
  }
  
  console.log(`Admin broadcast initiated: ${message.text.substring(0, 50)}...`);
  
  try {
    // Execute broadcast and wait for completion
    const result = await broadcastMessage(message, targetUsers, testMode);
    console.log('Broadcast completed:', result);
    
    // Return actual broadcast results
    res.json({ 
      success: true, 
      message: 'Broadcast completed',
      totalUsers: result.total,
      stats: {
        sent: result.successful,
        failed: result.failed,
        total: result.total
      },
      errors: result.errors,
      testMode 
    });
  } catch (error) {
    console.error('Broadcast failed:', error);
    
    // Get user count for error response
    const allUsers = await db.getAllUsers('all');
    
    res.status(500).json({
      success: false,
      message: 'Broadcast failed',
      error: error.message,
      totalUsers: allUsers.length,
      testMode
    });
  }
});

// Admin endpoint to get user statistics
app.get('/admin/stats', requireAdminAuth, async (req, res) => {
  try {
    const allUsers = await db.getAllUsers('all');
    const stats = {
      totalUsers: allUsers.length,
      onboardedUsers: allUsers.filter(u => u.is_onboarded).length,
      premiumUsers: allUsers.filter(u => u.subscription_tier === 'premium').length,
      usersWithCanvas: allUsers.filter(u => u.canvas_token).length,
      timestamp: new Date().toISOString()
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// User management functions (now using database)
async function getUser(senderId) {
  return await db.getUser(senderId);
}

async function createUser(senderId) {
  return await db.createUser(senderId);
}

async function updateUser(senderId, updates) {
  return await db.updateUser(senderId, updates);
}

async function getUserSession(senderId) {
  return await db.getUserSession(senderId);
}

async function setUserSession(senderId, sessionData) {
  return await db.setUserSession(senderId, sessionData);
}

async function clearUserSession(senderId) {
  return await db.clearUserSession(senderId);
}

// Handle incoming messages
async function handleMessage(senderId, message) {
  console.log(`Message from ${senderId}:`, message.text);
  
  // Get or create user
  let user = await getUser(senderId);
  if (!user) {
    user = await createUser(senderId);
    console.log(`New user created: ${senderId}`);
  }
  
  if (message.text || message.quick_reply) {
    // Handle quick replies (Messenger sends them inside message.quick_reply)
    if (message.quick_reply && message.quick_reply.payload) {
      await handleQuickReply(senderId, message.quick_reply.payload);
      return;
    }

    const userMessage = (message.text || '').toLowerCase().trim();
    const session = await getUserSession(senderId);
    
    // Handle session-based flows first
    if (session && session.flow) {
      await handleSessionFlow(senderId, message.text, session);
      return;
    }
    
    // Handle common navigation commands first
    if (['menu', 'main menu', 'help'].includes(userMessage)) {
      if (user.is_onboarded) {
        await sendWelcomeMessage(senderId);
        // Add Android-friendly text menu after welcome
        await sendAndroidFriendlyMenu(senderId);
      } else {
        await startOnboardingFlow(senderId);
      }
      return;
    }
    
    if (userMessage === 'activate') {
      await sendActivationMessage(senderId);
      await updateUser(senderId, { subscription_tier: 'premium' });
      return;
    }
    
    // Hidden debug commands
    if (['test planner', 'test dashboard', 'debug planner'].includes(userMessage)) {
      await testPlannerNotesVisibility(senderId);
      return;
    }
    
    // Check if it's a Canvas token first (these are long alphanumeric strings)
    if (isCanvasToken(message.text)) {
      await handleCanvasToken(senderId, message.text);
      return;
    }
    
    // For new users (not onboarded), ANY message should start onboarding
    if (!user.is_onboarded) {
      await startOnboardingFlow(senderId);
      return;
    }
    
    // For returning users with common greetings, show main menu
    if (['get started', 'hi', 'hello', 'hey', 'start', 'begin'].includes(userMessage)) {
      await sendWelcomeMessage(senderId);
      return;
    }
    
    // Default case: show helpful response with menu suggestion
    await sendGenericResponse(senderId);
  }
}

// Handle session-based conversation flows
async function handleSessionFlow(senderId, messageText, session) {
  const user = await getUser(senderId);
  
  switch (session.flow) {
    case 'waiting_for_token':
      // User is expected to input a Canvas token
      if (isCanvasToken(messageText)) {
        await clearUserSession(senderId); // Clear session before handling token
        await handleCanvasToken(senderId, messageText);
      } else {
        // Invalid token format - provide helpful feedback
        await sendMessage({
          recipient: { id: senderId },
          message: {
            text: `❌ That doesn't look like a valid Canvas token.\n\nCanvas tokens are typically:\n• 64+ characters long\n• Contains letters, numbers, and ~ symbols\n• Example: 7~abcd1234efgh5678...\n\nPlease paste your Canvas Access Token here, or get help below:`,
            quick_replies: [
              {
                content_type: "text",
                title: "❓ Show Tutorial",
                payload: "SHOW_TUTORIAL"
              },
              {
                content_type: "text",
                title: "🎥 Watch Video",
                payload: "SHOW_VIDEO_TUTORIAL"
              }
            ]
          }
        });
      }
      break;
    case 'add_task':
      if (session.step === 'title') {
        // Store task title, then ask for course
        await setUserSession(senderId, { flow: 'add_task', step: 'course', taskTitle: messageText });
        await sendCourseSelection(senderId);
      } else if (session.step === 'course_other') {
        // User provided a custom course name
        await setUserSession(senderId, { ...session, step: 'description', courseName: messageText, courseId: null });
        await sendDescriptionRequest(senderId);
      } else if (session.step === 'description') {
        // Store description then ask for due date
        await setUserSession(senderId, { ...session, step: 'date', description: messageText });
        await sendTaskDateRequest(senderId);
      } else if (session.step === 'date') {
        // Only accept quick replies for date selection
        await sendMessage({
          recipient: { id: senderId },
          message: { text: "Please use the date buttons below to choose a due date." }
        });
        await sendTaskDateRequest(senderId);
        return;
      } else if (session.step === 'time') {
        // Only accept quick replies for time selection
        await sendMessage({
          recipient: { id: senderId },
          message: { text: "Please use the time buttons below to choose a due time." }
        });
        await sendTaskTimeRequest(senderId);
        return;
      }
      break;
    default:
      await clearUserSession(senderId);
      await sendGenericResponse(senderId);
  }
}

// Handle quick replies
async function handleQuickReply(senderId, payload) {
  // Dynamic payloads first
  if (payload.startsWith('SELECT_COURSE_')) {
    const courseToken = payload.replace('SELECT_COURSE_', '');
    const session = await getUserSession(senderId) || {};
    if (session.flow === 'add_task' && session.step === 'course') {
      if (courseToken === 'PERSONAL') {
        await setUserSession(senderId, { ...session, step: 'description', courseId: null, courseName: 'Personal' });
        await sendDescriptionRequest(senderId);
        return;
      }
      if (courseToken === 'OTHER') {
        await setUserSession(senderId, { ...session, step: 'course_other' });
        await sendAskCustomCourseName(senderId);
        return;
      }
      // courseToken is numeric id
      const courseId = parseInt(courseToken, 10);
      await setUserSession(senderId, { ...session, step: 'description', courseId, courseName: 'Selected Course' });
      await sendDescriptionRequest(senderId);
      return;
    }
  }
  
  switch (payload) {
    case 'AGREE_TERMS': // legacy payload
    case 'CONSENT_CONTINUE':
      await sendPoliciesPrompt(senderId);
      break;
    case 'PRIVACY_POLICY': // legacy
    case 'OPEN_PRIVACY_POLICY':
      await sendPrivacyPolicyLink(senderId);
      break;
    case 'TERMS_OF_USE': // legacy
    case 'OPEN_TERMS_OF_USE':
      await sendTermsOfUseLink(senderId);
      break;
    case 'AGREE_PRIVACY':
      await updateUser(senderId, { agreed_privacy: true });
      await maybeFinishConsent(senderId);
      break;
    case 'AGREE_TERMS_OF_USE':
      await updateUser(senderId, { agreed_terms: true });
      await maybeFinishConsent(senderId);
      break;
    case 'SHOW_VIDEO_TUTORIAL':
      await sendVideoTutorial(senderId);
      break;
    case 'HAVE_TOKEN':
      // Set session to track that we're waiting for token input
      await setUserSession(senderId, { flow: 'waiting_for_token' });
      await sendMessage({
        recipient: { id: senderId },
        message: { text: "Great! Please paste your Canvas Access Token here and I'll validate it." }
      });
      break;
    case 'SHOW_TUTORIAL':
      await sendTutorialMessage(senderId);
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
      await setUserSession(senderId, { flow: 'add_task', step: 'title' });
      await sendAddTaskFlow(senderId);
      break;
    // New menu item handlers
    case 'MY_TASKS':
      await sendMyTasks(senderId);
      break;
    case 'CANVAS_SETUP':
      await sendCanvasSetup(senderId);
      break;
    case 'HELP_AND_SUPPORT':
      await sendHelpAndSupport(senderId);
      break;
    case 'UPGRADE_TO_PREMIUM':
      await sendUpgradeToPremium(senderId);
      break;
    case 'TEST_CANVAS_CONNECTION':
      await testCanvasConnection(senderId);
      break;
    case 'TEST_PLANNER_NOTES':
      await testPlannerNotesVisibility(senderId);
      break;
    case 'VIEW_RECENT_TASKS':
      await viewRecentCreatedTasks(senderId);
      break;
    case 'HOW_TO_USE':
      await sendHowToUse(senderId);
      break;
    case 'REPORT_PROBLEM':
      await sendReportProblem(senderId);
      break;
    case 'FEATURE_REQUEST':
      await sendFeatureRequest(senderId);
      break;
    case 'CONTACT_SUPPORT':
      await sendContactSupport(senderId);
      break;
    // Task due date quick replies
    case 'TASK_DATE_TODAY':
      await handleTaskDateQuickReply(senderId, 'today');
      break;
    case 'TASK_DATE_TOMORROW':
      await handleTaskDateQuickReply(senderId, 'tomorrow');
      break;
    case 'TASK_DATE_FRIDAY':
      await handleTaskDateQuickReply(senderId, 'friday');
      break;
    case 'TASK_DATE_NEXT_MONDAY':
      await handleTaskDateQuickReply(senderId, 'nextmonday');
      break;
    // Task due time quick replies
    case 'TASK_TIME_8AM':
      await handleTaskTimeQuickReply(senderId, 8, 0);
      break;
    case 'TASK_TIME_12PM':
      await handleTaskTimeQuickReply(senderId, 12, 0);
      break;
    case 'TASK_TIME_5PM':
      await handleTaskTimeQuickReply(senderId, 17, 0);
      break;
    case 'TASK_TIME_8PM':
      await handleTaskTimeQuickReply(senderId, 20, 0);
      break;
    case 'TASK_TIME_11_59PM':
      await handleTaskTimeQuickReply(senderId, 23, 59);
      break;
    default:
      await sendGenericResponse(senderId);
  }
}

// Handle postback events (button clicks)
async function handlePostback(senderId, postback) {
  console.log(`Postback from ${senderId}:`, postback.payload);
  
  const payload = postback.payload;
  let user = await getUser(senderId);
  if (!user) {
    user = await createUser(senderId);
  }
  
  switch (payload) {
    case 'GET_STARTED':
      await startOnboardingFlow(senderId);
      break;
    case 'AGREE_TERMS':
      // Legacy handler - redirect to new flow
      await sendTokenRequestMessage(senderId);
      break;
    case 'SHOW_TUTORIAL':
      await sendTutorialMessage(senderId);
      break;
    case 'SHOW_VIDEO_TUTORIAL':
      await sendVideoTutorial(senderId);
      break;
    case 'HAVE_TOKEN':
      // Set session to track that we're waiting for token input
      await setUserSession(senderId, { flow: 'waiting_for_token' });
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
      await setUserSession(senderId, { flow: 'add_task', step: 'title' });
      await sendAddTaskFlow(senderId);
      break;
    // New menu item handlers for postbacks
    case 'MY_TASKS':
      await sendMyTasks(senderId);
      break;
    case 'CANVAS_SETUP':
      await sendCanvasSetup(senderId);
      break;
    case 'HELP_AND_SUPPORT':
      await sendHelpAndSupport(senderId);
      break;
    case 'UPGRADE_TO_PREMIUM':
      await sendUpgradeToPremium(senderId);
      break;
    default:
      await sendGenericResponse(senderId);
  }
}

// Android-friendly text menu with button fallback
async function sendAndroidFriendlyMenu(senderId) {
  // Send button template for Android users who can't see persistent menu
  const message = {
    recipient: { id: senderId },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [
            {
              title: "Main Menu",
              subtitle: "Choose an option below:",
              buttons: [
                {
                  type: "postback",
                  title: "📋 My Tasks",
                  payload: "MY_TASKS"
                },
                {
                  type: "postback",
                  title: "🔧 Canvas Setup",
                  payload: "CANVAS_SETUP"
                },
                {
                  type: "postback",
                  title: "❓ Help & Support",
                  payload: "HELP_AND_SUPPORT"
                }
              ]
            },
            {
              title: "Premium Features",
              subtitle: "Unlock advanced capabilities",
              buttons: [
                {
                  type: "postback",
                  title: "🌟 Upgrade Premium",
                  payload: "UPGRADE_TO_PREMIUM"
                }
              ]
            }
          ]
        }
      }
    }
  };
  
  await sendMessage(message);
}

// Welcome message (simplified now that we have persistent menu)
async function sendWelcomeMessage(senderId) {
  const user = await getUser(senderId);
  let userName = '';
  if (user?.canvas_user_name) {
    // Parse 'SURNAME, FIRSTNAME MIDDLENAME' format to get FIRSTNAME
    const nameParts = user.canvas_user_name.split(',');
    if (nameParts.length >= 2) {
      // Get first name from 'FIRSTNAME MIDDLENAME' part and trim whitespace
      const firstNamePart = nameParts[1].trim().split(' ')[0];
      userName = `, ${firstNamePart}`;
    } else {
      // Fallback to first word if format is unexpected
      userName = `, ${user.canvas_user_name.split(' ')[0]}`;
    }
  }
  
  const message = {
    recipient: { id: senderId },
    message: {
      text: `Welcome back${userName}! 🎉\n\nUse the menu button (☰) below to access:\n📋 My Tasks - View your assignments\n🔧 Canvas Setup - Configure your connection\n❓ Help & Support - Get assistance\n🌟 Upgrade to Premium - Unlock all features\n\n📱 Android users: If you don't see the menu button, type 'menu' or use the quick options below.\n\nWhat would you like to do today?`
    }
  };
  
  await sendMessage(message);
  
  // Optionally show quick access to today's tasks
  setTimeout(async () => {
    await sendMessage({
      recipient: { id: senderId },
      message: {
        text: "Quick access:",
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
            title: "📋 My Tasks",
            payload: "MY_TASKS"
          }
        ]
      }
    });
  }, 1000);
}

// Start multi-step onboarding flow
async function startOnboardingFlow(senderId) {
  // Reset consent flags
  await updateUser(senderId, { agreed_privacy: false, agreed_terms: false });

  await sendIntroMessage(senderId);
  await sendFreeFeaturesMessage(senderId);
  await sendPremiumFeaturesMessage(senderId);
  await sendConsentExplainer(senderId);
  await sendPrivacyPolicyIntroduction(senderId);
}

// Onboarding message with consent (legacy)
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

async function sendIntroMessage(senderId) {
  const text = "Hi! I'm Easely, your personal Canvas assistant for Facebook Messenger. I turn your Canvas into a proactive, easy-to-manage experience so you never miss a deadline.";
  await sendMessage({ recipient: { id: senderId }, message: { text } });
}

async function sendFreeFeaturesMessage(senderId) {
  const text = "Easely (Free) includes:\n• Full Canvas sync (assignments and deadlines)\n• One reminder 24 hours before each due date\n• Add up to 5 manual tasks/month (synced to Canvas Calendar)\n• Quick filters: Due Today, This Week, Overdue, All Upcoming";
  await sendMessage({ recipient: { id: senderId }, message: { text } });
}

async function sendPremiumFeaturesMessage(senderId) {
  const text = "Easely Premium adds:\n• Proximity reminders: 1w, 3d, 1d, 8h, 2h, 1h\n• Unlimited manual tasks\n• AI-powered outline generation\n• Personalized weekly digest\n• Calendar export (Excel)";
  await sendMessage({ recipient: { id: senderId }, message: { text } });
}

async function sendConsentExplainer(senderId) {
  const text = "Before we continue, we need your consent to connect to your Canvas account and to send you reminders. Please review our Privacy Policy and Terms of Use.";
  await sendMessage({ recipient: { id: senderId }, message: { text } });
}

// New function to introduce privacy policy
async function sendPrivacyPolicyIntroduction(senderId) {
  const text = "🔒 To get started, please review our Privacy Policy to understand how we protect your data.";
  await sendMessage({ recipient: { id: senderId }, message: { text } });
  
  // After a brief moment, show the privacy policy link
  setTimeout(async () => {
    await sendPrivacyPolicyLink(senderId);
  }, 2000);
}

async function sendPoliciesPrompt(senderId) {
  const text = "Open and review:";
  const quick_replies = [
    { content_type: "text", title: "📜 Privacy Policy", payload: "OPEN_PRIVACY_POLICY" },
    { content_type: "text", title: "⚖️ Terms of Use", payload: "OPEN_TERMS_OF_USE" }
  ];
  await sendMessage({ recipient: { id: senderId }, message: { text, quick_replies } });
}

async function sendPrivacyPolicyLink(senderId) {
  const message = {
    recipient: { id: senderId },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "Tap to view our Privacy Policy:",
          buttons: [
            { type: "web_url", url: "https://easelyprivacypolicy.onrender.com", title: "Open Privacy Policy" }
          ]
        }
      }
    }
  };
  await sendMessage(message);

  // After 5 seconds, ask for consent acknowledgement
  setTimeout(async () => {
    await sendMessage({
      recipient: { id: senderId },
      message: {
        text: "Do you agree to the Privacy Policy?",
        quick_replies: [
          { content_type: "text", title: "✅ I Agree", payload: "AGREE_PRIVACY" }
        ]
      }
    });
  }, 5000);
}

async function sendTermsOfUseLink(senderId) {
  const message = {
    recipient: { id: senderId },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "Tap to view our Terms of Use:",
          buttons: [
            { type: "web_url", url: "https://easelytermsofuse.onrender.com", title: "Open Terms of Use" }
          ]
        }
      }
    }
  };
  await sendMessage(message);

  // After 5 seconds, ask for consent acknowledgement
  setTimeout(async () => {
    await sendMessage({
      recipient: { id: senderId },
      message: {
        text: "Do you agree to the Terms of Use?",
        quick_replies: [
          { content_type: "text", title: "✅ I Agree", payload: "AGREE_TERMS_OF_USE" }
        ]
      }
    });
  }, 5000);
}

async function maybeFinishConsent(senderId) {
  const user = await getUser(senderId);
  const agreedPrivacy = !!user?.agreed_privacy;
  const agreedTerms = !!user?.agreed_terms;

  if (agreedPrivacy && !agreedTerms) {
    // Privacy agreed, now show Terms of Use introduction
    await sendTermsOfUseIntroduction(senderId);
    return;
  }
  if (agreedPrivacy && agreedTerms) {
    // Both consents complete -> ask for Canvas token
    await sendCanvasTokenRequest(senderId);
    return;
  }
  // If neither agreed yet, wait for privacy agreement first
}

// New function to introduce terms of use
async function sendTermsOfUseIntroduction(senderId) {
  const text = "⚖️ Next, please review our Terms of Use to understand your rights and responsibilities.";
  await sendMessage({ recipient: { id: senderId }, message: { text } });
  
  // After a brief moment, show the terms link
  setTimeout(async () => {
    await sendTermsOfUseLink(senderId);
  }, 2000);
}

// New Canvas token request flow with better instructions
async function sendCanvasTokenRequest(senderId) {
  const text = "Perfect! Now I need to connect to your Canvas account to sync your assignments.\n\nI'll need your Canvas Access Token for this. Do you know how to get it?";
  
  const message = {
    recipient: { id: senderId },
    message: {
      text: text,
      quick_replies: [
        {
          content_type: "text",
          title: "✅ Yes, I have it",
          payload: "HAVE_TOKEN"
        },
        {
          content_type: "text",
          title: "📖 Show Instructions",
          payload: "SHOW_TUTORIAL"
        },
        {
          content_type: "text",
          title: "🎥 Watch Video Tutorial",
          payload: "SHOW_VIDEO_TUTORIAL"
        }
      ]
    }
  };
  
  await sendMessage(message);
}

// Legacy token request message - kept for backward compatibility
async function sendTokenRequestMessage(senderId) {
  // Redirect to new flow
  await sendCanvasTokenRequest(senderId);
}

// Tutorial message with video link option
async function sendTutorialMessage(senderId) {
  const message = {
    recipient: { id: senderId },
    message: {
      text: "Here's how to get your Canvas Access Token:\n\n1. Log in to your Canvas account\n2. Click on 'Account' → 'Settings'\n3. Scroll to 'Approved Integrations'\n4. Click '+ New Access Token'\n5. Give it a purpose (like 'Easely Bot')\n6. Leave the expiration date empty (or set as desired)\n7. Click 'Generate Token'\n8. IMPORTANT: Copy the token immediately (you won't see it again!)\n\n⚠️ Keep your token secure and don't share it with anyone else!\n\nOnce you have it, paste the token here."
    }
  };
  
  await sendMessage(message);
  
  // After showing instructions, offer video help
  setTimeout(async () => {
    await sendMessage({
      recipient: { id: senderId },
      message: {
        text: "Need visual help? Watch our video tutorial:",
        quick_replies: [
          {
            content_type: "text",
            title: "🎥 Watch Video",
            payload: "SHOW_VIDEO_TUTORIAL"
          },
          {
            content_type: "text",
            title: "✅ I got it!",
            payload: "HAVE_TOKEN"
          }
        ]
      }
    });
  }, 3000);
}

// New function to send video tutorial link
async function sendVideoTutorial(senderId) {
  const message = {
    recipient: { id: senderId },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "🎥 Watch this quick video tutorial on how to get your Canvas Access Token:",
          buttons: [
            { 
              type: "web_url", 
              url: "https://github.com/keanlouis30/EaselyBot/releases/tag/v1.0.0-video", 
              title: "Open Video Tutorial" 
            }
          ]
        }
      }
    }
  };
  
  await sendMessage(message);
  
  // After showing video link, prompt for token
  setTimeout(async () => {
    await sendMessage({
      recipient: { id: senderId },
      message: {
        text: "After getting your token from Canvas, paste it here and I'll connect to your account!"
      }
    });
  }, 3000);
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

// Check Canvas token permissions for task creation
async function checkCanvasPermissions(token) {
  const canvasUrl = process.env.CANVAS_BASE_URL || 'https://dlsu.instructure.com';
  
  try {
    // Test basic user access
    const userResponse = await axios.get(`${canvasUrl}/api/v1/users/self`, {
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 10000
    });
    
    console.log('Canvas user info:', userResponse.data);
    
    // Test planner notes access
    try {
      const plannerResponse = await axios.get(`${canvasUrl}/api/v1/planner_notes`, {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { per_page: 1 },
        timeout: 10000
      });
      console.log('Planner Notes API accessible:', plannerResponse.status === 200);
    } catch (plannerError) {
      console.log('Planner Notes API error:', plannerError.response?.status, plannerError.response?.data);
    }
    
    // Test calendar events access
    try {
      const calendarResponse = await axios.get(`${canvasUrl}/api/v1/calendar_events`, {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { per_page: 1 },
        timeout: 10000
      });
      console.log('Calendar Events API accessible:', calendarResponse.status === 200);
    } catch (calendarError) {
      console.log('Calendar Events API error:', calendarError.response?.status, calendarError.response?.data);
    }
    
    return true;
  } catch (error) {
    console.error('Canvas permissions check failed:', error.response?.data || error.message);
    return false;
  }
}

async function fetchCanvasAssignments(token, options = {}) {
  const canvasUrl = process.env.CANVAS_BASE_URL || 'https://dlsu.instructure.com';
  const { daysAhead = 30, includeOverdue = true } = options;
  
  try {
    // Calculate date range for filtering (to reduce API calls)
    const nowManila = getManilaDate();
    const cutoffDate = new Date(nowManila);
    cutoffDate.setDate(cutoffDate.getDate() - (includeOverdue ? 300 : 0)); // Max 300 days in the past
    const futureDate = new Date(nowManila);
    futureDate.setDate(futureDate.getDate() + daysAhead);
    
    // Get all active courses with rate limit awareness
    const coursesResponse = await axios.get(`${canvasUrl}/api/v1/courses`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params: {
        enrollment_state: 'active',
        per_page: 50 // Reduced from 100 to be more conservative
      },
      timeout: 15000
    });
    
    const courses = coursesResponse.data;
    console.log(`Found ${courses.length} active courses`);
    
    // Fetch assignments for each course with rate limiting
    const allAssignments = [];
    const courseMap = {};
    
    // Process courses in batches to avoid rate limiting
    const batchSize = 3;
    for (let i = 0; i < courses.length; i += batchSize) {
      const courseBatch = courses.slice(i, i + batchSize);
      
      await Promise.all(courseBatch.map(async (course) => {
        courseMap[course.id] = course.name;
        
        try {
          const assignmentsResponse = await axios.get(`${canvasUrl}/api/v1/courses/${course.id}/assignments`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            params: {
              per_page: 50,
              order_by: 'due_at',
              bucket: 'upcoming' // Only get upcoming assignments to reduce load
            },
            timeout: 10000
          });
          
          const courseAssignments = assignmentsResponse.data
            .filter(assignment => {
              if (!assignment.due_at) return false;
              const dueDate = new Date(assignment.due_at);
              // Filter out assignments outside our date range
              return dueDate >= cutoffDate && dueDate <= futureDate;
            })
            .map(assignment => ({
              id: assignment.id,
              title: assignment.name,
              dueDate: new Date(assignment.due_at),
              course: course.name,
              courseId: course.id,
              description: assignment.description,
              htmlUrl: assignment.html_url,
              pointsPossible: assignment.points_possible,
              submissionTypes: assignment.submission_types,
              hasSubmitted: assignment.has_submitted_submissions
            }));
            
          allAssignments.push(...courseAssignments);
          
        } catch (assignmentError) {
          console.warn(`Failed to fetch assignments for course ${course.name}:`, assignmentError.message);
        }
      }));
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < courses.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Filter out assignments more than 300 days overdue
    const filteredAssignments = allAssignments.filter(assignment => {
      const daysDiff = (nowManila - assignment.dueDate) / (1000 * 60 * 60 * 24);
      return daysDiff < 300; // Keep assignments less than 300 days overdue
    });
    
    // Sort by due date
    filteredAssignments.sort((a, b) => a.dueDate - b.dueDate);
    
    console.log(`Fetched ${filteredAssignments.length} assignments (filtered from ${allAssignments.length})`);
    
    return {
      assignments: filteredAssignments,
      courses: courseMap
    };
    
  } catch (error) {
    console.error('Failed to fetch Canvas assignments:', error.response?.status, error.response?.data);
    throw new Error('Failed to sync assignments from Canvas');
  }
}

function formatDueDate(date) {
  // Convert to Manila timezone
  const manilaTimeOptions = { timeZone: 'Asia/Manila' };
  const now = new Date();
  const nowManila = new Date(now.toLocaleString('en-US', manilaTimeOptions));
  const dueDateManila = new Date(date.toLocaleString('en-US', manilaTimeOptions));
  
  const diffMs = dueDateManila.getTime() - nowManila.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  const timeFormatOptions = {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  
  const dateTimeFormatOptions = {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  
  const fullDateFormatOptions = {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  
  if (diffDays === 0) {
    return `Today ${date.toLocaleTimeString('en-US', timeFormatOptions)}`;
  } else if (diffDays === 1) {
    return `Tomorrow ${date.toLocaleTimeString('en-US', timeFormatOptions)}`;
  } else if (diffDays < 7 && diffDays > 0) {
    return date.toLocaleString('en-US', dateTimeFormatOptions);
  } else {
    return date.toLocaleString('en-US', fullDateFormatOptions);
  }
}

// Handle Canvas token submission - Only validate and store token
async function handleCanvasToken(senderId, token) {
  // Send initial loading message
  await sendMessage({
    recipient: { id: senderId },
    message: { text: "🔄 Validating your Canvas token..." }
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
    
    // Token is valid, store it without fetching all assignments
    await updateUser(senderId, {
      canvas_token: token,
      is_onboarded: true,
      canvas_user_name: validation.user.name,
      canvas_user_id: validation.user.id
    });
    
    // Send success message without listing assignments
    const successMessage = `🎉 Successfully connected as ${validation.user.name}!\n\nI'm now connected to your Canvas account. I'll fetch your assignments when you need them to avoid overwhelming the system.\n\nWhat would you like to see?`;
    
    await sendMessage({
      recipient: { id: senderId },
      message: { text: successMessage }
    });
    
    // After a moment, show the main menu
    setTimeout(async () => {
      await sendWelcomeMessage(senderId);
    }, 2000);
    
  } catch (error) {
    console.error('Canvas token validation error:', error);
    
    await sendMessage({
      recipient: { id: senderId },
      message: {
        text: `❌ Sorry, I couldn't validate your Canvas token: ${error.message}\n\nThis might be due to:\n- Network connectivity issues\n- Canvas server being temporarily unavailable\n- Invalid token\n\nPlease try again in a few minutes.`,
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

// Task management functions - Date selection
async function sendTaskDateRequest(senderId) {
  const message = {
    recipient: { id: senderId },
    message: {
      text: "When is this task due? First, choose the date using the buttons:",
      quick_replies: [
        { content_type: "text", title: "📅 Today", payload: "TASK_DATE_TODAY" },
        { content_type: "text", title: "📅 Tomorrow", payload: "TASK_DATE_TOMORROW" },
        { content_type: "text", title: "📅 Friday", payload: "TASK_DATE_FRIDAY" },
        { content_type: "text", title: "📅 Next Monday", payload: "TASK_DATE_NEXT_MONDAY" }
      ]
    }
  };
  await sendMessage(message);
}

// Task management functions - Time selection
async function sendTaskTimeRequest(senderId) {
  const message = {
    recipient: { id: senderId },
    message: {
      text: "Great! Now choose the time using the buttons:",
      quick_replies: [
        { content_type: "text", title: "🌅 8:00 AM", payload: "TASK_TIME_8AM" },
        { content_type: "text", title: "☀️ 12:00 PM", payload: "TASK_TIME_12PM" },
        { content_type: "text", title: "🌆 5:00 PM", payload: "TASK_TIME_5PM" },
        { content_type: "text", title: "🌙 8:00 PM", payload: "TASK_TIME_8PM" },
        { content_type: "text", title: "⏰ 11:59 PM", payload: "TASK_TIME_11_59PM" }
      ]
    }
  };
  await sendMessage(message);
}

// Legacy function - replaced by db.createTask() in database service
// This function is no longer used since migration to database storage

// Create a Planner Note (To-Do) in Canvas
async function createCanvasPlannerNote(senderId, { title, description, dueDate, courseId, courseName }) {
  console.log(`🎯 createCanvasPlannerNote called for user ${senderId}:`, { title, description, courseId, courseName, dueDate: dueDate.toISOString() });
  
  const user = await getUser(senderId);
  if (!user || !user.canvas_token) {
    console.warn(`⚠️ No Canvas token found for user ${senderId}, will create local-only task`);
    return null; // Fail silently, let the calling function handle the fallback
  }
  
  const canvasUrl = process.env.CANVAS_BASE_URL || 'https://dlsu.instructure.com';
  const whenText = formatDateTimeManila(dueDate);
  const courseLabel = courseId ? (courseName || 'Selected Course') : 'Personal';
  
  console.log(`🌐 Canvas URL: ${canvasUrl}, Course: ${courseLabel}`);
  
  // Send loading message first
  await sendMessage({
    recipient: { id: senderId },
    message: { text: `🔄 Creating task in Canvas dashboard...` }
  });
  
  try {
    // Try creating as Planner Note first
    const plannerBody = {
      title: title,
      details: description || '',
      todo_date: dueDate.toISOString()
    };
    if (courseId) plannerBody.course_id = courseId;
    
    console.log('📋 Creating Canvas Planner Note with body:', plannerBody);
    
    const plannerResponse = await axios.post(`${canvasUrl}/api/v1/planner_notes`, plannerBody, {
      headers: {
        'Authorization': `Bearer ${user.canvas_token}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    console.log('✅ Planner Note created successfully:', plannerResponse.data);
    
      await sendMessage({
        recipient: { id: senderId },
        message: { 
          text: `✅ Task created in Canvas Planner!\n\n📝 "${title}"\n📚 ${courseLabel}\n⏰ Due: ${whenText}\n\n💡 It should appear on your Canvas Dashboard > To-Do list and in Planner. If you don't see it, refresh your Dashboard or pull-to-refresh on mobile.` 
        }
      });
    
    // Return task data for local storage
    return {
      title: title,
      dueDate: dueDate,
      course: courseLabel,
      courseId: courseId,
      description: description || '',
      createdAt: new Date().toISOString(),
      isManual: true,
      canvasId: plannerResponse.data.id,
      canvasType: 'planner_note'
    };
    
  } catch (plannerError) {
    console.error(`❌ Planner Note creation failed for user ${senderId}:`, {
      message: plannerError.message,
      status: plannerError.response?.status,
      statusText: plannerError.response?.statusText,
      data: plannerError.response?.data,
      url: plannerError.config?.url
    });
    
    // Provide more structured logging if available
    if (plannerError.response) {
      console.error(`❌ HTTP ${plannerError.response.status} - Planner Note failure:`, plannerError.response.data);
    } else {
      console.error(`❌ Network/Timeout error:`, plannerError.message);
    }
    
    // If Planner Notes fail, try creating as Calendar Event
    try {
      const eventBody = {
        calendar_event: {
          title: `📝 ${title}`,
          description: description ? `Task: ${title}\n\nDescription: ${description}` : `Task: ${title}`,
          start_at: dueDate.toISOString(),
          end_at: new Date(dueDate.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour duration
          all_day: false
        }
      };
      
      if (courseId) {
        eventBody.calendar_event.context_code = `course_${courseId}`;
      }
      
      console.log('Creating Canvas Calendar Event as fallback:', eventBody);
      
      const eventResponse = await axios.post(`${canvasUrl}/api/v1/calendar_events`, eventBody, {
        headers: {
          'Authorization': `Bearer ${user.canvas_token}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });
      
      console.log('Calendar Event created successfully:', eventResponse.data);
      
      await sendMessage({
        recipient: { id: senderId },
        message: { 
          text: `✅ Task created as Canvas Calendar Event!\n\n📝 "${title}"\n📚 ${courseLabel}\n⏰ Due: ${whenText}\n\nℹ️ Note: Calendar events do not show in the Dashboard To-Do list. They appear only in the Calendar view. If you want it on the To-Do list, ensure your token allows creating Planner Notes.` 
        }
      });
      
      // Return task data for local storage
      return {
        title: title,
        dueDate: dueDate,
        course: courseLabel,
        courseId: courseId,
        description: description || '',
        createdAt: new Date().toISOString(),
        isManual: true,
        canvasId: eventResponse.data.id,
        canvasType: 'calendar_event'
      };
      
    } catch (eventError) {
      console.error('Calendar Event creation also failed:', eventError.response?.data || eventError.message);
      
      // If both methods fail, try creating as Assignment (if course is specified)
      if (courseId) {
        try {
          const assignmentBody = {
            assignment: {
              name: title,
              description: description ? `${description}\n\n(Created via EaselyBot)` : '(Created via EaselyBot)',
              due_at: dueDate.toISOString(),
              points_possible: 0,
              submission_types: ['none'],
              published: false // Create as unpublished so it doesn't notify all students
            }
          };
          
          console.log('Creating Canvas Assignment as final fallback:', assignmentBody);
          
          const assignmentResponse = await axios.post(`${canvasUrl}/api/v1/courses/${courseId}/assignments`, assignmentBody, {
            headers: {
              'Authorization': `Bearer ${user.canvas_token}`,
              'Content-Type': 'application/json'
            },
            timeout: 15000
          });
          
          console.log('Assignment created successfully:', assignmentResponse.data);
          
          await sendMessage({
            recipient: { id: senderId },
            message: { 
              text: `✅ Task created as unpublished Canvas Assignment!\n\n📝 "${title}"\n📚 ${courseLabel}\n⏰ Due: ${whenText}\n\n💡 Check your course assignments or gradebook to see the task.` 
            }
          });
          
          // Return task data for local storage
          return {
            title: title,
            dueDate: dueDate,
            course: courseLabel,
            courseId: courseId,
            description: description || '',
            createdAt: new Date().toISOString(),
            isManual: true,
            canvasId: assignmentResponse.data.id,
            canvasType: 'assignment'
          };
          
        } catch (assignmentError) {
          console.error('Assignment creation also failed:', assignmentError.response?.data || assignmentError.message);
          await sendCanvasCreationFailure(senderId, title, courseLabel, whenText, assignmentError);
        }
      } else {
        await sendCanvasCreationFailure(senderId, title, courseLabel, whenText, eventError);
      }
    }
  }
  
  // Return null if all methods failed
  return null;
}

// Fetch recent Planner Notes to verify visibility (debug/helper)
async function fetchRecentPlannerNotes(senderId, { perPage = 5 } = {}) {
  const user = await getUser(senderId);
  if (!user || !user.canvas_token) {
    await sendMessage({ recipient: { id: senderId }, message: { text: '❌ No Canvas token found. Please set up Canvas first from the menu: Canvas Setup.' } });
    return [];
  }
  const canvasUrl = process.env.CANVAS_BASE_URL || 'https://dlsu.instructure.com';
  try {
    const resp = await axios.get(`${canvasUrl}/api/v1/planner_notes`, {
      headers: { 'Authorization': `Bearer ${user.canvas_token}` },
      params: { per_page: perPage },
      timeout: 10000
    });
    return resp.data || [];
  } catch (e) {
    console.error('Failed to fetch recent Planner Notes:', e.response?.status, e.response?.data || e.message);
    return [];
  }
}

// Simple command to test Planner Notes visibility
async function testPlannerNotesVisibility(senderId) {
  await sendMessage({ recipient: { id: senderId }, message: { text: '🔍 Fetching your recent Canvas Planner To-Dos…' } });
  const notes = await fetchRecentPlannerNotes(senderId, { perPage: 5 });
  if (!notes.length) {
    await sendMessage({ recipient: { id: senderId }, message: { text: '❌ I could not read any Planner Notes. Your Canvas token or institution might not allow Planner Notes API. Tasks will only show on Calendar in this case.' } });
    return;
  }
  await sendMessage({ recipient: { id: senderId }, message: { text: `✅ Found ${notes.length} recent Planner To-Dos. Here are the latest:` } });
  for (const n of notes) {
    const when = n.todo_date ? new Date(n.todo_date) : null;
    const whenText = when ? formatDateTimeManila(when) : '(no date)';
    await sendMessage({ recipient: { id: senderId }, message: { text: `• ${n.title || '(no title)'}\n⏰ ${whenText}` } });
    await new Promise(r => setTimeout(r, 300));
  }
}

// View recently created tasks from both local database and Canvas
async function viewRecentCreatedTasks(senderId) {
  const user = await getUser(senderId);
  if (!user || !user.canvas_token) {
    await sendMessage({ 
      recipient: { id: senderId }, 
      message: { text: '❌ No Canvas token found. Please set up Canvas first from the menu: Canvas Setup.' } 
    });
    return;
  }

  await sendMessage({ 
    recipient: { id: senderId }, 
    message: { text: '📋 Checking your recently created tasks...' } 
  });

  try {
    // Get tasks from local database
    const localTasks = await db.getUserTasks(senderId, { upcoming: true, daysAhead: 30 });
    const manualTasks = localTasks.filter(task => task.is_manual);
    
    // Get planner notes from Canvas
    const plannerNotes = await fetchRecentPlannerNotes(senderId, { perPage: 10 });
    
    // Summary message
    await sendMessage({ 
      recipient: { id: senderId }, 
      message: { 
        text: `📊 Task Summary:\n\n🗄️ Tasks in local database: ${manualTasks.length}\n📱 Tasks in Canvas Dashboard: ${plannerNotes.length}\n\nHere are your recent tasks:` 
      } 
    });

    // Display manual tasks from database
    if (manualTasks.length > 0) {
      await sendMessage({ 
        recipient: { id: senderId }, 
        message: { text: '🗄️ **Tasks stored locally:**' } 
      });
      
      for (const task of manualTasks.slice(0, 5)) {
        const whenText = task.due_date ? formatDateTimeManila(new Date(task.due_date)) : 'No due date';
        const canvasInfo = task.canvas_type ? `(${task.canvas_type} in Canvas)` : '(Local only)';
        await sendMessage({ 
          recipient: { id: senderId }, 
          message: { 
            text: `• ${task.title}\n  📚 ${task.course_name}\n  ⏰ ${whenText}\n  💾 ${canvasInfo}` 
          } 
        });
        await new Promise(r => setTimeout(r, 300));
      }
    }

    // Display Canvas planner notes
    if (plannerNotes.length > 0) {
      await sendMessage({ 
        recipient: { id: senderId }, 
        message: { text: '\n📱 **Tasks visible in Canvas Dashboard To-Do list:**' } 
      });
      
      for (const note of plannerNotes.slice(0, 5)) {
        const when = note.todo_date ? new Date(note.todo_date) : null;
        const whenText = when ? formatDateTimeManila(when) : '(no date)';
        const courseInfo = note.course_id ? `Course ID: ${note.course_id}` : 'Personal';
        await sendMessage({ 
          recipient: { id: senderId }, 
          message: { 
            text: `• ${note.title}\n  📚 ${courseInfo}\n  ⏰ ${whenText}` 
          } 
        });
        await new Promise(r => setTimeout(r, 300));
      }
    }

    // Help text if tasks are not syncing
    if (manualTasks.length > 0 && plannerNotes.length === 0) {
      await sendMessage({ 
        recipient: { id: senderId }, 
        message: { 
          text: `⚠️ Your tasks are stored locally but not showing in Canvas Dashboard.\n\nThis could mean:\n• Your Canvas token doesn't have Planner Notes permission\n• Tasks were created as Calendar Events (check Canvas Calendar)\n• Canvas sync is delayed\n\nTry refreshing your Canvas Dashboard or pulling-to-refresh on mobile.` 
        } 
      });
    }
  } catch (error) {
    console.error('Error viewing recent tasks:', error);
    await sendMessage({ 
      recipient: { id: senderId }, 
      message: { text: '❌ Error fetching task information. Please try again later.' } 
    });
  }
}

// Handle Canvas creation failure with detailed error message
async function sendCanvasCreationFailure(senderId, title, courseLabel, whenText, error) {
  const errorDetails = error.response?.data ? 
    (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data)) : 
    error.message;
  
  console.error('All Canvas creation methods failed. Error details:', errorDetails);
  
  await sendMessage({ 
    recipient: { id: senderId }, 
    message: { 
      text: `❌ Could not create task in Canvas Dashboard.\n\n📝 Task: "${title}"\n📚 Course: ${courseLabel}\n⏰ Due: ${whenText}\n\n🔧 This might be due to:\n• Canvas API permissions\n• Network connectivity\n• Canvas server issues\n\nPlease add this task manually to your Canvas or try again later.` 
    } 
  });
}

// List user's active courses (id, name)
async function listUserCourses(token) {
  const canvasUrl = process.env.CANVAS_BASE_URL || 'https://dlsu.instructure.com';
  const res = await axios.get(`${canvasUrl}/api/v1/courses`, {
    headers: { 'Authorization': `Bearer ${token}` },
    params: { enrollment_state: 'active', per_page: 50 },
    timeout: 10000
  });
  return (res.data || []).map(c => ({ id: c.id, name: c.name }));
}

// Combine date and time into a single Date object (using Manila timezone)
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

// Helper function to get current date/time in Manila timezone
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
  const second = parseInt(parts.find(p => p.type === 'second').value);
  
  // Create a proper Manila time Date object
  return buildManilaDateFromParts({ year, month, day, hour, minute });
}

// Helper function to check if two dates are the same day in Manila timezone
function isSameDayManila(date1, date2) {
  // Get date parts directly in Manila timezone using Intl.DateTimeFormat
  const getDateParts = (date) => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit'
    });
    return formatter.format(date);
  };
  
  return getDateParts(date1) === getDateParts(date2);
}

// Build a Date that represents a specific local time in Manila (UTC+08:00)
function buildManilaDateFromParts({ year, month, day, hour = 17, minute = 0 }) {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  // Use explicit +08:00 offset to avoid relying on host timezone
  return new Date(`${y}-${m}-${d}T${hh}:${mm}:00+08:00`);
}

// Get the next occurrence of a weekday in Manila timezone
// targetDow: 0=Sun ... 6=Sat. If preferNext is true and today is the target, returns next week's target.
function getTargetWeekdayManila(targetDow, preferNext = false) {
  const now = getManilaDate();
  
  // Get current day of week in Manila timezone (0=Sunday, 1=Monday, etc.)
  const currentManilaDate = new Date().toLocaleDateString('en-US', { 
    timeZone: 'Asia/Manila',
    weekday: 'long'
  });
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDow = dayNames.indexOf(currentManilaDate);
  
  let delta = (targetDow - currentDow + 7) % 7;
  if (delta === 0 && preferNext) delta = 7;
  
  // Get current Manila date parts
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  
  const year = parseInt(parts.find(p => p.type === 'year').value);
  const month = parseInt(parts.find(p => p.type === 'month').value);
  const day = parseInt(parts.find(p => p.type === 'day').value);
  
  // Create target date by adding delta days
  const targetDate = new Date(year, month - 1, day + delta);
  
  return buildManilaDateFromParts({
    year: targetDate.getFullYear(),
    month: targetDate.getMonth() + 1,
    day: targetDate.getDate(),
    hour: 0,
    minute: 0
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

// Format assignment details in clean text format without ANSI colors
function formatAssignmentMessage(assignment, options = {}) {
  const { showCourseTag = false, isManual = false } = options;
  
  const dueTime = assignment.dueDate.toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  // Build the assignment URL if available
  let assignmentUrl = '';
  if (assignment.htmlUrl) {
    assignmentUrl = assignment.htmlUrl;
  } else if (assignment.courseId && assignment.id) {
    const canvasUrl = process.env.CANVAS_BASE_URL || 'https://dlsu.instructure.com';
    assignmentUrl = `${canvasUrl}/courses/${assignment.courseId}/assignments/${assignment.id}`;
  }
  
  // Format the message in clean text without colors
  let message = '';
  
  message += `📝 ${assignment.title}${isManual ? ' (Manual)' : ''}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  if (showCourseTag || assignment.course) {
    message += `📚 Course: [${assignment.course || 'Personal'}]\n`;
  }
  
  message += `⏰ Due: ${dueTime}\n`;
  
  if (assignment.pointsPossible) {
    message += `💯 Points: ${assignment.pointsPossible}\n`;
  }
  
  // Add Canvas link if available
  if (assignmentUrl) {
    message += `🔗 Link: ${assignmentUrl}\n`;
  }
  
  return message;
}

// Task display functions
async function sendTasksToday(senderId) {
  const user = await getUser(senderId);
  
  if (!user || !user.canvas_token) {
    await sendMessage({
      recipient: { id: senderId },
      message: { text: "❌ No Canvas token found. Please add your Canvas token to sync assignments!" }
    });
    return;
  }
  
  // Send loading message
  await sendMessage({
    recipient: { id: senderId },
    message: { text: "🔄 Fetching today's tasks from Canvas..." }
  });
  
  try {
    // Fetch fresh data from Canvas
    const canvasData = await fetchCanvasAssignments(user.canvas_token);
    const todayManila = getManilaDate();
    
    const todayCanvasTasks = canvasData.assignments.filter(assignment => {
      // Filter by today in Manila timezone
      return isSameDayManila(assignment.dueDate, todayManila);
    });
    
    // Get manual tasks from database due today (database query now handles Manila timezone)
    const databaseTasks = await db.getUserTasks(senderId, { dueToday: true });
    const todayManualTasks = databaseTasks
      .filter(task => task.is_manual && task.due_date) // Only filter for manual tasks with due dates
      .map(dbTask => ({
        id: dbTask.canvas_id || dbTask.id,
        title: dbTask.title,
        dueDate: new Date(dbTask.due_date),
        course: dbTask.course_name,
        courseId: dbTask.canvas_course_id,
        description: dbTask.description,
        isManual: true,
        canvasType: dbTask.canvas_type
      }));
    
    const totalTasks = todayCanvasTasks.length + todayManualTasks.length;
    
    // Send header message
    await sendMessage({
      recipient: { id: senderId },
      message: { text: `🔥 Tasks due today (${todayManila.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'long', month: 'short', day: 'numeric' })}):` }
    });
    
    if (totalTasks > 0) {
      // Send Canvas assignments first
      for (const assignment of todayCanvasTasks) {
        const assignmentText = formatAssignmentMessage(assignment, { showCourseTag: true });
        
        await sendMessage({
          recipient: { id: senderId },
          message: { text: assignmentText }
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Send manual tasks
      for (const task of todayManualTasks) {
        const taskText = formatAssignmentMessage(task, { showCourseTag: true, isManual: true });
        
        await sendMessage({
          recipient: { id: senderId },
          message: { text: taskText }
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } else {
      await sendMessage({
        recipient: { id: senderId },
        message: { text: "🎉 No tasks due today! You're all caught up!" }
      });
    }
    
    // Send motivational footer
    await sendMessage({
      recipient: { id: senderId },
      message: { text: "💪 You're doing great! Keep it up!" }
    });
    
  } catch (error) {
    console.error('Error fetching today\'s tasks:', error);
    await sendMessage({
      recipient: { id: senderId },
      message: { text: "❌ Sorry, I couldn't fetch your assignments right now. Please try again later." }
    });
  }
}

async function sendTasksWeek(senderId) {
  const user = await getUser(senderId);
  
  if (!user || !user.canvas_token) {
    await sendMessage({
      recipient: { id: senderId },
      message: { text: "❌ No Canvas token found. Please add your Canvas token to sync assignments!" }
    });
    return;
  }
  
  // Send loading message
  await sendMessage({
    recipient: { id: senderId },
    message: { text: "🔄 Fetching this week's tasks from Canvas..." }
  });
  
  try {
    // Fetch fresh data from Canvas
    const canvasData = await fetchCanvasAssignments(user.canvas_token);
    const todayManila = getManilaDate();
    const nextWeekManila = getManilaDate();
    nextWeekManila.setDate(nextWeekManila.getDate() + 7);
    
    const weekCanvasTasks = canvasData.assignments.filter(assignment => {
      const dueDateManila = getManilaDate(assignment.dueDate);
      return dueDateManila >= todayManila && dueDateManila <= nextWeekManila;
    });
    
    // Get manual tasks from database due this week (database query now handles Manila timezone)
    const databaseTasks = await db.getUserTasks(senderId, { upcoming: true, daysAhead: 7 });
    const weekManualTasks = databaseTasks
      .filter(task => task.is_manual && task.due_date) // Only filter for manual tasks with due dates
      .map(dbTask => ({
        id: dbTask.canvas_id || dbTask.id,
        title: dbTask.title,
        dueDate: new Date(dbTask.due_date),
        course: dbTask.course_name,
        courseId: dbTask.canvas_course_id,
        description: dbTask.description,
        isManual: true,
        canvasType: dbTask.canvas_type
      }));
    
    const weekTasks = [...weekCanvasTasks, ...weekManualTasks];
    
    // Send header message
    const weekEndDate = nextWeekManila.toLocaleDateString('en-US', {
      timeZone: 'Asia/Manila',
      month: 'short',
      day: 'numeric'
    });
    await sendMessage({
      recipient: { id: senderId },
      message: { text: `⏰ Tasks due this week (until ${weekEndDate}):` }
    });
    
    if (weekTasks.length > 0) {
      // Group tasks by day for better organization
      const tasksByDay = {};
      weekTasks.forEach(assignment => {
        const dayKey = assignment.dueDate.toLocaleDateString('en-US', {
          timeZone: 'Asia/Manila',
          weekday: 'long',
          month: 'short',
          day: 'numeric'
        });
        if (!tasksByDay[dayKey]) {
          tasksByDay[dayKey] = [];
        }
        tasksByDay[dayKey].push(assignment);
      });
      
      // Send tasks grouped by day
      for (const [day, tasks] of Object.entries(tasksByDay)) {
        await sendMessage({
          recipient: { id: senderId },
          message: { text: `📅 **${day}**` }
        });
        
        for (const assignment of tasks) {
          const assignmentText = formatAssignmentMessage(assignment, { 
            showCourseTag: true, 
            isManual: assignment.isManual 
          });
          
          await sendMessage({
            recipient: { id: senderId },
            message: { text: assignmentText }
          });
          
          // Small delay between messages
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      await sendMessage({
        recipient: { id: senderId },
        message: { text: `📊 Total: ${weekTasks.length} assignment${weekTasks.length === 1 ? '' : 's'} this week` }
      });
    } else {
      await sendMessage({
        recipient: { id: senderId },
        message: { text: "🎉 No assignments due this week! Enjoy your free time!" }
      });
    }
    
    // Send motivational footer
    await sendMessage({
      recipient: { id: senderId },
      message: { text: "📚 Stay organized! You've got this!" }
    });
    
  } catch (error) {
    console.error('Error fetching week\'s tasks:', error);
    await sendMessage({
      recipient: { id: senderId },
      message: { text: "❌ Sorry, I couldn't fetch your assignments right now. Please try again later." }
    });
  }
}

async function sendOverdueTasks(senderId) {
  const user = await getUser(senderId);
  
  if (!user || !user.canvas_token) {
    await sendMessage({
      recipient: { id: senderId },
      message: { text: "❌ No Canvas token found. Please add your Canvas token to sync assignments!" }
    });
    return;
  }
  
  // Send loading message
  await sendMessage({
    recipient: { id: senderId },
    message: { text: "🔄 Checking for overdue tasks..." }
  });
  
  try {
    // Fetch fresh data from Canvas
    const canvasData = await fetchCanvasAssignments(user.canvas_token);
    const nowManila = getManilaDate();
    const cutoffDate = getManilaDate();
    cutoffDate.setDate(cutoffDate.getDate() - 300); // 300 days ago
    
    const overdueCanvasTasks = canvasData.assignments.filter(assignment => {
      const dueDateManila = getManilaDate(assignment.dueDate);
      // Only show tasks that are overdue but not more than 300 days old
      return dueDateManila < nowManila && dueDateManila > cutoffDate;
    });
    
    // Get manual tasks from database that are overdue (database query now handles Manila timezone)
    const databaseTasks = await db.getUserTasks(senderId, { overdue: true });
    const overdueManualTasks = databaseTasks
      .filter(task => task.is_manual && task.due_date) // Only filter for manual tasks with due dates
      .map(dbTask => ({
        id: dbTask.canvas_id || dbTask.id,
        title: dbTask.title,
        dueDate: new Date(dbTask.due_date),
        course: dbTask.course_name,
        courseId: dbTask.canvas_course_id,
        description: dbTask.description,
        isManual: true,
        canvasType: dbTask.canvas_type
      }));
    
    // Filter out tasks older than 300 days for UI purposes (database might return more)
    // Reuse cutoffDate already declared above
    const filteredOverdueManualTasks = overdueManualTasks.filter(task => {
      const dueDateManila = getManilaDate(task.dueDate);
      return dueDateManila > cutoffDate; // Keep tasks newer than 300 days
    });
    
    const overdueTasks = [...overdueCanvasTasks, ...filteredOverdueManualTasks];
    
    // Sort by how recently they were due (most recent first)
    overdueTasks.sort((a, b) => b.dueDate - a.dueDate);
    
    // Send header message
    await sendMessage({
      recipient: { id: senderId },
      message: { text: "⚠ Overdue tasks (excluding items older than 300 days):" }
    });
    
    if (overdueTasks.length > 0) {
      // Limit to 15 most recent overdue tasks
      const tasksToShow = overdueTasks.slice(0, 15);
      
      for (const assignment of tasksToShow) {
        const daysOverdue = Math.floor((nowManila - assignment.dueDate) / (1000 * 60 * 60 * 24));
        const overdueText = daysOverdue === 1 ? '1 day' : `${daysOverdue} days`;
        
        // Use formatter with additional overdue information
        let assignmentText = formatAssignmentMessage(assignment, { 
          showCourseTag: true, 
          isManual: assignment.isManual 
        });
        
        // Add overdue indicator
        assignmentText = assignmentText.replace('```', `🔴 OVERDUE: ${overdueText}\n\`\`\``);
        
        await sendMessage({
          recipient: { id: senderId },
          message: { text: assignmentText }
        });
        
        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (overdueTasks.length > 15) {
        await sendMessage({
          recipient: { id: senderId },
          message: { text: `... and ${overdueTasks.length - 15} more overdue assignments` }
        });
      }
      
      await sendMessage({
        recipient: { id: senderId },
        message: { text: "💡 Don't worry! You can still submit these. Contact your instructors if you need extensions." }
      });
    } else {
      await sendMessage({
        recipient: { id: senderId },
        message: { text: "🎉 No overdue tasks! You're staying on top of everything. Great job!" }
      });
    }
    
  } catch (error) {
    console.error('Error fetching overdue tasks:', error);
    await sendMessage({
      recipient: { id: senderId },
      message: { text: "❌ Sorry, I couldn't fetch your assignments right now. Please try again later." }
    });
  }
}

async function sendAllUpcoming(senderId) {
  const user = await getUser(senderId);
  
  if (!user || !user.canvas_token) {
    await sendMessage({
      recipient: { id: senderId },
      message: { text: "❌ No Canvas token found. Please add your Canvas token to sync assignments!" }
    });
    return;
  }
  
  // Send loading message
  await sendMessage({
    recipient: { id: senderId },
    message: { text: "🔄 Fetching all upcoming assignments from Canvas..." }
  });
  
  try {
    // Fetch fresh data from Canvas
    const canvasData = await fetchCanvasAssignments(user.canvas_token);
    const nowManila = getManilaDate();
    
    const upcomingCanvasTasks = canvasData.assignments.filter(assignment => {
      const dueDateManila = getManilaDate(assignment.dueDate);
      return dueDateManila >= nowManila;
    });
    
    // Get manual tasks from database that are upcoming (database query now handles Manila timezone)
    const databaseTasks = await db.getUserTasks(senderId, { upcoming: true, daysAhead: 365 }); // Get all upcoming tasks (1 year)
    const upcomingManualTasks = databaseTasks
      .filter(task => task.is_manual && task.due_date) // Only filter for manual tasks with due dates
      .map(dbTask => ({
        id: dbTask.canvas_id || dbTask.id,
        title: dbTask.title,
        dueDate: new Date(dbTask.due_date),
        course: dbTask.course_name,
        courseId: dbTask.canvas_course_id,
        description: dbTask.description,
        isManual: true,
        canvasType: dbTask.canvas_type
      }));
    
    const upcomingTasks = [...upcomingCanvasTasks, ...upcomingManualTasks];
    
    // Sort all tasks by due date
    upcomingTasks.sort((a, b) => a.dueDate - b.dueDate);
    
    // Send header message
    await sendMessage({
      recipient: { id: senderId },
      message: { text: `📅 All upcoming assignments (${upcomingTasks.length} total):` }
    });
    
    if (upcomingTasks.length > 0) {
      // Limit to 20 assignments to avoid overwhelming
      const tasksToShow = upcomingTasks.slice(0, 20);
      
      // Group by month for better organization
      const tasksByMonth = {};
      tasksToShow.forEach(assignment => {
        const monthKey = assignment.dueDate.toLocaleDateString('en-US', {
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: 'long'
        });
        if (!tasksByMonth[monthKey]) {
          tasksByMonth[monthKey] = [];
        }
        tasksByMonth[monthKey].push(assignment);
      });
      
      // Send tasks grouped by month
      for (const [month, tasks] of Object.entries(tasksByMonth)) {
        await sendMessage({
          recipient: { id: senderId },
          message: { text: `📆 **${month}**` }
        });
        
        for (const assignment of tasks) {
          const assignmentText = formatAssignmentMessage(assignment, { 
            showCourseTag: true,
            isManual: assignment.isManual
          });
          
          await sendMessage({
            recipient: { id: senderId },
            message: { text: assignmentText }
          });
          
          // Small delay between messages
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      if (upcomingTasks.length > 20) {
        await sendMessage({
          recipient: { id: senderId },
          message: { text: `📊 Showing 20 of ${upcomingTasks.length} total upcoming assignments` }
        });
      }
    } else {
      await sendMessage({
        recipient: { id: senderId },
        message: { text: "🎉 No upcoming assignments! Your schedule is clear!" }
      });
    }
    
    // Send motivational footer
    await sendMessage({
      recipient: { id: senderId },
      message: { text: "💼 Stay focused and tackle them one by one!" }
    });
    
  } catch (error) {
    console.error('Error fetching upcoming tasks:', error);
    await sendMessage({
      recipient: { id: senderId },
      message: { text: "❌ Sorry, I couldn't fetch your assignments right now. Please try again later." }
    });
  }
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

// Prompt for course selection using user's Canvas courses
async function sendCourseSelection(senderId) {
  const user = await getUser(senderId);
  if (!user || !user.canvas_token) {
    await sendMessage({ recipient: { id: senderId }, message: { text: "❌ No Canvas token found. Please set up Canvas first from the menu: Canvas Setup." } });
    return;
  }
  try {
    const courses = await listUserCourses(user.canvas_token);
    const quickReplies = [];
    // Add up to 10 courses as quick replies
    courses.slice(0, 10).forEach(c => {
      const title = c.name.length > 20 ? c.name.slice(0, 19) + '…' : c.name;
      quickReplies.push({ content_type: 'text', title, payload: `SELECT_COURSE_${c.id}` });
    });
    // Add Personal and Other options
    quickReplies.push({ content_type: 'text', title: '📁 Personal', payload: 'SELECT_COURSE_PERSONAL' });
    quickReplies.push({ content_type: 'text', title: '✏️ Other Course', payload: 'SELECT_COURSE_OTHER' });

    await sendMessage({
      recipient: { id: senderId },
      message: {
        text: 'Which course is this task for?',
        quick_replies: quickReplies
      }
    });
  } catch (e) {
    console.error('Failed to fetch courses for selection:', e.message);
    await sendMessage({ recipient: { id: senderId }, message: { text: 'I could not load your courses. Please try again later.' } });
  }
}

async function sendAskCustomCourseName(senderId) {
  await sendMessage({ recipient: { id: senderId }, message: { text: 'Please type the course name:' } });
}

async function sendDescriptionRequest(senderId) {
  await sendMessage({ recipient: { id: senderId }, message: { text: 'Add a short description for this task (optional). You can also skip by sending a dash (-).' } });
}

// New handler functions for persistent menu items
async function sendMyTasks(senderId) {
  const message = {
    recipient: { id: senderId },
    message: {
      text: "📋 My Tasks - What would you like to see?",
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

async function sendCanvasSetup(senderId) {
  const user = await getUser(senderId);
  
  if (!user || !user.canvas_token) {
    const message = {
      recipient: { id: senderId },
      message: {
        text: "🔧 Canvas Setup\n\nI don't see a Canvas token connected to your account. Let's set that up!\n\nDo you know how to get your Canvas Access Token?",
        quick_replies: [
          {
            content_type: "text",
            title: "✅ Yes, I have it",
            payload: "HAVE_TOKEN"
          },
          {
            content_type: "text",
            title: "📖 Show Instructions",
            payload: "SHOW_TUTORIAL"
          },
          {
            content_type: "text",
            title: "🎥 Watch Video Tutorial",
            payload: "SHOW_VIDEO_TUTORIAL"
          }
        ]
      }
    };
    
    await sendMessage(message);
  } else {
    const message = {
      recipient: { id: senderId },
      message: {
        text: `🔧 Canvas Setup\n\n✅ Connected as: ${user.canvas_user_name || 'Canvas User'}\n\nYour Canvas account is already connected and working properly!\n\nWhat would you like to do?`,
        quick_replies: [
          {
            content_type: "text",
            title: "🔄 Reconnect Canvas",
            payload: "SHOW_TUTORIAL"
          },
          {
            content_type: "text",
            title: "🧪 Test Connection",
            payload: "TEST_CANVAS_CONNECTION"
          },
          {
            content_type: "text",
            title: "🔍 Check Recent Tasks",
            payload: "VIEW_RECENT_TASKS"
          },
          {
            content_type: "text",
            title: "📋 View My Tasks",
            payload: "MY_TASKS"
          }
        ]
      }
    };
    
    await sendMessage(message);
  }
}

async function sendHelpAndSupport(senderId) {
  const message = {
    recipient: { id: senderId },
    message: {
      text: "❓ Help & Support\n\nI'm here to help! What do you need assistance with?",
      quick_replies: [
        {
          content_type: "text",
          title: "🔧 Canvas Setup Help",
          payload: "CANVAS_SETUP"
        },
        {
          content_type: "text",
          title: "📖 How to Use Easely",
          payload: "HOW_TO_USE"
        },
        {
          content_type: "text",
          title: "🐛 Report a Problem",
          payload: "REPORT_PROBLEM"
        },
        {
          content_type: "text",
          title: "💡 Feature Request",
          payload: "FEATURE_REQUEST"
        },
        {
          content_type: "text",
          title: "📞 Contact Support",
          payload: "CONTACT_SUPPORT"
        }
      ]
    }
  };
  
  await sendMessage(message);
}

async function sendUpgradeToPremium(senderId) {
  const user = await getUser(senderId);
  
  if (user?.subscription_tier === 'premium') {
    const message = {
      recipient: { id: senderId },
      message: {
        text: "🌟 Premium Status\n\n✅ You're already a Premium subscriber!\n\nYou have access to:\n• Full proximity reminders (1w, 3d, 1d, 8h, 2h, 1h)\n• Unlimited manual tasks\n• AI-powered outline generation\n• Personalized weekly digest\n• Calendar export\n\nThank you for supporting Easely! 💙"
      }
    };
    
    await sendMessage(message);
  } else {
    const message = {
      recipient: { id: senderId },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text: "🌟 Upgrade to Premium\n\nUnlock powerful features:\n• Full proximity reminders (1w, 3d, 1d, 8h, 2h, 1h)\n• Unlimited manual tasks\n• AI-powered outline generation\n• Personalized weekly digest\n• Calendar export\n\nSupport Easely's development for just $3/month!",
            buttons: [
              {
                type: "web_url",
                url: "https://ko-fi.com/easely",
                title: "☕ Support on Ko-fi"
              }
            ]
          }
        }
      }
    };
    
    await sendMessage(message);
    
    // Follow up with activation instructions
    setTimeout(async () => {
      await sendMessage({
        recipient: { id: senderId },
        message: {
          text: "After supporting on Ko-fi, send me the word 'activate' to enable your Premium features! 🚀"
        }
      });
    }, 3000);
  }
}

// Additional helper functions for Help & Support menu
async function testCanvasConnection(senderId) {
  const user = await getUser(senderId);
  
  if (!user || !user.canvas_token) {
    await sendMessage({
      recipient: { id: senderId },
      message: { text: "No Canvas token found. Please set up Canvas first!\n\nUse 'Canvas Setup' from the menu to connect your account." }
    });
    return;
  }
  
  await sendMessage({
    recipient: { id: senderId },
    message: { text: "🔍 Testing your Canvas connection and permissions..." }
  });
  
  try {
    const validation = await validateCanvasToken(user.canvas_token);
    
    if (validation.valid) {
      // Check permissions for task creation
      await checkCanvasPermissions(user.canvas_token);
      
      const canvasUrl = process.env.CANVAS_BASE_URL || 'https://dlsu.instructure.com';
      const successMessage = `✅ Connection successful!\n\n👤 Connected as: ${validation.user.name}\n🌐 Canvas URL: ${canvasUrl}\n\n💡 Your Canvas connection is working. If task creation fails, it might be due to API permissions on your Canvas token.`;
      await sendMessage({
        recipient: { id: senderId },
        message: { text: successMessage }
      });
    } else {
      await sendMessage({
        recipient: { id: senderId },
        message: { text: `❌ Connection failed: ${validation.error}\n\nPlease try reconnecting your Canvas account.` }
      });
    }
  } catch (error) {
    await sendMessage({
      recipient: { id: senderId },
      message: { text: `❌ Connection test failed: ${error.message}\n\nPlease check your internet connection and try again.` }
    });
  }
}

async function sendHowToUse(senderId) {
  const messages = [
    "How to Use Easely\n\n1. **Connect Canvas**: First, connect your Canvas account using your Access Token\n\n2. **View Tasks**: Use 'My Tasks' to see assignments Due Today, This Week, Overdue, or All Upcoming\n\n3. **Add Custom Tasks**: Create manual tasks that sync with your Canvas Calendar",
    "4. **Get Reminders**: Receive notifications before assignments are due (Premium: multiple reminders)\n\n5. **Stay Organized**: Check in daily to review your tasks and deadlines\n\n**Pro Tips**:\n• Say 'menu' anytime to see options\n• Say 'activate' after Ko-fi support to enable Premium\n• Check 'Due Today' each morning to plan your day"
  ];
  
  for (const text of messages) {
    await sendMessage({
      recipient: { id: senderId },
      message: { text }
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function sendReportProblem(senderId) {
  await sendMessage({
    recipient: { id: senderId },
    message: {
      text: "Report a Problem\n\nI'm sorry you're experiencing issues! Please describe the problem you're facing, and I'll log it for our development team.\n\nCommon issues:\n• Canvas not syncing\n• Incorrect due dates\n• Missing assignments\n• Login problems\n\nPlease describe your issue:"
    }
  });
  
  // Could set a session to capture the problem description
  await setUserSession(senderId, { flow: 'report_problem', step: 'description' });
}

async function sendFeatureRequest(senderId) {
  await sendMessage({
    recipient: { id: senderId },
    message: {
      text: "Feature Request\n\nWe love hearing your ideas! What feature would you like to see in Easely?\n\nPopular requests:\n• Grade tracking\n• Assignment submission\n• Course schedule view\n• Study groups\n• Custom reminder times\n\nPlease share your idea:"
    }
  });
  
  // Could set a session to capture the feature request
  await setUserSession(senderId, { flow: 'feature_request', step: 'description' });
}

async function sendContactSupport(senderId) {
  const message = {
    recipient: { id: senderId },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "Contact Support\n\nNeed direct assistance? Reach out through:\n\nEmail: support@easely.app\nFacebook: Message our page\nTwitter: @EaselyApp\n\nFor fastest response, include:\n• Your issue description\n• Canvas institution name\n• Screenshots if applicable",
          buttons: [
            {
              type: "web_url",
              url: "mailto:support@easely.app",
              title: "Email Support"
            }
          ]
        }
      }
    }
  };
  
  await sendMessage(message);
}

// Generic response for unhandled messages
async function sendGenericResponse(senderId) {
  const message = {
    recipient: { id: senderId },
    message: {
      text: "I didn't quite understand that. Here are some things you can try:\n\n• Say 'menu' to see all options\n• Use the menu button below\n• Check your tasks with 'due today' or 'due this week'\n• Add a task by saying 'add task'\n\nWhat would you like to do? 🤖"
    }
  };
  
  await sendMessage(message);
}

// Handle task date quick replies
async function handleTaskDateQuickReply(senderId, dateType) {
  const session = await getUserSession(senderId);
  if (!session || session.flow !== 'add_task' || session.step !== 'date') {
    await sendGenericResponse(senderId);
    return;
  }
  
  const now = getManilaDate();
  let taskDate;
  
  // Helper function to extract Manila date components
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
  
  switch (dateType) {
    case 'today':
      const todayParts = getManilaDateParts(new Date());
      taskDate = buildManilaDateFromParts({
        year: todayParts.year,
        month: todayParts.month,
        day: todayParts.day,
        hour: 0,
        minute: 0
      });
      break;
    case 'tomorrow':
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1); // Add 1 day in UTC to avoid timezone confusion
      const tomorrowParts = getManilaDateParts(tomorrow);
      taskDate = buildManilaDateFromParts({
        year: tomorrowParts.year,
        month: tomorrowParts.month,
        day: tomorrowParts.day,
        hour: 0,
        minute: 0
      });
      break;
    case 'friday':
      const targetFriday = getTargetWeekdayManila(5, true); // 5 = Friday, preferNext = true
      const fridayParts = getManilaDateParts(targetFriday);
      taskDate = buildManilaDateFromParts({
        year: fridayParts.year,
        month: fridayParts.month,
        day: fridayParts.day,
        hour: 0,
        minute: 0
      });
      break;
    case 'nextmonday':
      const targetMonday = getTargetWeekdayManila(1, true); // 1 = Monday, preferNext = true
      const mondayParts = getManilaDateParts(targetMonday);
      taskDate = buildManilaDateFromParts({
        year: mondayParts.year,
        month: mondayParts.month,
        day: mondayParts.day,
        hour: 0,
        minute: 0
      });
      break;
    default:
      await sendGenericResponse(senderId);
      return;
  }
  
  // Store date and ask for time
  await setUserSession(senderId, { ...session, step: 'time', taskDate });
  await sendTaskTimeRequest(senderId);
}

// Handle task time quick replies
async function handleTaskTimeQuickReply(senderId, hour, minute) {
  console.log(`⏰ Processing time selection for user ${senderId}: ${hour}:${minute}`);
  
  const session = await getUserSession(senderId);
  if (!session || session.flow !== 'add_task' || session.step !== 'time' || !session.taskDate) {
    console.error(`❌ Invalid session state for user ${senderId}:`, {
      hasSession: !!session,
      flow: session?.flow,
      step: session?.step,
      hasTaskDate: !!session?.taskDate
    });
    await sendGenericResponse(senderId);
    return;
  }
  
  console.log(`📝 Task details:`, {
    title: session.taskTitle,
    description: session.description,
    course: session.courseName,
    courseId: session.courseId,
    taskDate: session.taskDate
  });
  
  try {
    // Ensure taskDate is a Date object (it might be stored as string)
    const taskDate = session.taskDate instanceof Date ? session.taskDate : new Date(session.taskDate);
    console.log(`📋 Retrieved task date:`, taskDate.toISOString());
    
    // Combine stored date with selected time
    const finalDateTime = combineDateAndTime(taskDate, { hour, minute });
    console.log(`🗓️ Final task date/time: ${finalDateTime.toISOString()}`);
    
    // Send immediate acknowledgment to user
    await sendMessage({
      recipient: { id: senderId },
      message: { text: `⏳ Creating your task "${session.taskTitle}"...` }
    });
    
    // Create the task in Canvas using Planner Notes
    console.log(`🔄 Starting Canvas task creation for user ${senderId}`);
    const createdTask = await createCanvasPlannerNote(senderId, {
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
        canvasType: null // NULL for local-only tasks to avoid DB constraint violation
      };
      
      try {
        await db.createTask(senderId, fallbackTask);
        console.log(`💾 Fallback task stored in database for user ${senderId}`);
        
        // Send success message with note about Canvas sync failure
        await sendMessage({
          recipient: { id: senderId },
          message: { 
            text: `✅ Task "${session.taskTitle}" created successfully!\n\n🗓️ Due: ${formatDateTimeManila(finalDateTime)}\n💻 Course: ${session.courseName || 'Personal'}\n\n⚠️ Note: Could not sync to Canvas Dashboard. You may need to add it manually to Canvas if needed.` 
          }
        });
      } catch (dbError) {
        console.error('❌ Fallback task creation also failed:', dbError);
        
        // Last resort: just acknowledge the task was received
        await sendMessage({
          recipient: { id: senderId },
          message: { 
            text: `❌ Sorry, I couldn't save your task "${session.taskTitle}" to the system. Please add it manually to Canvas.\n\n🗓️ Due: ${formatDateTimeManila(finalDateTime)}\n💻 Course: ${session.courseName || 'Personal'}` 
          }
        });
      }
    }
    
  } catch (error) {
    console.error(`💥 Unexpected error in handleTaskTimeQuickReply for user ${senderId}:`, error);
    
    // Send error message to user
    await sendMessage({
      recipient: { id: senderId },
      message: { 
        text: `❌ Sorry, there was an error creating your task "${session.taskTitle}". Please try again or add it manually to Canvas.` 
      }
    });
  } finally {
    // Always clean up session and show welcome message
    console.log(`🧹 Cleaning up session for user ${senderId}`);
    await clearUserSession(senderId);
    
    // Show updated task list after a moment
    setTimeout(async () => {
      console.log(`🏠 Showing welcome message to user ${senderId}`);
      await sendWelcomeMessage(senderId);
    }, 2000);
  }
}


// Helper function to check if text looks like a Canvas token
function isCanvasToken(text) {
  // Canvas tokens are typically:
  // - 64+ characters long
  // - Start with a number followed by ~ 
  // - Contains letters, numbers, tildes, and sometimes other special chars
  // Be more lenient to avoid false negatives
  return text.length >= 40 && /^[0-9]+~[a-zA-Z0-9~._-]+$/.test(text.trim());
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

// Broadcast message to multiple users
async function broadcastMessage(message, targetUsers = 'all', testMode = false) {
  const results = {
    total: 0,
    successful: 0,
    failed: 0,
    errors: []
  };
  
  // Get target user list from database
  let targetUserIds = [];
  
  if (targetUsers === 'all') {
    // Send to all onboarded users (legacy support)
    const users = await db.getAllUsers('onboarded');
    targetUserIds = users.map(user => user.sender_id);
  } else if (targetUsers === 'onboarded') {
    // Send to all onboarded users
    const users = await db.getAllUsers('onboarded');
    targetUserIds = users.map(user => user.sender_id);
  } else if (targetUsers === 'premium') {
    // Send to premium users only
    const users = await db.getAllUsers('premium');
    targetUserIds = users.map(user => user.sender_id);
  } else if (Array.isArray(targetUsers)) {
    // Send to specific user IDs
    targetUserIds = targetUsers;
  }
  
  // In test mode, only send to first 3 users
  if (testMode) {
    targetUserIds = targetUserIds.slice(0, 3);
    console.log('Test mode: Broadcasting to first 3 users only');
  }
  
  results.total = targetUserIds.length;
  console.log(`Starting broadcast to ${results.total} users`);
  
  // Process in batches to respect rate limits
  const batchSize = 20; // Facebook allows up to 100 requests per second
  const delayBetweenBatches = 2000; // 2 seconds between batches
  
  for (let i = 0; i < targetUserIds.length; i += batchSize) {
    const batch = targetUserIds.slice(i, i + batchSize);
    
    // Send messages in parallel within batch
    const batchPromises = batch.map(async (userId) => {
      try {
        // Prepare the broadcast message with recipient
        const broadcastData = {
          recipient: { id: userId },
          message: {
            ...message,
            // Add broadcast indicator if not present
            text: message.text || '📢 Announcement from Easely'
          }
        };
        
        // Add metadata tag to identify as broadcast
        if (broadcastData.message) {
          broadcastData.message.metadata = JSON.stringify({ 
            type: 'broadcast',
            timestamp: new Date().toISOString() 
          });
        }
        
        await sendMessage(broadcastData);
        results.successful++;
        console.log(`✅ Broadcast sent to user ${userId}`);
      } catch (error) {
        results.failed++;
        results.errors.push({
          userId,
          error: error.response?.data?.error?.message || error.message
        });
        console.error(`❌ Failed to send to user ${userId}:`, error.message);
      }
    });
    
    // Wait for batch to complete
    await Promise.allSettled(batchPromises);
    
    // Add delay between batches if not last batch
    if (i + batchSize < targetUserIds.length) {
      console.log(`Batch ${Math.floor(i / batchSize) + 1} complete. Waiting before next batch...`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
  
  console.log(`Broadcast complete: ${results.successful}/${results.total} successful`);
  return results;
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Webhook error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Function to set up the persistent menu (hamburger menu) with rate limit handling
async function setupPersistentMenu() {
  // Skip clearing menu to avoid unnecessary API calls that might hit rate limits
  // The new menu will overwrite the existing one anyway
  console.log('Setting up persistent menu...');
  
  // Add small delay to spread out API calls
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const menuData = {
    persistent_menu: [
      {
        locale: "default",
        composer_input_disabled: false,
        call_to_actions: [
          {
            title: "📋 My Tasks",
            type: "postback",
            payload: "MY_TASKS"
          },
          {
            title: "🔧 Canvas Setup",
            type: "postback",
            payload: "CANVAS_SETUP"
          },
          {
            title: "❓ Help & Support",
            type: "postback",
            payload: "HELP_AND_SUPPORT"
          },
          {
            title: "🌟 Upgrade Premium",  // Shortened to fit Android's smaller display
            type: "postback",
            payload: "UPGRADE_TO_PREMIUM"
          }
        ]
      },
      // Add specific locale for English to ensure consistency
      {
        locale: "en_US",
        composer_input_disabled: false,
        call_to_actions: [
          {
            title: "📋 My Tasks",
            type: "postback",
            payload: "MY_TASKS"
          },
          {
            title: "🔧 Canvas Setup",
            type: "postback",
            payload: "CANVAS_SETUP"
          },
          {
            title: "❓ Help & Support",
            type: "postback",
            payload: "HELP_AND_SUPPORT"
          },
          {
            title: "🌟 Upgrade Premium",
            type: "postback",
            payload: "UPGRADE_TO_PREMIUM"
          }
        ]
      }
    ]
  };

  try {
    await callWithRetry(async () => {
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/me/messenger_profile?access_token=${PAGE_ACCESS_TOKEN}`,
        menuData,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('Persistent menu configured successfully:', response.data);
      return response;
    });
    
    console.log('Menu setup completed successfully');
    
  } catch (error) {
    if (error.response?.data?.error?.code === 613) {
      console.warn('Rate limit persists for menu after retries.');
      console.warn('The menu should already be configured from a previous deployment.');
    } else {
      console.error('Failed to set persistent menu:', error.response?.data || error.message);
    }
  }
}

// Helper function to delay execution
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to make API calls with exponential backoff for rate limiting
async function callWithRetry(apiCall, maxRetries = 3, initialDelay = 1000) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;
      
      // Check if it's a rate limit error
      if (error.response?.data?.error?.code === 613) {
        const waitTime = initialDelay * Math.pow(2, i); // Exponential backoff
        console.log(`Rate limit hit. Waiting ${waitTime}ms before retry ${i + 1}/${maxRetries}...`);
        await delay(waitTime);
      } else {
        // If it's not a rate limit error, throw immediately
        throw error;
      }
    }
  }
  
  throw lastError;
}

// Function to verify current menu configuration
async function verifyMenuConfiguration() {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/me/messenger_profile?fields=persistent_menu,get_started&access_token=${PAGE_ACCESS_TOKEN}`
    );
    
    const hasMenu = response.data?.data?.[0]?.persistent_menu?.length > 0;
    const hasGetStarted = response.data?.data?.[0]?.get_started?.payload === 'GET_STARTED';
    
    return {
      hasMenu,
      hasGetStarted,
      menuData: response.data?.data?.[0]?.persistent_menu,
      getStartedData: response.data?.data?.[0]?.get_started
    };
  } catch (error) {
    if (error.response?.data?.error?.code === 613) {
      console.warn('Rate limit hit while verifying menu. Assuming menu is configured.');
      return { hasMenu: true, hasGetStarted: true };
    }
    console.error('Error verifying menu configuration:', error.response?.data || error.message);
    return { hasMenu: false, hasGetStarted: false };
  }
}

// Function to set up the Get Started button with rate limit handling
async function setupGetStartedButton() {
  const buttonData = {
    get_started: {
      payload: "GET_STARTED"
    }
  };

  try {
    await callWithRetry(async () => {
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/me/messenger_profile?access_token=${PAGE_ACCESS_TOKEN}`,
        buttonData,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('Get Started button configured successfully');
      return response;
    });
  } catch (error) {
    if (error.response?.data?.error?.code === 613) {
      console.warn('Rate limit persists for Get Started button after retries.');
      console.warn('The button should already be configured from a previous deployment.');
    } else {
      console.error('Failed to set Get Started button:', error.response?.data || error.message);
    }
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`Easely webhook server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Check required environment variables
  const requiredEnvVars = ['VERIFY_TOKEN', 'PAGE_ACCESS_TOKEN', 'APP_SECRET'];
  const optionalEnvVars = ['ADMIN_API_TOKEN'];
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  const missingOptional = optionalEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missingEnvVars.length > 0) {
    console.warn('Missing required environment variables:', missingEnvVars.join(', '));
  } else {
    console.log('All required environment variables are set');
    
    // Check current menu configuration first
    console.log('Checking current Messenger profile configuration...');
    const menuStatus = await verifyMenuConfiguration();
    
    const shouldSetupProfile = process.env.SETUP_MESSENGER_PROFILE === 'true' || 
                              process.env.NODE_ENV === 'production' ||
                              process.env.FORCE_MENU_SETUP === 'true' ||
                              !menuStatus.hasMenu || !menuStatus.hasGetStarted;
    
    if (shouldSetupProfile) {
      if (!menuStatus.hasMenu || !menuStatus.hasGetStarted) {
        console.log('Menu or Get Started button missing. Setting up Messenger profile...');
      } else {
        console.log('Forcing Messenger profile setup as requested...');
      }
      
      // Setup with delay between calls to avoid rate limiting
      if (!menuStatus.hasGetStarted) {
        await setupGetStartedButton();
        await delay(1000); // Wait 1 second between API calls
      }
      
      if (!menuStatus.hasMenu) {
        await setupPersistentMenu();
      }
    } else {
      console.log('✓ Messenger profile already configured:');
      console.log(`  - Get Started button: ${menuStatus.hasGetStarted ? '✓' : '✗'}`);
      console.log(`  - Persistent menu: ${menuStatus.hasMenu ? '✓' : '✗'}`);
    }
  }
  
  if (missingOptional.length > 0) {
    console.warn('Missing optional environment variables:', missingOptional.join(', '));
    console.warn('Admin API endpoints will not be available without ADMIN_API_TOKEN');
  } else {
    console.log('Admin API enabled at /admin/broadcast and /admin/stats');
  }
});
