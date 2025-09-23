/**
 * Event Handler Module
 * Processes incoming messages and determines appropriate responses
 */

const moment = require('moment-timezone');
const messengerApi = require('../api/messengerApi');
const { 
    getUser, 
    createUser, 
    updateUserLastSeen, 
    getUserSession, 
    setUserSession, 
    clearUserSession 
} = require('../database/supabaseClient');
const {
    fetchUpcomingAssignments,
    fetchThisWeekAssignments,
    testCanvasConnection,
    formatAssignmentsList
} = require('../api/canvasApi');

// Store user session data (in production, use proper database)
const userSessions = {};

/**
 * Get current datetime in Manila timezone
 * @returns {moment.Moment} Current datetime in Manila timezone
 */
function getManilaTime() {
    return moment().tz('Asia/Manila');
}

/**
 * Convert UTC datetime to Manila timezone
 * @param {string|Date} utcDateTime - UTC datetime to convert
 * @returns {moment.Moment} Converted datetime in Manila timezone
 */
function convertToManilaTime(utcDateTime) {
    return moment.utc(utcDateTime).tz('Asia/Manila');
}

/**
 * Handle incoming text messages from users
 * @param {string} senderId - Facebook user ID
 * @param {string} text - Message text from user
 */
async function handleMessage(senderId, text) {
    try {
        // Show typing indicator while processing
        await messengerApi.sendTypingIndicator(senderId, "typing_on");
        
        // Convert message to lowercase for easier matching
        const textLower = text.toLowerCase().trim();
        
        // For any message, first check if user exists and update last seen
        const user = await getUser(senderId);
        if (user) {
            // Update last seen for existing users
            await updateUserLastSeen(senderId);
        }
        
        // Check for greetings and menu requests - but only if not in active flow
        let currentState = null;
        try {
            currentState = await getUserSession(senderId, 'conversation_state');
        } catch (error) {
            // Session doesn't exist yet
        }
        
        // Don't interrupt active conversation flows
        const inActiveFlow = ['waiting_for_token', 'waiting_for_task_title', 'waiting_for_custom_date', 'waiting_for_custom_time', 'waiting_for_task_details'].includes(currentState);
        
        // IMPORTANT: Check for active flows FIRST before checking if new user
        // Handle Canvas token input - this takes priority
        if (await isWaitingForToken(senderId)) {
            await handleTokenInput(senderId, text);
        }
        // Handle task title input
        else if (await isWaitingForTaskTitle(senderId)) {
            await handleTaskTitleInput(senderId, text);
        }
        // Handle custom date input
        else if (await isWaitingForCustomDate(senderId)) {
            await handleCustomDateInput(senderId, text);
        }
        // Handle custom time input
        else if (await isWaitingForCustomTime(senderId)) {
            await handleCustomTimeInput(senderId, text);
        }
        // Handle task details input
        else if (await isWaitingForTaskDetails(senderId)) {
            await handleTaskDetailsInput(senderId, text);
        }
        // Check if user is new (this should happen for ANY message from new users)
        else if (await isNewUser(senderId)) {
            // Create user record if doesn't exist
            if (!user) {
                try {
                    await createUser(senderId);
                    console.log(`Created new user record for ${senderId}`);
                } catch (error) {
                    console.error(`Error creating user: ${error.message}`);
                }
            }
            
            // Start onboarding flow for new users
            await messengerApi.sendPrivacyPolicyConsent(senderId);
        }
        // Handle existing users - respond to ANY message
        else {
            // Check for special commands
            if (text.toUpperCase() === 'ACTIVATE') {
                await handlePremiumActivation(senderId);
            }
            // Check if they're asking for menu/help
            else if (textLower.includes('menu') || textLower.includes('help') || textLower.includes('start') || textLower.includes('hi') || textLower.includes('hello') || textLower.includes('hey')) {
                await messengerApi.sendMainMenu(senderId);
            } 
            // For any other message, show helpful response and menu
            else {
                await messengerApi.sendTextMessage(
                    senderId,
                    "Hi! I'm here to help you manage your Canvas assignments. Here's what I can do:"
                );
                await messengerApi.sendMainMenu(senderId);
            }
        }
        
    } catch (error) {
        console.error(`Error handling message from ${senderId}: ${error.message}`);
        await messengerApi.sendTextMessage(
            senderId,
            "Sorry, something went wrong. Please try again."
        );
    } finally {
        // Turn off typing indicator
        await messengerApi.sendTypingIndicator(senderId, "typing_off");
    }
}

