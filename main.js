/**
 * Easely Bot - Main Application
 * Facebook Messenger Webhook for Canvas LMS Assistant
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { handleMessage, handlePostback } = require('./app/core/eventHandler');
const { verifyWebhook, setupBotProfile, sendTextMessage } = require('./app/api/messengerApi');
const {
    VERIFY_TOKEN,
    PAGE_ACCESS_TOKEN,
    PORT,
    DEBUG_MODE,
    APP_ENV,
    API_RATE_LIMIT,
    validateSettings
} = require('./config/settings');

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Logging middleware
if (DEBUG_MODE) {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Rate limiting
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: API_RATE_LIMIT, // Limit each IP to API_RATE_LIMIT requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Store recently processed message IDs to prevent duplicates
const processedMessageIds = new Set();

/**
 * Enhanced health check endpoint with dependency validation
 */
app.get('/', async (req, res) => {
    const healthStatus = {
        status: 'running',
        service: 'Easely Bot',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: APP_ENV
    };
    
    // Check critical environment variables
    const requiredVars = ['PAGE_ACCESS_TOKEN', 'VERIFY_TOKEN'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        healthStatus.status = 'degraded';
        healthStatus.missingEnvVars = missingVars;
        healthStatus.warning = 'Missing required environment variables';
        return res.status(503).json(healthStatus);
    }
    
    // Check Supabase connection if configured
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    
    if (supabaseUrl && supabaseKey) {
        try {
            const { testConnection } = require('./app/database/supabaseClient');
            if (await testConnection()) {
                healthStatus.database = 'connected';
            } else {
                healthStatus.status = 'degraded';
                healthStatus.database = 'connection_failed';
                return res.status(503).json(healthStatus);
            }
        } catch (error) {
            healthStatus.status = 'degraded';
            healthStatus.database = 'error';
            healthStatus.databaseError = error.message;
            return res.status(503).json(healthStatus);
        }
    } else {
        healthStatus.database = 'not_configured';
    }
    
    res.json(healthStatus);
});

/**
 * Main webhook endpoint for Facebook Messenger
 * Handles both verification and message processing
 */
app.get('/webhook', (req, res) => {
    console.log('Received webhook verification request');
    
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    if (verifyWebhook(mode, token, challenge)) {
        console.log('Webhook verified successfully');
        res.status(200).send(challenge);
    } else {
        console.error('Webhook verification failed');
        res.status(403).send('Forbidden');
    }
});

app.post('/webhook', (req, res) => {
    const data = req.body;
    
    if (!data) {
        console.warn('Received empty POST request');
        return res.status(400).send('Bad Request');
    }
    
    console.log('Received webhook data:', JSON.stringify(data, null, 2));
    
    try {
        // Process each entry in the webhook
        if (data.entry) {
            data.entry.forEach(entry => {
                if (entry.messaging) {
                    entry.messaging.forEach(event => {
                        processMessageEvent(event);
                    });
                }
            });
        }
        
        // Always return 200 OK to acknowledge receipt
        res.status(200).send('OK');
        
    } catch (error) {
        console.error(`Error processing webhook: ${error.message}`);
        // Still return 200 to prevent Facebook from retrying
        res.status(200).send('OK');
    }
});

/**
 * Set up bot profile (persistent menu, get started button, greeting)
 * This endpoint should be called once during deployment
 */
app.post('/setup', async (req, res) => {
    try {
        console.log('Starting bot profile setup...');
        const success = await setupBotProfile();
        
        if (success) {
            res.json({
                status: 'success',
                message: 'Bot profile setup completed successfully'
            });
        } else {
            res.status(207).json({
                status: 'partial',
                message: 'Bot profile setup partially completed - check logs'
            });
        }
    } catch (error) {
        console.error(`Error during bot setup: ${error.message}`);
        res.status(500).json({
            status: 'error',
            message: `Bot setup failed: ${error.message}`
        });
    }
});

/**
 * Broadcast a message to multiple recipients
 * Expects JSON payload with: title, message, recipients
 * Returns success/failure counts
 */
