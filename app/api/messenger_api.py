"""
Messenger API Module
Handles all Facebook Messenger API interactions including quick replies
"""

import json
import requests
import logging
from typing import List, Dict, Any, Optional
from config.settings import PAGE_ACCESS_TOKEN, VERIFY_TOKEN, GRAPH_API_URL

logger = logging.getLogger(__name__)


def verify_webhook(mode: str, token: str, challenge: str) -> bool:
    """
    Verify webhook during Facebook setup
    
    Args:
        mode: Webhook mode from Facebook
        token: Verification token from Facebook
        challenge: Challenge string from Facebook
    
    Returns:
        bool: True if verification successful
    """
    return mode == 'subscribe' and token == VERIFY_TOKEN


def send_message(recipient_id: str, message_data: Dict[str, Any]) -> bool:
    """
    Send a message to a user via Messenger API
    
    Args:
        recipient_id: Facebook user ID
        message_data: Message payload to send
    
    Returns:
        bool: True if message sent successfully
    """
    try:
        url = f"{GRAPH_API_URL}/me/messages"
        
        payload = {
            "recipient": {"id": recipient_id},
            "message": message_data
        }
        
        params = {"access_token": PAGE_ACCESS_TOKEN}
        
        response = requests.post(url, json=payload, params=params)
        response.raise_for_status()
        
        logger.info(f"Message sent successfully to {recipient_id}")
        return True
        
    except requests.RequestException as e:
        logger.error(f"Failed to send message to {recipient_id}: {str(e)}")
        return False


def send_text_message(recipient_id: str, text: str) -> bool:
    """
    Send a simple text message
    
    Args:
        recipient_id: Facebook user ID
        text: Text message to send
    
    Returns:
        bool: True if message sent successfully
    """
    message_data = {"text": text}
    return send_message(recipient_id, message_data)


def send_quick_replies(
    recipient_id: str,
    text: str,
    quick_replies: List[Dict[str, str]]
) -> bool:
    """
    Send a message with quick reply buttons
    
    Args:
        recipient_id: Facebook user ID
        text: Main message text
        quick_replies: List of quick reply options
            Each item should have 'title' and 'payload' keys
    
    Returns:
        bool: True if message sent successfully
    """
    message_data = {
        "text": text,
        "quick_replies": quick_replies
    }
    return send_message(recipient_id, message_data)


def create_quick_reply(title: str, payload: str, image_url: Optional[str] = None) -> Dict[str, str]:
    """
    Create a quick reply button object
    
    Args:
        title: Button text (max 20 chars)
        payload: Payload to send when clicked (max 1000 chars)
        image_url: Optional icon URL for the button
    
    Returns:
        dict: Quick reply object
    """
    quick_reply = {
        "content_type": "text",
        "title": title[:20],  # Ensure max 20 characters
        "payload": payload[:1000]  # Ensure max 1000 characters
    }
    
    if image_url:
        quick_reply["image_url"] = image_url
    
    return quick_reply


def send_main_menu(recipient_id: str) -> bool:
    """
    Send the main task management menu with quick replies
    Based on the Easely app specification
    
    Args:
        recipient_id: Facebook user ID
    
    Returns:
        bool: True if menu sent successfully
    """
    text = "Welcome to Easely! What would you like to do?"
    
    quick_replies = [
        create_quick_reply("Due Today", "GET_TASKS_TODAY"),
        create_quick_reply("This Week", "GET_TASKS_WEEK"),
        create_quick_reply("Overdue", "GET_TASKS_OVERDUE"),
        create_quick_reply("Upcoming", "GET_TASKS_ALL"),
        create_quick_reply("Add Task", "ADD_NEW_TASK")
    ]
    
    return send_quick_replies(recipient_id, text, quick_replies)


# Persistent Menu Setup Functions