/**
 * Handle postback events from quick replies and buttons
 * @param {string} senderId - Facebook user ID
 * @param {string} payload - Postback payload string
 */
async function handlePostback(senderId, payload) {
    try {
        await messengerApi.sendTypingIndicator(senderId, "typing_on");
        
        // Route based on payload
        // Privacy Policy Flow
        if (payload === "PRIVACY_AGREE") {
            await handlePrivacyAgreement(senderId);
        }
        else if (payload === "PRIVACY_DECLINE") {
            await handlePrivacyDecline(senderId);
        }
        else if (payload === "PRIVACY_POLICY_READ") {
            await handlePrivacyPolicyRead(senderId);
        }
        // Terms of Use Flow
        else if (payload === "TERMS_AGREE") {
            await handleTermsAgreement(senderId);
        }
        else if (payload === "TERMS_DECLINE") {
            await handleTermsDecline(senderId);
        }
        else if (payload === "TERMS_READ") {
            await handleTermsRead(senderId);
        }
        // Final Consent
        else if (payload === "FINAL_CONSENT_AGREE") {
            await handleFinalConsentAgreement(senderId);
        }
        else if (payload === "FINAL_CONSENT_DECLINE") {
            await handleFinalConsentDecline(senderId);
        }
        // Canvas Token Flow
        else if (payload === "TOKEN_KNOW_HOW") {
            await handleTokenKnowHow(senderId);
        }
        else if (payload === "TOKEN_NEED_HELP") {
            await handleTokenNeedHelp(senderId);
        }
        else if (payload === "TOKEN_READY") {
            await handleTokenReady(senderId);
        }
        else if (payload === "TOKEN_TUTORIAL") {
            await handleTokenTutorial(senderId);
        }
        else if (payload === "WATCH_VIDEO") {
            await handleWatchVideo(senderId);
        }
        else if (payload === "GET_TASKS_TODAY") {
            await handleGetTasksToday(senderId);
        }
        else if (payload === "GET_TASKS_WEEK") {
            await handleGetTasksWeek(senderId);
        }
        else if (payload === "GET_TASKS_OVERDUE") {
            await handleGetTasksOverdue(senderId);
        }
        else if (payload === "GET_TASKS_ALL") {
            await handleGetTasksAll(senderId);
        }
        else if (payload === "ADD_NEW_TASK") {
            await handleAddNewTask(senderId);
        }
        else if (payload.startsWith("DATE_")) {
            await handleDateSelection(senderId, payload);
        }
        else if (payload.startsWith("TIME_")) {
            await handleTimeSelection(senderId, payload);
        }
        // Persistent menu handlers
        else if (payload === "MAIN_MENU") {
            await messengerApi.sendMainMenu(senderId);
        }
        else if (payload === "SHOW_SETTINGS") {
            await handleShowSettings(senderId);
        }
        else if (payload === "SHOW_HELP") {
            await handleShowHelp(senderId);
        }
        else if (payload === "SHOW_ABOUT") {
            await handleShowAbout(senderId);
        }
        else if (payload === "GET_STARTED") {
            // Handle "Get Started" button - check if new or existing user
            if (await isNewUser(senderId)) {
                // New user - start onboarding
                const user = await getUser(senderId);
                if (!user) {
                    await createUser(senderId);
                    console.log(`Created new user record for ${senderId}`);
                }
                await messengerApi.sendPrivacyPolicyConsent(senderId);
            } else {
                // Existing user - show menu
                await messengerApi.sendMainMenu(senderId);
            }
        }
        // Premium Flow Handlers
        else if (payload === "SHOW_PREMIUM") {
            await handleShowPremium(senderId);
        }
        else if (payload === "SKIP_PREMIUM") {
            await handleSkipPremium(senderId);
        }
        else if (payload === "SYNC_CANVAS") {
            await handleSyncCanvas(senderId);
        }
        // New hamburger menu handlers
        else if (payload === "NOTIFICATION_SETTINGS") {
            await handleNotificationSettings(senderId);
        }
        else if (payload === "ACCOUNT_SETTINGS") {
            await handleAccountSettings(senderId);
        }
        else if (payload === "ENTER_PREMIUM_CODE") {
            await handleEnterPremiumCode(senderId);
        }
        else {
            console.warn(`Unknown payload: ${payload}`);
            await messengerApi.sendTextMessage(
                senderId,
                "Sorry, I didn't recognize that action. Type 'menu' to see available options."
            );
        }
        
    } catch (error) {
        console.error(`Error handling postback from ${senderId}: ${error.message}`);
        await messengerApi.sendTextMessage(
            senderId,
            "Sorry, something went wrong. Please try again."
        );
    } finally {
        await messengerApi.sendTypingIndicator(senderId, "typing_off");
    }
}

