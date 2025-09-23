/**
 * Messenger API Module
 * Handles all Facebook Messenger API interactions including quick replies
 */

const axios = require('axios');
const { PAGE_ACCESS_TOKEN, VERIFY_TOKEN, GRAPH_API_URL } = require('../../config/settings');

/**
 * Verify webhook during Facebook setup
 * @param {string} mode - Webhook mode from Facebook
 * @param {string} token - Verification token from Facebook
 * @param {string} challenge - Challenge string from Facebook
 * @returns {boolean} True if verification successful
 */
function verifyWebhook(mode, token, challenge) {
    return mode === 'subscribe' && token === VERIFY_TOKEN;
}

/**
 * Send a message to a user via Messenger API
 * @param {string} recipientId - Facebook user ID
 * @param {Object} messageData - Message payload to send
 * @returns {Promise<boolean>} True if message sent successfully
 */
async function sendMessage(recipientId, messageData) {
    try {
        const url = `${GRAPH_API_URL}/me/messages`;
        
        const payload = {
            recipient: { id: recipientId },
            message: messageData
        };
        
        const params = { access_token: PAGE_ACCESS_TOKEN };
        
        const response = await axios.post(url, payload, { params });
        
        console.log(`Message sent successfully to ${recipientId}`);
        return true;
        
    } catch (error) {
        console.error(`Failed to send message to ${recipientId}: ${error.message}`);
        return false;
    }
}

/**
 * Send a simple text message
 * @param {string} recipientId - Facebook user ID
 * @param {string} text - Text message to send
 * @returns {Promise<boolean>} True if message sent successfully
 */
async function sendTextMessage(recipientId, text) {
    const messageData = { text };
    return await sendMessage(recipientId, messageData);
}

/**
 * Send a message with quick reply buttons
 * @param {string} recipientId - Facebook user ID
 * @param {string} text - Main message text
 * @param {Array} quickReplies - List of quick reply options
 * @returns {Promise<boolean>} True if message sent successfully
 */
async function sendQuickReplies(recipientId, text, quickReplies) {
    const messageData = {
        text,
        quick_replies: quickReplies
    };
    return await sendMessage(recipientId, messageData);
}

/**
 * Create a quick reply button object
 * @param {string} title - Button text (max 20 chars)
 * @param {string} payload - Payload to send when clicked (max 1000 chars)
 * @param {string} imageUrl - Optional icon URL for the button
 * @returns {Object} Quick reply object
 */
function createQuickReply(title, payload, imageUrl = null) {
    const quickReply = {
        content_type: 'text',
        title: title.substring(0, 20), // Ensure max 20 characters
        payload: payload.substring(0, 1000) // Ensure max 1000 characters
    };
    
    if (imageUrl) {
        quickReply.image_url = imageUrl;
    }
    
    return quickReply;
}

/**
 * Send the main task management menu with quick replies
 * @param {string} recipientId - Facebook user ID
 * @returns {Promise<boolean>} True if menu sent successfully
 */
async function sendMainMenu(recipientId) {
    const text = "Welcome to Easely! What would you like to do?";
    
    const quickReplies = [
        createQuickReply("Due Today", "GET_TASKS_TODAY"),
        createQuickReply("This Week", "GET_TASKS_WEEK"),
        createQuickReply("Overdue", "GET_TASKS_OVERDUE"),
        createQuickReply("Upcoming", "GET_TASKS_ALL"),
        createQuickReply("Add Task", "ADD_NEW_TASK")
    ];
    
    return await sendQuickReplies(recipientId, text, quickReplies);
}

/**
 * Set up the persistent menu (burger menu) for the Facebook Page
 * @returns {Promise<boolean>} True if persistent menu was set successfully
 */
async function setupPersistentMenu() {
    try {
        const url = `${GRAPH_API_URL}/me/messenger_profile`;
        
        const persistentMenu = {
            persistent_menu: [
                {
                    locale: "default",
                    composer_input_disabled: false,
                    call_to_actions: [
                        {
                            title: "My Tasks",
                            type: "postback",
                            payload: "MAIN_MENU"
                        },
                        {
                            title: "Canvas Setup",
                            type: "postback",
                            payload: "TOKEN_TUTORIAL"
                        },
                        {
                            title: "Help & Support",
                            type: "postback",
                            payload: "SHOW_HELP"
                        },
                        {
                            title: "Upgrade to Premium",
                            type: "web_url",
                            url: "https://facebook.com/keanlouis30"
                        }
                    ]
                }
            ]
        };
        
        const params = { access_token: PAGE_ACCESS_TOKEN };
        
        const response = await axios.post(url, persistentMenu, { params });
        
        console.log("Persistent menu set up successfully");
        return true;
        
    } catch (error) {
        console.error(`Failed to set up persistent menu: ${error.message}`);
        if (error.response) {
            console.error(`Facebook API error: ${error.response.status}`);
            console.error(`Response: ${JSON.stringify(error.response.data)}`);
            console.error(`Payload sent: ${JSON.stringify(persistentMenu)}`);
        }
        return false;
    }
}

/**
 * Set up the "Get Started" button for new users
 * @returns {Promise<boolean>} True if get started button was set successfully
 */