app.post('/broadcast', async (req, res) => {
    try {
        const data = req.body;
        
        if (!data) {
            console.warn('Received empty broadcast request');
            return res.status(400).json({
                error: 'No data provided'
            });
        }
        
        // Validate required fields
        const { title = '', message = '', recipients = [] } = data;
        
        if (!message) {
            return res.status(400).json({
                error: 'Message is required'
            });
        }
        
        if (!Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({
                error: 'Recipients list is required'
            });
        }
        
        console.log(`Broadcasting message to ${recipients.length} recipients`);
        console.log(`Broadcast title: ${title}`);
        console.log(`Broadcast message: ${message.substring(0, 100)}...`);
        
        // Format the full message
        const fullMessage = title ? `📢 ${title}\n\n${message}` : message;
        
        // Initialize counters
        let successCount = 0;
        let failCount = 0;
        const failedRecipients = [];
        
        // Send message to each recipient
        for (const recipientId of recipients) {
            try {
                // Validate recipient ID format (should be a string of digits)
                if (typeof recipientId !== 'string' || !/^\d+$/.test(recipientId)) {
                    console.warn(`Invalid recipient ID format: ${recipientId}`);
                    failCount++;
                    failedRecipients.push(recipientId);
                    continue;
                }
                
                // Send the message
                const success = await sendTextMessage(recipientId, fullMessage);
                
                if (success) {
                    successCount++;
                    console.log(`Message sent successfully to ${recipientId}`);
                } else {
                    failCount++;
                    failedRecipients.push(recipientId);
                    console.warn(`Failed to send message to ${recipientId}`);
                }
            } catch (error) {
                failCount++;
                failedRecipients.push(recipientId);
                console.error(`Error sending to ${recipientId}: ${error.message}`);
            }
        }
        
        // Log broadcast results
        console.log(`Broadcast completed: ${successCount} successful, ${failCount} failed`);
        
        // Prepare response
        const responseData = {
            successful: successCount,
            failed: failCount,
            totalRecipients: recipients.length
        };
        
        // Include failed recipients in response if any (for debugging)
        if (failedRecipients.length > 0) {
            responseData.failedRecipients = failedRecipients.slice(0, 10); // Limit to first 10
        }
        
        res.json(responseData);
        
    } catch (error) {
        console.error(`Error in broadcast endpoint: ${error.message}`);
        res.status(500).json({
            error: `Broadcast failed: ${error.message}`,
            successful: 0,
            failed: 0
        });
    }
});

/**
 * Process individual message events from the webhook with comprehensive logging
 */