// Session Management Helper Functions
async function setUserState(senderId, state, details = null) {
    await setUserSession(senderId, 'conversation_state', state);
    if (details) {
        await setUserSession(senderId, 'state_details', details);
    }
}

async function clearUserState(senderId) {
    await clearUserSession(senderId);
}

async function isWaitingForToken(senderId) {
    try {
        const state = await getUserSession(senderId, 'conversation_state');
        return state === 'waiting_for_token';
    } catch {
        return false;
    }
}

async function isWaitingForTaskTitle(senderId) {
    try {
        const state = await getUserSession(senderId, 'conversation_state');
        return state === 'waiting_for_task_title';
    } catch {
        return false;
    }
}

async function isWaitingForCustomDate(senderId) {
    try {
        const state = await getUserSession(senderId, 'conversation_state');
        return state === 'waiting_for_custom_date';
    } catch {
        return false;
    }
}

async function isWaitingForCustomTime(senderId) {
    try {
        const state = await getUserSession(senderId, 'conversation_state');
        return state === 'waiting_for_custom_time';
    } catch {
        return false;
    }
}

async function isWaitingForTaskDetails(senderId) {
    try {
        const state = await getUserSession(senderId, 'conversation_state');
        return state === 'waiting_for_task_details';
    } catch {
        return false;
    }
}

async function isNewUser(senderId) {
    try {
        const user = await getUser(senderId);
        return !user || !user.onboarding_completed;
    } catch {
        return true; // Assume new user if we can't check
    }
}

// Onboarding handlers - Step-by-step flow
async function handlePrivacyAgreement(senderId) {
    await setUserState(senderId, "privacy_agreed");
    await messengerApi.sendTermsConsent(senderId);
}

async function handlePrivacyDecline(senderId) {
    await messengerApi.sendTextMessage(
        senderId,
        "I understand. Unfortunately, I can't help you without accepting our privacy policy. " +
        "Feel free to return anytime if you change your mind! 👋"
    );
}

async function handlePrivacyPolicyRead(senderId) {
    // Send confirmation and link
    const buttons = [
        messengerApi.createUrlButton(
            "📜 Read Privacy Policy",
            "https://easelyprivacypolicy.onrender.com"
        )
    ];
    await messengerApi.sendButtonTemplate(
        senderId,
        "📖 Click the button below to review our Privacy Policy. I'll ask for your agreement in a moment.",
        buttons
    );
    
    // Send a follow-up message to let them know the timer is starting
    await messengerApi.sendTextMessage(
        senderId,
        "⏱️ Take your time reading. I'll check back with you in 5 seconds..."
    );
    
    // Background timeout to show agreement after 5 seconds
    setTimeout(async () => {
        await messengerApi.sendPrivacyAgreementOption(senderId);
    }, 5000);
}