async function setupGetStartedButton() {
    try {
        const url = `${GRAPH_API_URL}/me/messenger_profile`;
        
        const getStarted = {
            get_started: {
                payload: "GET_STARTED"
            }
        };
        
        const params = { access_token: PAGE_ACCESS_TOKEN };
        
        await axios.post(url, getStarted, { params });
        
        console.log("Get Started button set up successfully");
        return true;
        
    } catch (error) {
        console.error(`Failed to set up Get Started button: ${error.message}`);
        return false;
    }
}

/**
 * Set up greeting text for new users
 * @returns {Promise<boolean>} True if greeting text was set successfully
 */
async function setupGreetingText() {
    try {
        const url = `${GRAPH_API_URL}/me/messenger_profile`;
        
        const greeting = {
            greeting: [
                {
                    locale: "default",
                    text: "Hi {{user_first_name}}! 👋 I'm Easely, your Canvas LMS assistant. I'll help you stay organized with assignments, deadlines, and study planning. Click 'Get Started' to begin! 🎯"
                }
            ]
        };
        
        const params = { access_token: PAGE_ACCESS_TOKEN };
        
        await axios.post(url, greeting, { params });
        
        console.log("Greeting text set up successfully");
        return true;
        
    } catch (error) {
        console.error(`Failed to set up greeting text: ${error.message}`);
        return false;
    }
}

/**
 * Set up complete bot profile (persistent menu, get started button, and greeting)
 * @returns {Promise<boolean>} True if all profile elements were set successfully
 */
async function setupBotProfile() {
    console.log("Setting up bot profile...");
    
    let successCount = 0;
    
    if (await setupPersistentMenu()) {
        successCount++;
    }
    
    if (await setupGetStartedButton()) {
        successCount++;
    }
    
    if (await setupGreetingText()) {
        successCount++;
    }
    
    if (successCount === 3) {
        console.log("Bot profile setup completed successfully!");
        return true;
    } else {
        console.warn(`Bot profile setup partially completed (${successCount}/3 elements)`);
        return false;
    }
}

/**
 * Send typing indicator to show bot is processing
 * @param {string} recipientId - Facebook user ID
 * @param {string} typingOnOff - "typing_on" or "typing_off"
 * @returns {Promise<boolean>} True if indicator sent successfully
 */
async function sendTypingIndicator(recipientId, typingOnOff) {
    try {
        const url = `${GRAPH_API_URL}/me/messages`;
        
        const payload = {
            recipient: { id: recipientId },
            sender_action: typingOnOff
        };
        
        const params = { access_token: PAGE_ACCESS_TOKEN };
        
        await axios.post(url, payload, { params });
        
        return true;
        
    } catch (error) {
        console.error(`Failed to send typing indicator to ${recipientId}: ${error.message}`);
        return false;
    }
}

/**
 * Create a URL button for button templates
 * @param {string} title - Button text
 * @param {string} url - URL to open
 * @returns {Object} URL button object
 */
function createUrlButton(title, url) {
    return {
        type: "web_url",
        title,
        url
    };
}

/**
 * Send a message with button template
 * @param {string} recipientId - Facebook user ID
 * @param {string} text - Main message text
 * @param {Array} buttons - List of button objects
 * @returns {Promise<boolean>} True if message sent successfully
 */
async function sendButtonTemplate(recipientId, text, buttons) {
    const messageData = {
        attachment: {
            type: "template",
            payload: {
                template_type: "button",
                text,
                buttons
            }
        }
    };
    return await sendMessage(recipientId, messageData);
}

/**
 * Send the privacy policy consent request - first step of onboarding
 * @param {string} recipientId - Facebook user ID
 * @returns {Promise<boolean>} True if message sent successfully
 */
async function sendPrivacyPolicyConsent(recipientId) {
    const text = (
        "Hi! I'm Easely, your personal Canvas assistant. 🎨\\n\\n" +
        "I help students stay organized with assignments, deadlines, and study planning."
    );
    
    // First, introduce the bot
    await sendTextMessage(recipientId, text);
    
    // Send a separate message with features
    const featuresText = (
        "Here are my features:\\n\\n" +
        "🔥 Free Features:\\n" +
        "• View tasks due Today/This Week/Overdue\\n" +
        "• Basic Canvas sync (import assignments)\\n" +
        "• Add manual tasks (limited)\\n" +
        "• Reminders and quick actions\\n\\n" +
        "If you choose to upgrade, please message Kean Rosales, or facebook.com/keanlouis30\\n\\n" +
        "💎 Premium Features:\\n" +
        "• Enhanced reminders (multiple alerts)\\n" +
        "• Unlimited manual tasks\\n" +
        "• AI-powered study planning\\n" +
        "• Weekly digest reports"
    );
    await sendTextMessage(recipientId, featuresText);
    
    // Third message with privacy policy prompt
    const privacyText = "🔒 To get started, please review our Privacy Policy to understand how we protect your data.";
    await sendTextMessage(recipientId, privacyText);
    
    // Create URL quick reply that opens privacy policy directly
    const quickReplies = [
        {
            content_type: "text",
            title: "📜 Privacy Policy",
            payload: "PRIVACY_POLICY_READ"
        },
        createQuickReply("❌ Not now", "PRIVACY_DECLINE")
    ];
    
    return await sendQuickReplies(recipientId, "When you're ready, choose an option:", quickReplies);
}