def setup_persistent_menu() -> bool:
    """
    Set up the persistent menu (burger menu) for the Facebook Page
    This should be called once during bot setup
    
    Returns:
        bool: True if persistent menu was set successfully
    """
    try:
        url = f"{GRAPH_API_URL}/me/messenger_profile"
        
        persistent_menu = {
            "persistent_menu": [
                {
                    "locale": "default",
                    "composer_input_disabled": False,
                    "call_to_actions": [
                        {
                            "title": "My Tasks",
                            "type": "postback",
                            "payload": "MAIN_MENU"
                        },
                        {
                            "title": "Canvas Setup",
                            "type": "postback",
                            "payload": "TOKEN_TUTORIAL"
                        },
                        {
                            "title": "Help & Support",
                            "type": "postback",
                            "payload": "SHOW_HELP"
                        },
                        {
                            "title": "Upgrade to Premium",
                            "type": "web_url",
                            "url": "https://facebook.com/keanlouis30"
                        }
                    ]
                }
            ]
        }
        
        params = {"access_token": PAGE_ACCESS_TOKEN}
        
        response = requests.post(url, json=persistent_menu, params=params)
        
        if response.status_code != 200:
            logger.error(f"Facebook API error: {response.status_code}")
            logger.error(f"Response: {response.text}")
            logger.error(f"Payload sent: {persistent_menu}")
        
        response.raise_for_status()
        
        logger.info("Persistent menu set up successfully")
        return True
        
    except requests.RequestException as e:
        logger.error(f"Failed to set up persistent menu: {str(e)}")
        return False


def setup_get_started_button() -> bool:
    """
    Set up the "Get Started" button for new users
    
    Returns:
        bool: True if get started button was set successfully
    """
    try:
        url = f"{GRAPH_API_URL}/me/messenger_profile"
        
        get_started = {
            "get_started": {
                "payload": "GET_STARTED"
            }
        }
        
        params = {"access_token": PAGE_ACCESS_TOKEN}
        
        response = requests.post(url, json=get_started, params=params)
        response.raise_for_status()
        
        logger.info("Get Started button set up successfully")
        return True
        
    except requests.RequestException as e:
        logger.error(f"Failed to set up Get Started button: {str(e)}")
        return False


def setup_greeting_text() -> bool:
    """
    Set up greeting text for new users
    
    Returns:
        bool: True if greeting text was set successfully
    """
    try:
        url = f"{GRAPH_API_URL}/me/messenger_profile"
        
        greeting = {
            "greeting": [
                {
                    "locale": "default",
                    "text": "Hi {{user_first_name}}! 👋 I'm Easely, your Canvas LMS assistant. I'll help you stay organized with assignments, deadlines, and study planning. Click 'Get Started' to begin! 🎯"
                }
            ]
        }
        
        params = {"access_token": PAGE_ACCESS_TOKEN}
        
        response = requests.post(url, json=greeting, params=params)
        response.raise_for_status()
        
        logger.info("Greeting text set up successfully")
        return True
        
    except requests.RequestException as e:
        logger.error(f"Failed to set up greeting text: {str(e)}")
        return False


def setup_bot_profile() -> bool:
    """
    Set up complete bot profile (persistent menu, get started button, and greeting)
    Call this function once during bot deployment
    
    Returns:
        bool: True if all profile elements were set successfully
    """
    logger.info("Setting up bot profile...")
    
    success_count = 0
    
    if setup_persistent_menu():
        success_count += 1
    
    if setup_get_started_button():
        success_count += 1
    
    if setup_greeting_text():
        success_count += 1
    
    if success_count == 3:
        logger.info("Bot profile setup completed successfully!")
        return True
    else:
        logger.warning(f"Bot profile setup partially completed ({success_count}/3 elements)")
        return False


def send_typing_indicator(recipient_id: str, typing_on_off: str) -> bool:
    """
    Send typing indicator to show bot is processing
    
    Args:
        recipient_id: Facebook user ID
        typing_on_off: "typing_on" or "typing_off"
    
    Returns:
        bool: True if indicator sent successfully
    """
    try:
        url = f"{GRAPH_API_URL}/me/messages"
        
        payload = {
            "recipient": {"id": recipient_id},
            "sender_action": typing_on_off
        }
        
        params = {"access_token": PAGE_ACCESS_TOKEN}
        
        response = requests.post(url, json=payload, params=params)
        response.raise_for_status()
        
        return True
        
    except requests.RequestException as e:
        logger.error(f"Failed to send typing indicator to {recipient_id}: {str(e)}")
        return False


def create_url_button(title: str, url: str) -> Dict[str, str]:
    """
    Create a URL button for button templates
    
    Args:
        title: Button text
        url: URL to open
    
    Returns:
        dict: URL button object
    """
    return {
        "type": "web_url",
        "title": title,
        "url": url
    }