async function handleTermsAgreement(senderId) {
    await setUserState(senderId, "terms_agreed");
    await messengerApi.sendFinalConsent(senderId);
}

async function handleTermsDecline(senderId) {
    await messengerApi.sendTextMessage(
        senderId,
        "I understand. Unfortunately, I can't help you without accepting our terms of use. " +
        "Feel free to return anytime if you change your mind! 👋"
    );
}

async function handleTermsRead(senderId) {
    // Send confirmation and link
    const buttons = [
        messengerApi.createUrlButton(
            "⚖️ Read Terms of Use",
            "https://easelytermsofuse.onrender.com"
        )
    ];
    await messengerApi.sendButtonTemplate(
        senderId,
        "📖 Click the button below to review our Terms of Use. I'll check back with you shortly.",
        buttons
    );
    
    // Send a follow-up message to let them know the timer is starting
    await messengerApi.sendTextMessage(
        senderId,
        "⏱️ Take your time reading. I'll ask for your agreement in 5 seconds..."
    );
    
    // Background timeout to show agreement after 5 seconds
    setTimeout(async () => {
        await messengerApi.sendTermsAgreementOption(senderId);
    }, 5000);
}

async function handleFinalConsentAgreement(senderId) {
    await setUserState(senderId, "onboarding_complete");
    
    // Mark onboarding as complete in the database
    try {
        const user = await getUser(senderId);
        if (user) {
            const { updateUser } = require('../database/supabaseClient');
            await updateUser(senderId, { onboarding_completed: true });
            console.log(`Marked onboarding complete for user ${senderId}`);
        }
    } catch (error) {
        console.error(`Error updating onboarding status: ${error.message}`);
    }
    
    await messengerApi.sendTextMessage(
        senderId,
        "🎉 Great! Now let's connect you to Canvas so I can help manage your assignments and deadlines."
    );
    await messengerApi.sendCanvasTokenRequest(senderId);
}

async function handleFinalConsentDecline(senderId) {
    await messengerApi.sendTextMessage(
        senderId,
        "I understand. Unfortunately, I can't provide my services without your consent. " +
        "Feel free to return anytime if you change your mind! 👋"
    );
}

// Canvas Token Flow Handlers
async function handleTokenKnowHow(senderId) {
    await setUserState(senderId, "waiting_for_token", "user_clicked_token_know_how");
    await messengerApi.sendTextMessage(
        senderId,
        "🔑 Perfect! Please paste your Canvas Access Token here. \\n\\n" +
        "⚠️ Make sure to keep it secure and don't share it with anyone else!"
    );
}

async function handleTokenNeedHelp(senderId) {
    const instructions = (
        "Here's how to get your Canvas Access Token:\\n\\n" +
        "1. Log into your Canvas account\\n" +
        "2. Click on Account → Settings\\n" +
        "3. Scroll down to 'Approved Integrations'\\n" +
        "4. Click '+ New Access Token'\\n" +
        "5. Enter 'Easely Bot' as the purpose\\n" +
        "6. Leave expiry date blank (never expires)\\n" +
        "7. Click 'Generate Token'\\n" +
        "8. Copy the token immediately\\n\\n" +
        "IMPORTANT: Save the token before closing the dialog - you won't see it again!"
    );
    
    await messengerApi.sendTextMessage(senderId, instructions);
    
    // Ask if they want video or are ready
    const quickReplies = [
        messengerApi.createQuickReply("Watch Video", "WATCH_VIDEO"),
        messengerApi.createQuickReply("I have my token", "TOKEN_READY")
    ];
    
    await messengerApi.sendQuickReplies(
        senderId,
        "Would you like to watch a video tutorial or do you have your token ready?",
        quickReplies
    );
}

