/**
 * Setup Bot Profile Script
 * Run this once to configure the Facebook Messenger bot profile
 * This sets up the hamburger menu, greeting, and get started button
 */

const axios = require('axios');
require('dotenv').config();

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const GRAPH_API_URL = process.env.GRAPH_API_URL || 'https://graph.facebook.com/v17.0';

if (!PAGE_ACCESS_TOKEN) {
    console.error('❌ Error: PAGE_ACCESS_TOKEN is required in your .env file');
    process.exit(1);
}

/**
 * Remove any existing profile settings to start fresh
 */
async function clearProfile() {
    console.log('🧹 Clearing existing profile settings...');
    try {
        const url = `${GRAPH_API_URL}/me/messenger_profile`;
        const params = { access_token: PAGE_ACCESS_TOKEN };
        
        // Remove existing profile fields
        const fields = {
            fields: [
                "persistent_menu",
                "get_started",
                "greeting",
                "whitelisted_domains"
            ]
        };
        
        await axios.delete(url, { 
            params,
            data: fields
        });
        
        console.log('✅ Profile cleared successfully');
        return true;
    } catch (error) {
        console.error('⚠️ Warning: Could not clear profile:', error.response?.data?.error?.message || error.message);
        return false;
    }
}

/**
 * Set up the persistent menu (hamburger menu)
 * This replaces any default buttons with a custom menu
 */
async function setupPersistentMenu() {
    console.log('📱 Setting up persistent menu (hamburger menu)...');
    try {
        const url = `${GRAPH_API_URL}/me/messenger_profile`;
        const params = { access_token: PAGE_ACCESS_TOKEN };
        
        const persistentMenu = {
            persistent_menu: [
                {
                    locale: "default",
                    composer_input_disabled: false,
                    call_to_actions: [
                        {
                            title: "📚 My Tasks",
                            type: "postback",
                            payload: "MAIN_MENU"
                        },
                        {
                            title: "🎯 Quick Actions",
                            type: "nested",
                            call_to_actions: [
                                {
                                    title: "Due Today",
                                    type: "postback",
                                    payload: "GET_TASKS_TODAY"
                                },
                                {
                                    title: "This Week",
                                    type: "postback",
                                    payload: "GET_TASKS_WEEK"
                                },
                                {
                                    title: "Overdue",
                                    type: "postback",
                                    payload: "GET_TASKS_OVERDUE"
                                },
                                {
                                    title: "All Tasks",
                                    type: "postback",
                                    payload: "GET_TASKS_ALL"
                                },
                                {
                                    title: "Add New Task",
                                    type: "postback",
                                    payload: "ADD_NEW_TASK"
                                }
                            ]
                        },
                        {
                            title: "⚙️ Settings",
                            type: "nested",
                            call_to_actions: [
                                {
                                    title: "Canvas Setup",
                                    type: "postback",
                                    payload: "TOKEN_TUTORIAL"
                                },
                                {
                                    title: "Sync Canvas",
                                    type: "postback",
                                    payload: "SYNC_CANVAS"
                                },
                                {
                                    title: "Notifications",
                                    type: "postback",
                                    payload: "NOTIFICATION_SETTINGS"
                                },
                                {
                                    title: "Account Settings",
                                    type: "postback",
                                    payload: "ACCOUNT_SETTINGS"
                                }
                            ]
                        },
                        {
                            title: "💎 Premium",
                            type: "nested",
                            call_to_actions: [
                                {
                                    title: "View Features",
                                    type: "postback",
                                    payload: "SHOW_PREMIUM"
                                },
                                {
                                    title: "Upgrade Now",
                                    type: "web_url",
                                    url: "https://facebook.com/keanlouis30",
                                    webview_height_ratio: "full"
                                },
                                {
                                    title: "Enter Code",
                                    type: "postback",
                                    payload: "ENTER_PREMIUM_CODE"
                                }
                            ]
                        },
                        {
                            title: "ℹ️ Help",
                            type: "nested",
                            call_to_actions: [
                                {
                                    title: "How to Use",
                                    type: "postback",
                                    payload: "SHOW_HELP"
                                },
                                {
                                    title: "About Easely",
                                    type: "postback",
                                    payload: "SHOW_ABOUT"
                                },
                                {
                                    title: "Privacy Policy",
                                    type: "web_url",
                                    url: "https://easelyprivacypolicy.onrender.com",
                                    webview_height_ratio: "full"
                                },
                                {
                                    title: "Terms of Use",
                                    type: "web_url",
                                    url: "https://easelytermsofuse.onrender.com",
                                    webview_height_ratio: "full"
                                },
                                {
                                    title: "Contact Support",
                                    type: "web_url",
                                    url: "https://m.me/keanlouis30",
                                    webview_height_ratio: "full"
                                }
                            ]
                        }
                    ]
                }
            ]
        };
        
        const response = await axios.post(url, persistentMenu, { params });
        
        if (response.data.result === 'success') {
            console.log('✅ Persistent menu (hamburger menu) set up successfully!');
            console.log('   Users will see a hamburger menu icon (☰) in the bottom-left corner');
            return true;
        } else {
            console.error('❌ Unexpected response:', response.data);
            return false;
        }
        
    } catch (error) {
        console.error('❌ Failed to set up persistent menu:', error.response?.data?.error?.message || error.message);
        if (error.response?.data) {
            console.error('   Full error:', JSON.stringify(error.response.data, null, 2));
        }
        return false;
    }
}