def send_button_template(recipient_id: str, text: str, buttons: List[Dict]) -> bool:
    """
    Send a message with button template
    
    Args:
        recipient_id: Facebook user ID
        text: Main message text
        buttons: List of button objects
    
    Returns:
        bool: True if message sent successfully
    """
    message_data = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "button",
                "text": text,
                "buttons": buttons
            }
        }
    }
    return send_message(recipient_id, message_data)


# Keep backward compatibility
def send_task_menu(recipient_id: str) -> bool:
    """Backward compatibility wrapper"""
    return send_main_menu(recipient_id)


# New Onboarding Flow Functions

def send_privacy_policy_consent(recipient_id: str) -> bool:
    """
    Send the privacy policy consent request - first step of onboarding
    
    Args:
        recipient_id: Facebook user ID
    
    Returns:
        bool: True if message sent successfully
    """
    text = (
        "Hi! I'm Easely, your personal Canvas assistant. 🎨\n\n"
        "I help students stay organized with assignments, deadlines, and study planning."
    )
    
    # First, introduce the bot
    send_text_message(recipient_id, text)
    
    # Send a separate message with features
    features_text = (
        "Here are my features:\n\n"
        "🔥 Free Features:\n"
        "• View tasks due Today/This Week/Overdue\n"
        "• Basic Canvas sync (import assignments)\n"
        "• Add manual tasks (limited)\n"
        "• Reminders and quick actions\n\n"
        "If you choose to upgrade, please message Kean Rosales, or facebook.com/keanlouis30\n\n"
        "💎 Premium Features:\n"
        "• Enhanced reminders (multiple alerts)\n"
        "• Unlimited manual tasks\n"
        "• AI-powered study planning\n"
        "• Weekly digest reports"
    )
    send_text_message(recipient_id, features_text)
    
    # Third message with privacy policy prompt
    privacy_text = "🔒 To get started, please review our Privacy Policy to understand how we protect your data."
    send_text_message(recipient_id, privacy_text)
    
    # Create URL quick reply that opens privacy policy directly
    quick_replies = [
        {
            "content_type": "text",
            "title": "📜 Privacy Policy",
            "payload": "PRIVACY_POLICY_READ"
        },
        create_quick_reply("❌ Not now", "PRIVACY_DECLINE")
    ]
    
    return send_quick_replies(recipient_id, "When you're ready, choose an option:", quick_replies)


def send_privacy_agreement_option(recipient_id: str) -> bool:
    """
    Send the privacy agreement option after user reads policy
    
    Args:
        recipient_id: Facebook user ID
    
    Returns:
        bool: True if message sent successfully
    """
    quick_replies = [
        create_quick_reply("✅ I Agree", "PRIVACY_AGREE"),
        create_quick_reply("❌ I Decline", "PRIVACY_DECLINE")
    ]
    
    text = "Do you agree to our Privacy Policy?"
    return send_quick_replies(recipient_id, text, quick_replies)


def send_terms_consent(recipient_id: str) -> bool:
    """
    Send the terms of use consent request - second step of onboarding
    
    Args:
        recipient_id: Facebook user ID
    
    Returns:
        bool: True if message sent successfully
    """
    text = "Great! Now please review our Terms of Use."
    
    quick_replies = [
        {
            "content_type": "text",
            "title": "⚖️ Terms of Use",
            "payload": "TERMS_READ"
        },
        create_quick_reply("❌ Not now", "TERMS_DECLINE")
    ]
    
    return send_quick_replies(recipient_id, text, quick_replies)


def send_terms_agreement_option(recipient_id: str) -> bool:
    """
    Send the terms agreement option after user reads terms
    
    Args:
        recipient_id: Facebook user ID
    
    Returns:
        bool: True if message sent successfully
    """
    quick_replies = [
        create_quick_reply("✅ I Agree", "TERMS_AGREE"),
        create_quick_reply("❌ I Decline", "TERMS_DECLINE")
    ]
    
    text = "Do you agree to our Terms of Use?"
    return send_quick_replies(recipient_id, text, quick_replies)


def send_final_consent(recipient_id: str) -> bool:
    """
    Send the final consent request - last step of onboarding
    
    Args:
        recipient_id: Facebook user ID
    
    Returns:
        bool: True if message sent successfully
    """
    text = (
        "Perfect! By accepting our Privacy Policy and Terms of Use, "
        "you're giving me permission to help manage your Canvas assignments and send you helpful reminders.\n\n"
        "Ready to connect your Canvas account?"
    )
    
    quick_replies = [
        create_quick_reply("✅ Let's Go!", "FINAL_CONSENT_AGREE"),
        create_quick_reply("❌ Not now", "FINAL_CONSENT_DECLINE")
    ]
    
    return send_quick_replies(recipient_id, text, quick_replies)