async function handleTokenReady(senderId) {
    await setUserState(senderId, "waiting_for_token", "user_clicked_token_ready");
    await messengerApi.sendTextMessage(
        senderId,
        "Great! Please paste your Canvas Access Token here:\\n\\n" +
        "It should look something like: 1234~abcd1234efgh5678...\\n\\n" +
        "Your token will be encrypted and stored securely."
    );
}

async function handleTokenTutorial(senderId) {
    await handleTokenNeedHelp(senderId);
}

async function handleWatchVideo(senderId) {
    // For now, provide detailed instructions (video integration can be added later)
    await handleTokenNeedHelp(senderId);
}

// Token input processing
async function handleTokenInput(senderId, token) {
    token = token.trim();
    
    // Check if user wants to cancel or go back
    if (['cancel', 'back', 'menu', 'stop'].includes(token.toLowerCase())) {
        await clearUserState(senderId);
        await messengerApi.sendTextMessage(
            senderId,
            "Token setup cancelled. You can try again anytime!"
        );
        await messengerApi.sendMainMenu(senderId);
        return;
    }
    
    // Basic token format validation
    if (token.length < 10) {
        await messengerApi.sendTextMessage(
            senderId,
            "🚫 That doesn't look like a valid Canvas token. Canvas tokens are usually much longer.\\n\\n" +
            "Please paste your full Canvas Access Token, or type 'cancel' to go back."
        );
        return;
    }
    
    // Check for obvious non-token text
    if (['l', 'ok', 'yes', 'no', 'hello', 'hi'].includes(token.toLowerCase()) || token.length < 5) {
        await messengerApi.sendTextMessage(
            senderId,
            "🤔 That doesn't look like a Canvas token. \\n\\n" +
            "Canvas tokens look like: '1234~abcd1234efgh5678ijkl9012...'\\n\\n" +
            "Please paste your Canvas Access Token, or type 'cancel' to go back."
        );
        return;
    }
    
    // If token looks reasonable, process it
    await messengerApi.sendTextMessage(
        senderId,
        "Token received. Validating with Canvas..."
    );
    
    // Validate the token with Canvas API
    try {
        // Test the Canvas connection with the provided token
        const validationResult = await testCanvasConnection(token);
        
        if (!validationResult.success) {
            await messengerApi.sendTextMessage(
                senderId,
                "❌ Invalid Canvas token. Please make sure you copied the entire token correctly.\n\n" +
                "Try again or type 'cancel' to go back."
            );
            return;
        }
        
        await messengerApi.sendTextMessage(
            senderId,
            `✅ Token verified! Welcome, ${validationResult.user.name || 'Student'}!\n\nSyncing your Canvas data...`
        );
        
        // Store the token in database (encrypt in production)
        try {
            const { updateUser } = require('../database/supabaseClient');
            await updateUser(senderId, {
                canvas_token: token, // In production, encrypt this
                last_canvas_sync: new Date().toISOString(),
                canvas_sync_enabled: true,
                onboarding_completed: true // Mark onboarding as complete
            });
            console.log(`Successfully stored Canvas token for user ${senderId}`);
        } catch (dbError) {
            console.error(`Error storing Canvas token in database: ${dbError.message}`);
        }
        
        // Clear the waiting state and mark token as verified
        await clearUserState(senderId);
        await setUserState(senderId, "token_verified", "token_validation_success");
        
        // Show success message and offer premium upgrade
        await messengerApi.sendTextMessage(
            senderId,
            "Great! Your Canvas integration is complete.\\n\\n" +
            "I can now help you stay on top of your assignments and deadlines. " +
            "Would you like to see what Easely Premium offers?"
        );
        
        // Offer premium upgrade
        const quickReplies = [
            messengerApi.createQuickReply("💎 Learn More", "SHOW_PREMIUM"),
            messengerApi.createQuickReply("📚 Start Using Free", "SKIP_PREMIUM")
        ];
        
        await messengerApi.sendQuickReplies(
            senderId,
            "Choose your next step:",
            quickReplies
        );
        
    } catch (error) {
        console.error(`Token validation error: ${error.message}`);
        await messengerApi.sendTextMessage(
            senderId,
            "⚠️ There was an issue validating your token. Please try again or type 'cancel' to go back."
        );
    }
}

