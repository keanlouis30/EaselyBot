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
});

// Handle incoming messages
async function handleMessage(senderId, message) {
  console.log(`Message from ${senderId}:`, message.text);
  
  if (message.text) {
    const userMessage = message.text.toLowerCase().trim();
    
    // Route messages based on content
    switch (userMessage) {
      case 'get started':
      case 'hi':
      case 'hello':
      case 'menu':
        await sendWelcomeMessage(senderId);
        break;
      case 'activate':
        await sendActivationMessage(senderId);
        break;
      default:
        // Check if it's a Canvas token (typically starts with specific patterns)
        if (isCanvasToken(message.text)) {
          await handleCanvasToken(senderId, message.text);
        } else {
          await sendGenericResponse(senderId);
        }
    }
  }
}

// Handle postback events (button clicks)
async function handlePostback(senderId, postback) {
  console.log(`Postback from ${senderId}:`, postback.payload);
  
  const payload = postback.payload;
  
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

// Handle Canvas token submission
async function handleCanvasToken(senderId, token) {
  // TODO: Validate token against Canvas API
  // For now, we'll simulate validation
  
  const message = {
    recipient: { id: senderId },
    message: {
      text: "🎉 Great! I'm connecting to your Canvas account...\n\nToken validated successfully! I'm now syncing your assignments and courses. This may take a moment...\n\n✅ Sync complete! Here are your upcoming assignments:\n\n📝 Math Homework - Due Tomorrow 11:59 PM\n📊 History Essay - Due Friday 11:59 PM\n🧪 Chemistry Lab Report - Due Next Monday 8:00 AM\n\nI'll send you reminders 24 hours before each deadline. Want to upgrade to Premium for more frequent reminders and additional features?"
    }
  };
  
  await sendMessage(message);
}

// Placeholder functions for task management
async function sendTasksToday(senderId) {
  const message = {
    recipient: { id: senderId },
    message: {
      text: "🔥 Tasks due today:\n\n📝 Math Homework - Due today 11:59 PM\n\nYou're doing great! Keep it up! 💪"
    }
  };
  
  await sendMessage(message);
}

async function sendTasksWeek(senderId) {
  const message = {
    recipient: { id: senderId },
    message: {
      text: "⏰ Tasks due this week:\n\n📝 Math Homework - Due today 11:59 PM\n📊 History Essay - Due Friday 11:59 PM\n🧪 Chemistry Lab Report - Due Next Monday 8:00 AM\n\nStay organized! You've got this! 📚"
    }
  };
  
  await sendMessage(message);
}

async function sendOverdueTasks(senderId) {
  const message = {
    recipient: { id: senderId },
    message: {
      text: "❗️ Overdue tasks:\n\nNo overdue tasks! 🎉\n\nYou're staying on top of everything. Great job!"
    }
  };
  
  await sendMessage(message);
}

async function sendAllUpcoming(senderId) {
  const message = {
    recipient: { id: senderId },
    message: {
      text: "🗓 All upcoming tasks:\n\n📝 Math Homework - Due today 11:59 PM\n📊 History Essay - Due Friday 11:59 PM\n🧪 Chemistry Lab Report - Due Next Monday 8:00 AM\n🔬 Physics Quiz - Due Next Wednesday 2:00 PM\n\nStay focused and tackle them one by one! 💼"
    }
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