def send_canvas_token_request(recipient_id: str) -> bool:
    """
    Send Canvas token request - guides user to input their Canvas token
    
    Args:
        recipient_id: Facebook user ID
    
    Returns:
        bool: True if message sent successfully
    """
    text = (
        "To sync with Canvas, I need your Canvas Access Token. This token allows me to:\n\n"
        "• Import your assignments\n"
        "• Check due dates\n"
        "• Send you reminders\n\n"
        "Your token is kept secure and only used for these purposes."
    )
    
    quick_replies = [
        create_quick_reply("🔑 I know how", "TOKEN_KNOW_HOW"),
        create_quick_reply("🤔 Need help", "TOKEN_NEED_HELP")
    ]
    
    return send_quick_replies(recipient_id, text, quick_replies)


def send_video_url_template(recipient_id: str, video_url: str, title: str = "Video", subtitle: str = "") -> bool:
    """
    Send a video using a URL template (for hosted videos)
    
    Args:
        recipient_id: Facebook user ID
        video_url: URL of the hosted video
        title: Title for the video
        subtitle: Subtitle/description for the video
    
    Returns:
        bool: True if message sent successfully
    """
    message_data = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "media",
                "elements": [
                    {
                        "media_type": "video",
                        "url": video_url,
                        "buttons": [
                            {
                                "type": "postback",
                                "title": "I'm Ready",
                                "payload": "TOKEN_READY"
                            }
                        ]
                    }
                ]
            }
        }
    }
    return send_message(recipient_id, message_data)


def send_video_file(recipient_id: str, file_path: str) -> bool:
    """
    Send a video file directly
    
    Args:
        recipient_id: Facebook user ID
        file_path: Path to the video file
    
    Returns:
        bool: True if video sent successfully
    """
    try:
        import os
        if not os.path.exists(file_path):
            logger.error(f"Video file not found: {file_path}")
            return False
        
        url = f"{GRAPH_API_URL}/me/messages"
        params = {"access_token": PAGE_ACCESS_TOKEN}
        
        with open(file_path, 'rb') as f:
            files = {
                'filedata': (os.path.basename(file_path), f, 'video/mp4')
            }
            data = {
                'recipient': json.dumps({"id": recipient_id}),
                'message': json.dumps({
                    "attachment": {
                        "type": "video",
                        "payload": {"is_reusable": True}
                    }
                })
            }
            
            response = requests.post(url, params=params, data=data, files=files)
            response.raise_for_status()
            
            logger.info(f"Video sent successfully to {recipient_id}")
            return True
            
    except Exception as e:
        logger.error(f"Failed to send video to {recipient_id}: {str(e)}")
        return False


def send_final_consent(recipient_id: str) -> bool:
    """
    Send the final consent request - last step before Canvas setup
    
    Args:
        recipient_id: Facebook user ID
    
    Returns:
        bool: True if message sent successfully
    """
    text = (
        "✅ Excellent! You've accepted both our Privacy Policy and Terms of Use.\n\n"
        "🚀 You're all set to start using Easely! I'm ready to help you manage your Canvas assignments and deadlines.\n\n"
        "Do you consent to proceed with setting up your Canvas integration?"
    )
    
    quick_replies = [
        create_quick_reply("🎯 Let's Go!", "FINAL_CONSENT_AGREE"),
        create_quick_reply("❌ Not Now", "FINAL_CONSENT_DECLINE")
    ]
    
    return send_quick_replies(recipient_id, text, quick_replies)


def send_canvas_token_request(recipient_id: str) -> bool:
    """
    Send Canvas token setup request with options
    
    Args:
        recipient_id: Facebook user ID
    
    Returns:
        bool: True if message sent successfully
    """
    text = (
        "🔗 Great! Now I need to connect to your Canvas account to fetch your assignments.\n\n"
        "I'll need your Canvas Access Token - a secure way to access your Canvas data without storing your password.\n\n"
        "Do you know how to generate a Canvas Access Token?"
    )
    
    quick_replies = [
        create_quick_reply("✅ I Know How", "TOKEN_KNOW_HOW"),
        create_quick_reply("❓ Need Help", "TOKEN_NEED_HELP")
    ]
    
    return send_quick_replies(recipient_id, text, quick_replies)