// Task management handlers with Canvas API integration
async function handleGetTasksToday(senderId) {
    try {
        await messengerApi.sendTextMessage(senderId, "🔄 Fetching today's assignments from Canvas...");
        
        // Fetch assignments due in the next 24 hours
        const assignments = await fetchUpcomingAssignments(senderId, 1);
        
        if (assignments && assignments.length > 0) {
            // Filter for assignments due today
            const todayAssignments = assignments.filter(assignment => {
                const dueDate = moment(assignment.due_at);
                return dueDate.isSame(moment(), 'day');
            });
            
            if (todayAssignments.length > 0) {
                const formattedList = formatAssignmentsList(todayAssignments);
                await messengerApi.sendTextMessage(senderId, formattedList);
            } else {
                await messengerApi.sendTextMessage(senderId, "✨ No assignments due today! You're all caught up!");
            }
        } else {
            await messengerApi.sendTextMessage(senderId, "✨ No assignments due today! You're all caught up!");
        }
    } catch (error) {
        console.error(`Error fetching today's tasks for ${senderId}:`, error.message);
        
        if (error.message.includes('Canvas not connected')) {
            await messengerApi.sendTextMessage(
                senderId,
                "❌ Canvas is not connected. Please set up your Canvas token first.\n\n" +
                "Use the 'Canvas Setup' option from the menu to connect your account."
            );
        } else {
            await messengerApi.sendTextMessage(
                senderId,
                "❌ Unable to fetch assignments. Please check your Canvas connection or try again later."
            );
        }
    }
}

async function handleGetTasksWeek(senderId) {
    try {
        await messengerApi.sendTextMessage(senderId, "🔄 Fetching this week's assignments from Canvas...");
        
        // Fetch assignments for this week
        const assignments = await fetchThisWeekAssignments(senderId);
        
        if (assignments && assignments.length > 0) {
            const formattedList = formatAssignmentsList(assignments);
            await messengerApi.sendTextMessage(senderId, formattedList);
        } else {
            await messengerApi.sendTextMessage(senderId, "✨ No assignments due this week! You're ahead of schedule!");
        }
    } catch (error) {
        console.error(`Error fetching week's tasks for ${senderId}:`, error.message);
        
        if (error.message.includes('Canvas not connected')) {
            await messengerApi.sendTextMessage(
                senderId,
                "❌ Canvas is not connected. Please set up your Canvas token first.\n\n" +
                "Use the 'Canvas Setup' option from the menu to connect your account."
            );
        } else {
            await messengerApi.sendTextMessage(
                senderId,
                "❌ Unable to fetch assignments. Please check your Canvas connection or try again later."
            );
        }
    }
}

