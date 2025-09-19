"""
Easely Bot - Main Application
Facebook Messenger Webhook for Canvas LMS Assistant
"""

import os
import logging
from datetime import datetime
from flask import Flask, request, jsonify
from app.core.event_handler import handle_message, handle_postback
from app.api.messenger_api import verify_webhook, setup_bot_profile
from config.settings import (
    VERIFY_TOKEN,
    PAGE_ACCESS_TOKEN,
    PORT,
    DEBUG_MODE
)

# Initialize Flask app
app = Flask(__name__)

# Configure logging
logging.basicConfig(
    level=logging.INFO if not DEBUG_MODE else logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.route('/', methods=['GET'])
def home():
    """Enhanced health check endpoint with dependency validation"""
    health_status = {
        "status": "running",
        "service": "Easely Bot",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat() + 'Z',
        "environment": os.environ.get('APP_ENV', 'development')
    }
    
    # Check critical environment variables
    required_vars = ['PAGE_ACCESS_TOKEN', 'VERIFY_TOKEN']
    missing_vars = [var for var in required_vars if not os.environ.get(var)]
    
    if missing_vars:
        health_status.update({
            "status": "degraded",
            "missing_env_vars": missing_vars,
            "warning": "Missing required environment variables"
        })
        return jsonify(health_status), 503
    
    # Check Supabase connection if configured
    supabase_url = os.environ.get('SUPABASE_URL')
    supabase_key = os.environ.get('SUPABASE_KEY')
    
    if supabase_url and supabase_key:
        try:
            from app.database.supabase_client import supabase_client
            if supabase_client.test_connection():
                health_status["database"] = "connected"
            else:
                health_status.update({
                    "status": "degraded",
                    "database": "connection_failed"
                })
                return jsonify(health_status), 503
        except Exception as e:
            health_status.update({
                "status": "degraded",
                "database": "error",
                "database_error": str(e)
            })
            return jsonify(health_status), 503
    else:
        health_status["database"] = "not_configured"
    
    return jsonify(health_status), 200


@app.route('/webhook', methods=['GET', 'POST'])
def webhook():
    """
    Main webhook endpoint for Facebook Messenger
    Handles both verification and message processing
    """
    
    # Webhook verification
    if request.method == 'GET':
        logger.info("Received webhook verification request")
        
        mode = request.args.get('hub.mode')
        token = request.args.get('hub.verify_token')
        challenge = request.args.get('hub.challenge')
        
        if verify_webhook(mode, token, challenge):
            logger.info("Webhook verified successfully")
            return challenge
        else:
            logger.error("Webhook verification failed")
            return 'Forbidden', 403
    
    # Message processing
    elif request.method == 'POST':
        data = request.get_json()
        
        if not data:
            logger.warning("Received empty POST request")
            return 'Bad Request', 400
        
        logger.debug(f"Received webhook data: {data}")
        
        try:
            # Process each entry in the webhook
            if 'entry' in data:
                for entry in data['entry']:
                    if 'messaging' in entry:
                        for event in entry['messaging']:
                            process_message_event(event)
            
            # Always return 200 OK to acknowledge receipt
            return 'OK', 200
            
        except Exception as e:
            logger.error(f"Error processing webhook: {str(e)}")
            # Still return 200 to prevent Facebook from retrying
            return 'OK', 200
    
    return 'Method Not Allowed', 405


@app.route('/setup', methods=['POST'])
def setup_bot():
    """
    Set up bot profile (persistent menu, get started button, greeting)
    This endpoint should be called once during deployment
    """
    try:
        logger.info("Starting bot profile setup...")
        success = setup_bot_profile()
        
        if success:
            return jsonify({
                "status": "success",
                "message": "Bot profile setup completed successfully"
            }), 200
        else:
            return jsonify({
                "status": "partial",
                "message": "Bot profile setup partially completed - check logs"
            }), 207  # Multi-Status
            
    except Exception as e:
        logger.error(f"Error during bot setup: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Bot setup failed: {str(e)}"
        }), 500