def send_video_file(recipient_id: str, video_path: str) -> bool:
    """
    Send a video file to the user
    
    Args:
        recipient_id: Facebook user ID
        video_path: Path to video file
    
    Returns:
        bool: True if video sent successfully
    """
    try:
        import os
        if not os.path.exists(video_path):
            logger.error(f"Video file not found: {video_path}")
            send_text_message(
                recipient_id,
                "📹 I have a video tutorial for you, but the video file is currently unavailable. "
                "Please check the written instructions above instead."
            )
            return False
        
        url = f"{GRAPH_API_URL}/me/messages"
        
        # Upload video as attachment
        with open(video_path, 'rb') as video_file:
            files = {
                'filedata': ('video.mp4', video_file, 'video/mp4')
            }
            
            data = {
                'recipient': f'{{"id":"{recipient_id}"}}',
                'message': '{"attachment":{"type":"video", "payload":{"is_reusable":true}}}'
            }
            
            params = {'access_token': PAGE_ACCESS_TOKEN}
            
            response = requests.post(url, data=data, files=files, params=params)
            response.raise_for_status()
            
            logger.info(f"Video sent successfully to {recipient_id}")
            return True
            
    except Exception as e:
        logger.error(f"Failed to send video to {recipient_id}: {str(e)}")
        # Fallback to text message
        send_text_message(
            recipient_id,
            "📹 I have a video tutorial for you, but there was an issue sending it. "
            "Please follow the written instructions provided instead."
        )
        return False


def send_privacy_agreement_option(recipient_id: str) -> bool:
    """
    Send privacy agreement option after user has had time to review policy
    
    Args:
        recipient_id: Facebook user ID
    
    Returns:
        bool: True if message sent successfully
    """
    quick_replies = [
        create_quick_reply("✅ I Agree", "PRIVACY_AGREE"),
        create_quick_reply("❌ No Thanks", "PRIVACY_DECLINE")
    ]
    
    return send_quick_replies(
        recipient_id,
        "🔒 Have you reviewed our Privacy Policy? Do you agree to proceed?",
        quick_replies
    )


def send_terms_agreement_option(recipient_id: str) -> bool:
    """
    Send terms agreement option after user has had time to review terms
    
    Args:
        recipient_id: Facebook user ID
    
    Returns:
        bool: True if message sent successfully
    """
    quick_replies = [
        create_quick_reply("✅ I Agree", "TERMS_AGREE"),
        create_quick_reply("❌ No Thanks", "TERMS_DECLINE")
    ]
    
    return send_quick_replies(
        recipient_id,
        "⚖️ Have you reviewed our Terms of Use? Do you agree to proceed?",
        quick_replies
    )


def send_terms_consent(recipient_id: str) -> bool:
    """
    Send the terms of use consent request - second step of onboarding
    
    Args:
        recipient_id: Facebook user ID
    
    Returns:
        bool: True if message sent successfully
    """
    text = (
        "✅ Great! You've agreed to our Privacy Policy.\n\n"
        "Now, please review our Terms of Use, which outline how to use Easely responsibly."
    )
    
    quick_replies = [
        {
            "content_type": "text",
            "title": "⚖️ Terms of Use",
            "payload": "TERMS_READ"
        },
        create_quick_reply("❌ Not now", "TERMS_DECLINE")
    ]
    
    return send_quick_replies(recipient_id, text, quick_replies)


def send_final_consent(recipient_id: str) -> bool:
    """
    Send the final consent confirmation - third step of onboarding
    
    Args:
        recipient_id: Facebook user ID
    
    Returns:
        bool: True if message sent successfully
    """
    text = (
        "✅ Excellent! You've reviewed our Terms of Use.\n\n"
        "🤝 By proceeding, you confirm that you:\n"
        "• Agree to our Privacy Policy\n"
        "• Accept our Terms of Use\n"
        "• Consent to Easely accessing your Canvas data\n\n"
        "Ready to get started?"
    )
    
    quick_replies = [
        create_quick_reply("✅ Yes, let's go!", "FINAL_CONSENT_AGREE"),
        create_quick_reply("❌ No, not now", "FINAL_CONSENT_DECLINE")
    ]
    
    return send_quick_replies(recipient_id, text, quick_replies)