async function handleGetTasksOverdue(senderId) {
    try {
        await messengerApi.sendTextMessage(senderId, "🔄 Checking for overdue assignments...");
        
        // Fetch all assignments and filter for overdue
        const assignments = await fetchUpcomingAssignments(senderId, 30); // Get last 30 days worth
        
        if (assignments && assignments.length > 0) {
            const now = moment();
            const overdueAssignments = assignments.filter(assignment => {
                const dueDate = moment(assignment.due_at);
                return dueDate.isBefore(now);
            });
            
            if (overdueAssignments.length > 0) {
                const formattedList = formatAssignmentsList(overdueAssignments);
                await messengerApi.sendTextMessage(
                    senderId,
                    "⚠️ **Overdue Assignments:**\n\n" + formattedList
                );
            } else {
                await messengerApi.sendTextMessage(senderId, "✅ No overdue assignments! Great job staying on top of things!");
            }
        } else {
            await messengerApi.sendTextMessage(senderId, "✅ No overdue assignments! Great job staying on top of things!");
        }
    } catch (error) {
        console.error(`Error fetching overdue tasks for ${senderId}:`, error.message);
        
        if (error.message.includes('Canvas not connected')) {
            await messengerApi.sendTextMessage(
                senderId,
                "❌ Canvas is not connected. Please set up your Canvas token first.\n\n" +
                "Use the 'Canvas Setup' option from the menu to connect your account."
            );
        } else {
            await messengerApi.sendTextMessage(
                senderId,
                "❌ Unable to fetch assignments. Please check your Canvas connection or try again later."
            );
        }
    }
}

async function handleGetTasksAll(senderId) {
    try {
        await messengerApi.sendTextMessage(senderId, "🔄 Fetching all upcoming assignments...");
        
        // Fetch assignments for the next 30 days
        const assignments = await fetchUpcomingAssignments(senderId, 30);
        
        if (assignments && assignments.length > 0) {
            const formattedList = formatAssignmentsList(assignments);
            await messengerApi.sendTextMessage(senderId, formattedList);
            
            if (assignments.length > 10) {
                await messengerApi.sendTextMessage(
                    senderId,
                    `📊 Showing first 10 of ${assignments.length} assignments. Check Canvas for complete list.`
                );
            }
        } else {
            await messengerApi.sendTextMessage(senderId, "📚 No upcoming assignments found!");
        }
    } catch (error) {
        console.error(`Error fetching all tasks for ${senderId}:`, error.message);
        
        if (error.message.includes('Canvas not connected')) {
            await messengerApi.sendTextMessage(
                senderId,
                "❌ Canvas is not connected. Please set up your Canvas token first.\n\n" +
                "Use the 'Canvas Setup' option from the menu to connect your account."
            );
        } else {
            await messengerApi.sendTextMessage(
                senderId,
                "❌ Unable to fetch assignments. Please check your Canvas connection or try again later."
            );
        }
    }
}

async function handleAddNewTask(senderId) {
    await messengerApi.sendTextMessage(senderId, "This feature will be available soon! Stay tuned!");
}

// Placeholder handlers for other functionality
async function handleDateSelection(senderId, payload) {
    await messengerApi.sendTextMessage(senderId, "Date selection coming soon!");
}

async function handleTimeSelection(senderId, payload) {
    await messengerApi.sendTextMessage(senderId, "Time selection coming soon!");
}

async function handleShowSettings(senderId) {
    await messengerApi.sendTextMessage(senderId, "Settings panel coming soon!");
}

async function handleShowHelp(senderId) {
    const helpText = (
        "🤖 **Easely Bot Help**\\n\\n" +
        "I'm your Canvas LMS assistant! Here's what I can do:\\n\\n" +
        "📚 **Free Features:**\\n" +
        "• View tasks due today, this week, or overdue\\n" +
        "• Basic Canvas sync\\n" +
        "• Assignment reminders\\n\\n" +
        "💎 **Premium Features:**\\n" +
        "• Enhanced reminders\\n" +
        "• Unlimited manual tasks\\n" +
        "• AI-powered study planning\\n\\n" +
        "Need help? Type 'menu' to see options!"
    );
    await messengerApi.sendTextMessage(senderId, helpText);
}

async function handleShowAbout(senderId) {
    const aboutText = (
        "🤖 **About Easely Bot**\\n\\n" +
        "Version: 1.0.0\\n" +
        "Developed by: Kean Louis\\n\\n" +
        "Easely is your personal Canvas LMS assistant designed to help students " +
        "stay organized with assignments, deadlines, and study planning.\\n\\n" +
        "We're constantly improving to serve you better!\\n\\n" +
        "Contact: facebook.com/keanlouis30"
    );
    await messengerApi.sendTextMessage(senderId, aboutText);
}