/**
 * Send the privacy agreement option after user reads policy
 * @param {string} recipientId - Facebook user ID
 * @returns {Promise<boolean>} True if message sent successfully
 */
async function sendPrivacyAgreementOption(recipientId) {
    const quickReplies = [
        createQuickReply("✅ I Agree", "PRIVACY_AGREE"),
        createQuickReply("❌ I Decline", "PRIVACY_DECLINE")
    ];
    
    const text = "Do you agree to our Privacy Policy?";
    return await sendQuickReplies(recipientId, text, quickReplies);
}

/**
 * Send the terms of use consent request - second step of onboarding
 * @param {string} recipientId - Facebook user ID
 * @returns {Promise<boolean>} True if message sent successfully
 */
async function sendTermsConsent(recipientId) {
    const text = "Great! Now please review our Terms of Use.";
    
    const quickReplies = [
        {
            content_type: "text",
            title: "⚖️ Terms of Use",
            payload: "TERMS_READ"
        },
        createQuickReply("❌ Not now", "TERMS_DECLINE")
    ];
    
    return await sendQuickReplies(recipientId, text, quickReplies);
}

/**
 * Send the terms agreement option after user reads terms
 * @param {string} recipientId - Facebook user ID
 * @returns {Promise<boolean>} True if message sent successfully
 */
async function sendTermsAgreementOption(recipientId) {
    const quickReplies = [
        createQuickReply("✅ I Agree", "TERMS_AGREE"),
        createQuickReply("❌ I Decline", "TERMS_DECLINE")
    ];
    
    const text = "Do you agree to our Terms of Use?";
    return await sendQuickReplies(recipientId, text, quickReplies);
}

/**
 * Send the final consent request - last step of onboarding
 * @param {string} recipientId - Facebook user ID
 * @returns {Promise<boolean>} True if message sent successfully
 */
async function sendFinalConsent(recipientId) {
    const text = (
        "Perfect! By accepting our Privacy Policy and Terms of Use, " +
        "you're giving me permission to help manage your Canvas assignments and send you helpful reminders.\\n\\n" +
        "Ready to connect your Canvas account?"
    );
    
    const quickReplies = [
        createQuickReply("✅ Let's Go!", "FINAL_CONSENT_AGREE"),
        createQuickReply("❌ Not now", "FINAL_CONSENT_DECLINE")
    ];
    
    return await sendQuickReplies(recipientId, text, quickReplies);
}

/**
 * Send Canvas token request - guides user to input their Canvas token
 * @param {string} recipientId - Facebook user ID
 * @returns {Promise<boolean>} True if message sent successfully
 */
async function sendCanvasTokenRequest(recipientId) {
    const text = (
        "To sync with Canvas, I need your Canvas Access Token. This token allows me to:\\n\\n" +
        "• Import your assignments\\n" +
        "• Check due dates\\n" +
        "• Send you reminders\\n\\n" +
        "Your token is kept secure and only used for these purposes."
    );
    
    const quickReplies = [
        createQuickReply("🔑 I know how", "TOKEN_KNOW_HOW"),
        createQuickReply("🤔 Need help", "TOKEN_NEED_HELP")
    ];
    
    return await sendQuickReplies(recipientId, text, quickReplies);
}

/**
 * Send a video using a URL template (for hosted videos)
 * @param {string} recipientId - Facebook user ID
 * @param {string} videoUrl - URL of the hosted video
 * @param {string} title - Title for the video
 * @param {string} subtitle - Subtitle/description for the video
 * @returns {Promise<boolean>} True if message sent successfully
 */
async function sendVideoUrlTemplate(recipientId, videoUrl, title = "Video", subtitle = "") {
    const messageData = {
        attachment: {
            type: "template",
            payload: {
                template_type: "media",
                elements: [
                    {
                        media_type: "video",
                        url: videoUrl,
                        buttons: [
                            {
                                type: "postback",
                                title: "I'm Ready",
                                payload: "TOKEN_READY"
                            }
                        ]
                    }
                ]
            }
        }
    };
    return await sendMessage(recipientId, messageData);
}

/**
 * Backward compatibility wrapper
 */
async function sendTaskMenu(recipientId) {
    return await sendMainMenu(recipientId);
}

module.exports = {
    verifyWebhook,
    sendMessage,
    sendTextMessage,
    sendQuickReplies,
    createQuickReply,
    sendMainMenu,
    setupPersistentMenu,
    setupGetStartedButton,
    setupGreetingText,
    setupBotProfile,
    sendTypingIndicator,
    createUrlButton,
    sendButtonTemplate,
    sendPrivacyPolicyConsent,
    sendPrivacyAgreementOption,
    sendTermsConsent,
    sendTermsAgreementOption,
    sendFinalConsent,
    sendCanvasTokenRequest,
    sendVideoUrlTemplate,
    sendTaskMenu
};