def send_canvas_token_request(recipient_id: str) -> bool:
    """
    Ask user about Canvas token knowledge - start of Canvas setup
    
    Args:
        recipient_id: Facebook user ID
    
    Returns:
        bool: True if message sent successfully
    """
    text = (
        "🎨 Canvas Setup\n\n"
        "To sync your assignments and deadlines, I need your Canvas Access Token. \n\n"
        "Do you know how to generate a Canvas Access Token?"
    )
    
    quick_replies = [
        create_quick_reply("✅ Yes, I know how", "TOKEN_KNOW_HOW"),
        create_quick_reply("❓ No, I need help", "TOKEN_NEED_HELP")
    ]
    
    return send_quick_replies(recipient_id, text, quick_replies)


def send_video_file(recipient_id: str, video_path: str) -> bool:
    """
    Send a video file to the user via Facebook Messenger
    
    Args:
        recipient_id: Facebook user ID
        video_path: Absolute path to the video file
    
    Returns:
        bool: True if video sent successfully
    """
    try:
        import os
        
        # Check if video file exists
        if not os.path.exists(video_path):
            logger.error(f"Video file not found: {video_path}")
            return send_text_message(recipient_id, 
                "📺 Video tutorial temporarily unavailable. Please follow the written instructions above.")
        
        url = f"{GRAPH_API_URL}/me/messages"
        
        # Upload video file directly to Facebook
        with open(video_path, 'rb') as video_file:
            files = {
                'filedata': (os.path.basename(video_path), video_file, 'video/x-matroska' if video_path.endswith('.mkv') else 'video/mp4')
            }
            
            data = {
                'recipient': '{"id":"' + recipient_id + '"}',
                'message': '{ "attachment": { "type": "video", "payload": {} } }'
            }
            
            params = {"access_token": PAGE_ACCESS_TOKEN}
            
            response = requests.post(url, data=data, files=files, params=params)
            
            if response.status_code == 200:
                logger.info(f"Video sent successfully to {recipient_id}")
                return True
            else:
                logger.error(f"Failed to send video: {response.status_code} - {response.text}")
                # Fallback to instructions
                return send_video_fallback_message(recipient_id)
                
    except Exception as e:
        logger.error(f"Error sending video file: {str(e)}")
        return send_video_fallback_message(recipient_id)


def send_video_fallback_message(recipient_id: str) -> bool:
    """
    Send fallback message when video upload fails
    
    Args:
        recipient_id: Facebook user ID
    
    Returns:
        bool: True if fallback message sent successfully
    """
    fallback_text = (
        "🎥 Video Tutorial\n\n"
        "I have a step-by-step video tutorial, but I'm having trouble sending it right now. \n\n"
        "📝 Don't worry! The written instructions above are comprehensive and will guide you through the exact same steps. \n\n"
        "👍 Follow the 8-step process I shared, and you'll have your Canvas token ready in no time!"
    )
    return send_text_message(recipient_id, fallback_text)


def send_video_url_template(recipient_id: str, video_url: str, title: str = None, subtitle: str = None, thumbnail_url: str = None) -> bool:
    """
    Send a video using generic template with URL (works with hosted videos)
    
    Args:
        recipient_id: Facebook user ID
        video_url: URL to the video (must be HTTPS)
        title: Optional title for the video
        subtitle: Optional subtitle/description
        thumbnail_url: Optional thumbnail image URL
    
    Returns:
        bool: True if message sent successfully
    """
    message_data = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "generic",
                "elements": [{
                    "title": title or "Canvas Token Tutorial",
                    "subtitle": subtitle or "Click to watch the step-by-step video guide",
                    "image_url": thumbnail_url or "https://via.placeholder.com/1280x720/4267B2/ffffff?text=Video+Tutorial",
                    "default_action": {
                        "type": "web_url",
                        "url": video_url,
                        "webview_height_ratio": "tall"
                    },
                    "buttons": [{
                        "type": "web_url",
                        "url": video_url,
                        "title": "▶️ Watch Video"
                    }]
                }]
            }
        }
    }
    return send_message(recipient_id, message_data)


def send_video_attachment_url(recipient_id: str, video_url: str) -> bool:
    """
    Send video as direct attachment from URL (requires MP4 format)
    
    Args:
        recipient_id: Facebook user ID
        video_url: Direct URL to MP4 video file (must be HTTPS)
    
    Returns:
        bool: True if sent successfully
    """
    message_data = {
        "attachment": {
            "type": "video",
            "payload": {
                "url": video_url,
                "is_reusable": True
            }
        }
    }
    return send_message(recipient_id, message_data)