async function handleShowPremium(senderId) {
    await messengerApi.sendTextMessage(senderId, "Premium features info coming soon!");
}

async function handleSkipPremium(senderId) {
    await messengerApi.sendTextMessage(senderId, "No problem! You can always upgrade later.");
    await messengerApi.sendMainMenu(senderId);
}

async function handleSyncCanvas(senderId) {
    await messengerApi.sendTextMessage(senderId, "Canvas sync coming soon!");
}

async function handlePremiumActivation(senderId) {
    await messengerApi.sendTextMessage(senderId, "Premium activation coming soon!");
}

// New handlers for hamburger menu items
async function handleNotificationSettings(senderId) {
    const notificationText = (
        "🔔 **Notification Settings**\\n\\n" +
        "Choose when you want to receive reminders:\\n\\n" +
        "Free users: 24 hours before due\\n" +
        "Premium users: 1 week, 3 days, 1 day, 8h, 2h, 1h\\n\\n" +
        "Feature coming soon! For now, all users receive standard notifications."
    );
    await messengerApi.sendTextMessage(senderId, notificationText);
}

async function handleAccountSettings(senderId) {
    const settingsText = (
        "⚙️ **Account Settings**\\n\\n" +
        "• Canvas Token: " + (await userHasCanvasToken(senderId) ? "✅ Connected" : "❌ Not connected") + "\\n" +
        "• Premium Status: " + (await isUserPremium(senderId) ? "💎 Premium" : "🆓 Free") + "\\n" +
        "• Member Since: " + (await getUserJoinDate(senderId) || "Recently joined") + "\\n\\n" +
        "Need to update your Canvas token? Use the Canvas Setup option in the menu."
    );
    await messengerApi.sendTextMessage(senderId, settingsText);
}

async function handleEnterPremiumCode(senderId) {
    await messengerApi.sendTextMessage(
        senderId,
        "💎 **Enter Premium Activation Code**\\n\\n" +
        "Please enter your premium activation code below. " +
        "You should have received this code after your payment.\\n\\n" +
        "Example: EASELY-XXXXX-XXXXX\\n\\n" +
        "Don't have a code? Contact us at facebook.com/keanlouis30"
    );
    await setUserState(senderId, "waiting_for_premium_code");
}

// Helper functions for account settings
async function userHasCanvasToken(senderId) {
    try {
        const user = await getUser(senderId);
        return user && user.canvas_token;
    } catch {
        return false;
    }
}

async function isUserPremium(senderId) {
    try {
        const user = await getUser(senderId);
        return user && user.premium_user;
    } catch {
        return false;
    }
}

async function getUserJoinDate(senderId) {
    try {
        const user = await getUser(senderId);
        if (user && user.created_at) {
            const date = new Date(user.created_at);
            return date.toLocaleDateString();
        }
        return null;
    } catch {
        return null;
    }
}

// Placeholder task input handlers
async function handleTaskTitleInput(senderId, text) {
    await messengerApi.sendTextMessage(senderId, "Task creation coming soon!");
    await clearUserState(senderId);
}

async function handleCustomDateInput(senderId, text) {
    await messengerApi.sendTextMessage(senderId, "Custom date input coming soon!");
    await clearUserState(senderId);
}

async function handleCustomTimeInput(senderId, text) {
    await messengerApi.sendTextMessage(senderId, "Custom time input coming soon!");
    await clearUserState(senderId);
}

async function handleTaskDetailsInput(senderId, text) {
    await messengerApi.sendTextMessage(senderId, "Task details input coming soon!");
    await clearUserState(senderId);
}

module.exports = {
    handleMessage,
    handlePostback,
    getManilaTime,
    convertToManilaTime
};