/**
 * Set up the Get Started button for new users
 */
async function setupGetStartedButton() {
    console.log('🚀 Setting up Get Started button...');
    try {
        const url = `${GRAPH_API_URL}/me/messenger_profile`;
        const params = { access_token: PAGE_ACCESS_TOKEN };
        
        const getStarted = {
            get_started: {
                payload: "GET_STARTED"
            }
        };
        
        await axios.post(url, getStarted, { params });
        console.log('✅ Get Started button configured');
        return true;
        
    } catch (error) {
        console.error('❌ Failed to set up Get Started button:', error.response?.data?.error?.message || error.message);
        return false;
    }
}

/**
 * Set up greeting text
 */
async function setupGreeting() {
    console.log('👋 Setting up greeting text...');
    try {
        const url = `${GRAPH_API_URL}/me/messenger_profile`;
        const params = { access_token: PAGE_ACCESS_TOKEN };
        
        const greeting = {
            greeting: [
                {
                    locale: "default",
                    text: "Hi {{user_first_name}}! 👋 I'm Easely, your Canvas LMS assistant. I'll help you stay organized with assignments, deadlines, and study planning. Click the ☰ menu button below or send me a message to get started! 🎯"
                }
            ]
        };
        
        await axios.post(url, greeting, { params });
        console.log('✅ Greeting text configured');
        return true;
        
    } catch (error) {
        console.error('❌ Failed to set up greeting:', error.response?.data?.error?.message || error.message);
        return false;
    }
}

/**
 * Main setup function
 */
async function setupBot() {
    console.log('\n🤖 EaselyBot Facebook Messenger Profile Setup\n');
    console.log('This will configure:');
    console.log('  • Hamburger menu (☰) with all navigation options');
    console.log('  • Get Started button for new users');
    console.log('  • Welcome greeting message\n');
    
    let success = true;
    
    // Clear existing profile first (optional)
    // Uncomment if you want to start fresh
    // await clearProfile();
    
    // Set up each component
    if (!await setupPersistentMenu()) success = false;
    if (!await setupGetStartedButton()) success = false;
    if (!await setupGreeting()) success = false;
    
    console.log('\n' + '='.repeat(50));
    if (success) {
        console.log('✅ Bot profile setup completed successfully!');
        console.log('\n📝 Notes:');
        console.log('  • The hamburger menu (☰) will appear in the bottom-left corner');
        console.log('  • It replaces any default buttons');
        console.log('  • Users can access all features through this menu');
        console.log('  • The menu is always available during conversations');
    } else {
        console.log('⚠️ Some components failed to set up.');
        console.log('Please check your PAGE_ACCESS_TOKEN and try again.');
    }
    console.log('='.repeat(50) + '\n');
}

// Run the setup
setupBot();