# Keep old function for backward compatibility
def send_token_request(recipient_id: str) -> bool:
    """Backward compatibility wrapper for Canvas token request"""
    return send_canvas_token_request(recipient_id)


def send_button_template(
    recipient_id: str,
    text: str,
    buttons: List[Dict[str, Any]]
) -> bool:
    """
    Send a message with button template
    
    Args:
        recipient_id: Facebook user ID
        text: Message text
        buttons: List of button objects
    
    Returns:
        bool: True if message sent successfully
    """
    message_data = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "button",
                "text": text,
                "buttons": buttons
            }
        }
    }
    return send_message(recipient_id, message_data)


def create_postback_button(title: str, payload: str) -> Dict[str, str]:
    """
    Create a postback button
    
    Args:
        title: Button text
        payload: Payload to send when clicked
    
    Returns:
        dict: Button object
    """
    return {
        "type": "postback",
        "title": title,
        "payload": payload
    }


def create_url_button(title: str, url: str) -> Dict[str, str]:
    """
    Create a URL button
    
    Args:
        title: Button text
        url: URL to open when clicked
    
    Returns:
        dict: Button object
    """
    return {
        "type": "web_url",
        "title": title,
        "url": url
    }


def send_typing_indicator(recipient_id: str, action: str = "typing_on") -> bool:
    """
    Send typing indicator to show bot is processing
    
    Args:
        recipient_id: Facebook user ID
        action: Either 'typing_on' or 'typing_off'
    
    Returns:
        bool: True if indicator sent successfully
    """
    try:
        url = f"{GRAPH_API_URL}/me/messages"
        
        payload = {
            "recipient": {"id": recipient_id},
            "sender_action": action
        }
        
        params = {"access_token": PAGE_ACCESS_TOKEN}
        
        response = requests.post(url, json=payload, params=params)
        response.raise_for_status()
        
        return True
        
    except requests.RequestException as e:
        logger.error(f"Failed to send typing indicator: {str(e)}")
        return False


def send_task_list(recipient_id: str, tasks: List[Dict[str, Any]], header: str) -> bool:
    """
    Send a formatted list of tasks
    
    Args:
        recipient_id: Facebook user ID
        tasks: List of task dictionaries
        header: Header text for the task list
    
    Returns:
        bool: True if message sent successfully
    """
    if not tasks:
        return send_text_message(recipient_id, f"{header}\\n\\n✨ No tasks found!")
    
    # Format tasks into a readable message
    message = f"{header}\\n\\n"
    
    for task in tasks[:10]:  # Limit to 10 tasks per message to avoid hitting limits
        title = task.get('title', 'Untitled Task')
        due_date = task.get('due_date', 'No due date')
        course = task.get('course', 'Personal')
        
        message += f"📚 {title}\\n"
        message += f"   Course: {course}\\n"
        message += f"   Due: {due_date}\\n\\n"
    
    if len(tasks) > 10:
        message += f"... and {len(tasks) - 10} more tasks"
    
    return send_text_message(recipient_id, message)


def send_date_picker(recipient_id: str) -> bool:
    """
    Send date selection quick replies for task creation
    
    Args:
        recipient_id: Facebook user ID
    
    Returns:
        bool: True if message sent successfully
    """
    text = "What day is this task for?"
    
    quick_replies = [
        create_quick_reply("Today", "DATE_TODAY"),
        create_quick_reply("Tomorrow", "DATE_TOMORROW"),
        create_quick_reply("Next Week", "DATE_NEXT_WEEK"),
        create_quick_reply("Choose Date...", "DATE_CUSTOM")
    ]
    
    return send_quick_replies(recipient_id, text, quick_replies)


def send_time_picker(recipient_id: str) -> bool:
    """
    Send time selection quick replies for task creation
    
    Args:
        recipient_id: Facebook user ID
    
    Returns:
        bool: True if message sent successfully
    """
    text = "What time is the deadline? You can select a preset or type a specific time (e.g., '2:30 PM')"
    
    quick_replies = [
        create_quick_reply("9:00 AM", "TIME_09_00"),
        create_quick_reply("12:00 PM", "TIME_12_00"),
        create_quick_reply("3:00 PM", "TIME_15_00"),
        create_quick_reply("5:00 PM", "TIME_17_00"),
        create_quick_reply("11:59 PM", "TIME_23_59")
    ]
    
    return send_quick_replies(recipient_id, text, quick_replies)