def process_message_event(event):
    """
    Process individual message events from the webhook with comprehensive logging
    
    Args:
        event: Message event from Facebook Messenger
    """
    from app.database.supabase_client import log_webhook_event, log_user_message
    
    sender_id = None
    event_type = "unknown"
    processing_status = "success"
    error_message = None
    
    try:
        sender_id = event.get('sender', {}).get('id')
        if not sender_id:
            logger.warning(f"Event missing sender ID: {event}")
            return
        
        # Log the raw webhook event
        log_webhook_event("message_event", sender_id, event, "processing")
        
        # Handle different types of events
        if 'message' in event:
            message = event['message']
            
            if 'quick_reply' in message:
                # Handle quick reply payload
                payload = message['quick_reply']['payload']
                event_type = "quick_reply"
                logger.info(f"Received quick reply from {sender_id}: {payload}")
                
                # Log the user interaction
                log_user_message(
                    sender_id, 
                    "quick_reply", 
                    payload, 
                    event_data=event, 
                    response_action=f"handle_postback({payload})"
                )
                
                handle_postback(sender_id, payload)
                
            elif 'text' in message:
                # Handle regular text message
                text = message['text']
                event_type = "text_message"
                logger.info(f"Received message from {sender_id}: {text}")
                
                # Log the user interaction
                log_user_message(
                    sender_id, 
                    "text", 
                    text, 
                    event_data=event, 
                    response_action=f"handle_message({text[:50]}...)"
                )
                
                handle_message(sender_id, text)
                
            elif 'attachments' in message:
                # Handle attachments (files, images, etc.)
                attachments = message['attachments']
                event_type = "attachment"
                attachment_types = [att.get('type', 'unknown') for att in attachments]
                logger.info(f"Received attachment from {sender_id}: {attachment_types}")
                
                # Log the attachment
                log_user_message(
                    sender_id, 
                    "attachment", 
                    f"Attachments: {', '.join(attachment_types)}", 
                    event_data=event, 
                    response_action="attachment_received"
                )
                
                # Handle attachments (could add specific handler if needed)
                from app.api.messenger_api import send_text_message
                send_text_message(
                    sender_id,
                    "I received your attachment, but I can only process text messages right now. Please send me a text message!"
                )
        
        elif 'postback' in event:
            # Handle postback from persistent menu or buttons
            payload = event['postback']['payload']
            event_type = "postback"
            logger.info(f"Received postback from {sender_id}: {payload}")
            
            # Log the user interaction
            log_user_message(
                sender_id, 
                "postback", 
                payload, 
                event_data=event, 
                response_action=f"handle_postback({payload})"
            )
            
            handle_postback(sender_id, payload)
        
        elif 'referral' in event:
            # Handle m.me links or ads
            referral = event['referral']['ref']
            event_type = "referral"
            logger.info(f"Received referral from {sender_id}: {referral}")
            
            # Log the referral
            log_user_message(
                sender_id, 
                "referral", 
                referral, 
                event_data=event, 
                response_action="referral_received"
            )
            
            # Handle referral - could trigger onboarding or specific flow
            from app.api.messenger_api import send_text_message
            send_text_message(
                sender_id,
                "👋 Welcome! I'm Easely, your Canvas assistant. Let me help you get started!"
            )
            
        else:
            event_type = "unhandled"
            logger.warning(f"Unhandled event type from {sender_id}: {list(event.keys())}")
            processing_status = "warning"
            error_message = f"Unhandled event type: {list(event.keys())}"
            
    except Exception as e:
        processing_status = "error"
        error_message = str(e)
        logger.error(f"Error processing message event: {str(e)}")
        
        # Log the error even if we couldn't process the event
        if sender_id:
            try:
                log_user_message(
                    sender_id, 
                    event_type, 
                    "ERROR", 
                    event_data=event, 
                    response_action=f"error: {str(e)}"
                )
            except:
                pass  # Don't let logging errors crash the webhook
        
    finally:
        # Log the final webhook processing status
        if sender_id:
            try:
                log_webhook_event(event_type, sender_id, event, processing_status, error_message)
            except:
                pass  # Don't let logging errors crash the webhook


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({"error": "Internal server error"}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', PORT))
    logger.info(f"Starting Easely Bot on port {port}")
    app.run(host='0.0.0.0', port=port, debug=DEBUG_MODE)