async function processMessageEvent(event) {
    const { logWebhookEvent, logUserMessage } = require('./app/database/supabaseClient');
    
    let senderId = null;
    let eventType = 'unknown';
    let processingStatus = 'success';
    let errorMessage = null;
    
    // Check for message ID to prevent duplicate processing
    let messageId = null;
    if (event.message && event.message.mid) {
        messageId = event.message.mid;
        if (processedMessageIds.has(messageId)) {
            console.log(`Skipping duplicate message ${messageId}`);
            return;
        }
        processedMessageIds.add(messageId);
        // Keep only last 1000 message IDs to prevent memory issues
        if (processedMessageIds.size > 1000) {
            processedMessageIds.clear();
        }
    }
    
    try {
        senderId = event.sender?.id;
        if (!senderId) {
            console.warn(`Event missing sender ID: ${JSON.stringify(event)}`);
            return;
        }
        
        // Handle different types of events
        if (event.message) {
            const message = event.message;
            
            if (message.quick_reply) {
                // Handle quick reply payload
                const payload = message.quick_reply.payload;
                eventType = 'quick_reply';
                console.log(`Received quick reply from ${senderId}: ${payload}`);
                
                // Log the user interaction
                await logUserMessage(
                    senderId,
                    'quick_reply',
                    payload,
                    event,
                    `handlePostback(${payload})`
                );
                
                await handlePostback(senderId, payload);
                
            } else if (message.text) {
                // Handle regular text message
                const text = message.text;
                eventType = 'text_message';
                console.log(`Received message from ${senderId}: ${text}`);
                
                // Log the user interaction
                await logUserMessage(
                    senderId,
                    'text',
                    text,
                    event,
                    `handleMessage(${text.substring(0, 50)}...)`
                );
                
                await handleMessage(senderId, text);
                
            } else if (message.attachments) {
                // Handle attachments (files, images, etc.)
                const attachments = message.attachments;
                eventType = 'attachment';
                const attachmentTypes = attachments.map(att => att.type || 'unknown');
                console.log(`Received attachment from ${senderId}: ${attachmentTypes}`);
                
                // Log the attachment
                await logUserMessage(
                    senderId,
                    'attachment',
                    `Attachments: ${attachmentTypes.join(', ')}`,
                    event,
                    'attachment_received'
                );
                
                // Handle attachments
                await sendTextMessage(
                    senderId,
                    "I received your attachment, but I can only process text messages right now. Please send me a text message!"
                );
            }
        } else if (event.postback) {
            // Handle postback from persistent menu or buttons
            const payload = event.postback.payload;
            eventType = 'postback';
            console.log(`Received postback from ${senderId}: ${payload}`);
            
            // Log the user interaction
            await logUserMessage(
                senderId,
                'postback',
                payload,
                event,
                `handlePostback(${payload})`
            );
            
            await handlePostback(senderId, payload);
            
        } else if (event.referral) {
            // Handle m.me links or ads
            const referral = event.referral.ref;
            eventType = 'referral';
            console.log(`Received referral from ${senderId}: ${referral}`);
            
            // Log the referral
            await logUserMessage(
                senderId,
                'referral',
                referral,
                event,
                'referral_received'
            );
            
            // Handle referral
            await sendTextMessage(
                senderId,
                "👋 Welcome! I'm Easely, your Canvas assistant. Let me help you get started!"
            );
            
        } else if (event.delivery) {
            // Handle delivery confirmations (when our messages are delivered)
            eventType = 'delivery';
            console.log(`Message delivery confirmation from ${senderId}`);
            processingStatus = 'success'; // Mark as successfully processed (ignored)
            
        } else if (event.read) {
            // Handle read receipts (when user reads our messages)
            eventType = 'read';
            console.log(`Message read receipt from ${senderId}`);
            processingStatus = 'success'; // Mark as successfully processed (ignored)
            
        } else {
            eventType = 'unhandled';
            console.warn(`Unhandled event type from ${senderId}: ${Object.keys(event)}`);
            processingStatus = 'success'; // Change from "warning" to "success" to avoid DB constraint issues
            errorMessage = `Unhandled event type: ${Object.keys(event)}`;
        }
        
    } catch (error) {
        processingStatus = 'error';
        errorMessage = error.message;
        console.error(`Error processing message event: ${error.message}`);
        
        // Log the error even if we couldn't process the event
        if (senderId) {
            try {
                await logUserMessage(
                    senderId,
                    eventType,
                    'ERROR',
                    event,
                    `error: ${error.message}`
                );
            } catch (logError) {
                // Don't let logging errors crash the webhook
            }
        }
    } finally {
        // Log the final webhook processing status
        if (senderId) {
            try {
                await logWebhookEvent(eventType, senderId, event, processingStatus, errorMessage);
            } catch (logError) {
                // Don't let logging errors crash the webhook
            }
        }
    }
}

// Error handlers
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

app.use((error, req, res, next) => {
    console.error(`Internal server error: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
});

// Start the server
const port = process.env.PORT || PORT;
app.listen(port, '0.0.0.0', () => {
    console.log(`Starting Easely Bot on port ${port}`);
    console.log(`Environment: ${APP_ENV}`);
    console.log(`Debug mode: ${DEBUG_MODE}`);
    
    // Validate settings on startup
    try {
        validateSettings();
        console.log('Settings validation passed');
    } catch (error) {
        console.error(`Settings validation failed: ${error.message}`);
        process.exit(1);
    }
});
