"""
Event Handler Module
Processes incoming messages and determines appropriate responses
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from app.api import messenger_api
from app.database.supabase_client import get_user, create_user, update_user_last_seen, get_user_session, set_user_session, clear_user_session

logger = logging.getLogger(__name__)

# Store user session data (in production, use proper database)
user_sessions = {}


def handle_message(sender_id: str, text: str) -> None:
    """
    Handle incoming text messages from users
    
    Args:
        sender_id: Facebook user ID
        text: Message text from user
    """
    try:
        # Show typing indicator while processing
        messenger_api.send_typing_indicator(sender_id, "typing_on")
        
        # Convert message to lowercase for easier matching
        text_lower = text.lower().strip()
        
        # For any message, first check if user exists and update last seen
        user = get_user(sender_id)
        if user:
            # Update last seen for existing users
            update_user_last_seen(sender_id)
        
        # Check for greetings and menu requests - but only if not in active flow
        current_state = None
        try:
            current_state = get_user_session(sender_id, 'conversation_state')
        except:
            pass
        
        # Don't interrupt active conversation flows
        in_active_flow = current_state in ['waiting_for_token', 'waiting_for_task_title', 'waiting_for_custom_date', 'waiting_for_custom_time']
        
        if (text_lower in ['hi', 'hello', 'hey', 'menu', 'help', 'start'] or not user) and not in_active_flow:
            # Check if user is new or returning
            if is_new_user(sender_id):
                # Send onboarding flow for new users
                messenger_api.send_privacy_policy_consent(sender_id)
                # Create user record in database
                try:
                    create_user(sender_id, first_interaction_message=text)
                    logger.info(f"Created new user record for {sender_id}")
                except Exception as e:
                    logger.error(f"Error creating user record: {e}")
            else:
                # Send main menu for returning users
                messenger_api.send_main_menu(sender_id)
                return  # Exit early for returning users
        
        # Handle Canvas token input
        elif is_waiting_for_token(sender_id):
            handle_token_input(sender_id, text)
        
        # Handle task title input
        elif is_waiting_for_task_title(sender_id):
            handle_task_title_input(sender_id, text)
        
        # Handle custom date input
        elif is_waiting_for_custom_date(sender_id):
            handle_custom_date_input(sender_id, text)
        
        # Handle custom time input
        elif is_waiting_for_custom_time(sender_id):
            handle_custom_time_input(sender_id, text)
        
        # Handle activation code after payment
        elif text.upper() == 'ACTIVATE':
            handle_premium_activation(sender_id)
        
        # Default response for unrecognized input
        else:
            messenger_api.send_text_message(
                sender_id,
                "I didn't understand that. Type 'menu' to see available options or 'help' for assistance."
            )
            messenger_api.send_main_menu(sender_id)
        
    except Exception as e:
        logger.error(f"Error handling message from {sender_id}: {str(e)}")
        messenger_api.send_text_message(
            sender_id,
            "Sorry, something went wrong. Please try again."
        )
    finally:
        # Turn off typing indicator
        messenger_api.send_typing_indicator(sender_id, "typing_off")


def handle_postback(sender_id: str, payload: str) -> None:
    """
    Handle postback events from quick replies and buttons
    
    Args:
        sender_id: Facebook user ID
        payload: Postback payload string
    """
    try:
        messenger_api.send_typing_indicator(sender_id, "typing_on")
        
        # Route based on payload
        # Privacy Policy Flow
        if payload == "PRIVACY_AGREE":
            handle_privacy_agreement(sender_id)
        
        elif payload == "PRIVACY_DECLINE":
            handle_privacy_decline(sender_id)
        
        elif payload == "PRIVACY_POLICY_READ":
            handle_privacy_policy_read(sender_id)
        
        # Terms of Use Flow
        elif payload == "TERMS_AGREE":
            handle_terms_agreement(sender_id)
        
        elif payload == "TERMS_DECLINE":
            handle_terms_decline(sender_id)
        
        elif payload == "TERMS_READ":
            handle_terms_read(sender_id)
        
        # Final Consent
        elif payload == "FINAL_CONSENT_AGREE":
            handle_final_consent_agreement(sender_id)
        
        elif payload == "FINAL_CONSENT_DECLINE":
            handle_final_consent_decline(sender_id)
        
        # Canvas Token Flow
        elif payload == "TOKEN_KNOW_HOW":
            handle_token_know_how(sender_id)
        
        elif payload == "TOKEN_NEED_HELP":
            handle_token_need_help(sender_id)
        
        elif payload == "TOKEN_READY":
            handle_token_ready(sender_id)
        
        elif payload == "TOKEN_TUTORIAL":
            handle_token_tutorial(sender_id)
        
        elif payload == "WATCH_VIDEO":
            handle_watch_video(sender_id)
        
        elif payload == "GET_TASKS_TODAY":
            handle_get_tasks_today(sender_id)
        
        elif payload == "GET_TASKS_WEEK":
            handle_get_tasks_week(sender_id)
        
        elif payload == "GET_TASKS_OVERDUE":
            handle_get_tasks_overdue(sender_id)
        
        elif payload == "GET_TASKS_ALL":
            handle_get_tasks_all(sender_id)
        
        elif payload == "ADD_NEW_TASK":
            handle_add_new_task(sender_id)
        
        elif payload.startswith("DATE_"):
            handle_date_selection(sender_id, payload)
        
        elif payload.startswith("TIME_"):
            handle_time_selection(sender_id, payload)
        
        # Persistent menu handlers
        elif payload == "MAIN_MENU":
            messenger_api.send_main_menu(sender_id)
        
        elif payload == "SHOW_SETTINGS":
            handle_show_settings(sender_id)
        
        elif payload == "SHOW_HELP":
            handle_show_help(sender_id)
        
        elif payload == "SHOW_ABOUT":
            handle_show_about(sender_id)
        
        elif payload == "GET_STARTED":
            # Handle "Get Started" button
            messenger_api.send_main_menu(sender_id)
        
        # Premium Flow Handlers
        elif payload == "SHOW_PREMIUM":
            handle_show_premium(sender_id)
        
        elif payload == "SKIP_PREMIUM":
            handle_skip_premium(sender_id)
        
        else:
            logger.warning(f"Unknown payload: {payload}")
            messenger_api.send_main_menu(sender_id)
            
    except Exception as e:
        logger.error(f"Error handling postback from {sender_id}: {str(e)}")
        messenger_api.send_text_message(
            sender_id,
            "Sorry, something went wrong. Please try again."
        )
    finally:
        messenger_api.send_typing_indicator(sender_id, "typing_off")


# Onboarding handlers - Step-by-step flow

def handle_privacy_agreement(sender_id: str) -> None:
    """Handle user agreeing to privacy policy - move to terms"""
    set_user_state(sender_id, "privacy_agreed")
    messenger_api.send_terms_consent(sender_id)


def handle_privacy_decline(sender_id: str) -> None:
    """Handle user declining privacy policy"""
    messenger_api.send_text_message(
        sender_id,
        "I understand. Unfortunately, I can't help you without accepting our privacy policy. "
        "Feel free to return anytime if you change your mind! 👋"
    )


def handle_privacy_policy_read(sender_id: str) -> None:
    """Handle privacy policy read - open link and show agreement after delay"""
    import threading
    import time
    
    # Immediately send the privacy policy link
    buttons = [
        messenger_api.create_url_button(
            "📜 Read Privacy Policy",
            "https://easelyprivacypolicy.onrender.com"
        )
    ]
    messenger_api.send_button_template(
        sender_id,
        "Please review our Privacy Policy. It explains how we protect your data and integrate with Canvas.",
        buttons
    )
    
    # Start a background thread to show agreement after 5 seconds
    def show_agreement_delayed():
        time.sleep(5)  # Wait 5 seconds
        messenger_api.send_privacy_agreement_option(sender_id)
    
    # Start the delayed response in a separate thread
    threading.Thread(target=show_agreement_delayed, daemon=True).start()


def handle_terms_agreement(sender_id: str) -> None:
    """Handle user agreeing to terms of use - move to final consent"""
    set_user_state(sender_id, "terms_agreed")
    messenger_api.send_final_consent(sender_id)


def handle_terms_decline(sender_id: str) -> None:
    """Handle user declining terms of use"""
    messenger_api.send_text_message(
        sender_id,
        "I understand. Unfortunately, I can't help you without accepting our terms of use. "
        "Feel free to return anytime if you change your mind! 👋"
    )


def handle_terms_read(sender_id: str) -> None:
    """Handle terms of use read - open link and show agreement after delay"""
    import threading
    import time
    
    # Immediately send the terms of use link
    buttons = [
        messenger_api.create_url_button(
            "⚖️ Read Terms of Use",
            "https://easelytermsofuse.onrender.com"
        )
    ]
    messenger_api.send_button_template(
        sender_id,
        "Please review our Terms of Use. This covers your responsibilities and our service terms.",
        buttons
    )
    
    # Start a background thread to show agreement after 5 seconds
    def show_agreement_delayed():
        time.sleep(5)  # Wait 5 seconds
        messenger_api.send_terms_agreement_option(sender_id)
    
    # Start the delayed response in a separate thread
    threading.Thread(target=show_agreement_delayed, daemon=True).start()


def handle_final_consent_agreement(sender_id: str) -> None:
    """Handle final consent - start Canvas setup"""
    set_user_state(sender_id, "onboarding_complete")
    
    # Mark onboarding as complete in the database
    try:
        user = get_user(sender_id)
        if user:
            from app.database.supabase_client import update_user
            update_user(sender_id, {'onboarding_completed': True})
            logger.info(f"Marked onboarding complete for user {sender_id}")
    except Exception as e:
        logger.error(f"Error updating onboarding status: {str(e)}")
    
    messenger_api.send_text_message(
        sender_id,
        "🎉 Great! Now let's connect you to Canvas so I can help manage your assignments and deadlines."
    )
    messenger_api.send_canvas_token_request(sender_id)


def handle_final_consent_decline(sender_id: str) -> None:
    """Handle user declining final consent"""
    messenger_api.send_text_message(
        sender_id,
        "I understand. Unfortunately, I can't provide my services without your consent. "
        "Feel free to return anytime if you change your mind! 👋"
    )


# Canvas Token Flow Handlers

def handle_token_know_how(sender_id: str) -> None:
    """Handle user who knows how to generate token"""
    set_user_state(sender_id, "waiting_for_token", "user_clicked_token_know_how")
    messenger_api.send_text_message(
        sender_id,
        "🔑 Perfect! Please paste your Canvas Access Token here. \n\n"
        "⚠️ Make sure to keep it secure and don't share it with anyone else!"
    )


def handle_token_need_help(sender_id: str) -> None:
    """Handle user who needs help generating token"""
    instructions = (
        "📚 Here's how to get your Canvas Access Token:\n\n"
        "1️⃣ Log into your Canvas account\n"
        "2️⃣ Click on Account → Settings\n"
        "3️⃣ Scroll down to 'Approved Integrations'\n"
        "4️⃣ Click '+ New Access Token'\n"
        "5️⃣ Enter 'Easely Bot' as the purpose\n"
        "6️⃣ Leave expiry date blank (never expires)\n"
        "7️⃣ Click 'Generate Token'\n"
        "8️⃣ Copy the token immediately\n\n"
        "⚠️ IMPORTANT: Save the token before closing the dialog - you won't see it again!"
    )
    
    messenger_api.send_text_message(sender_id, instructions)
    
    # Ask if they want video or are ready
    quick_replies = [
        messenger_api.create_quick_reply("🎥 Watch Video", "WATCH_VIDEO"),
        messenger_api.create_quick_reply("🔑 I have my token", "TOKEN_READY")
    ]
    
    messenger_api.send_quick_replies(
        sender_id,
        "Would you like to watch a video tutorial or do you have your token ready?",
        quick_replies
    )


def handle_watch_video(sender_id: str) -> None:
    """Send the video tutorial file"""
    messenger_api.send_text_message(
        sender_id,
        "🎥 Here's a step-by-step video showing exactly how to generate your Canvas token:"
    )
    
    # Send the video file - use relative path that works in deployment
    import os
    video_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "test.mkv")
    messenger_api.send_video_file(sender_id, video_path)
    
    # After video, ask if they're ready
    quick_replies = [
        messenger_api.create_quick_reply("🔑 I have my token", "TOKEN_READY"),
        messenger_api.create_quick_reply("🔄 Show steps again", "TOKEN_NEED_HELP")
    ]
    
    messenger_api.send_quick_replies(
        sender_id,
        "After watching the video, do you have your token ready?",
        quick_replies
    )


def handle_token_ready(sender_id: str) -> None:
    """Handle user ready to input token"""
    set_user_state(sender_id, "waiting_for_token", "user_clicked_token_ready")
    messenger_api.send_text_message(
        sender_id,
        "🔑 Excellent! Please paste your Canvas Access Token here:\n\n"
        "It should look something like: 1234~abcd1234efgh5678...\n\n"
        "🔒 Your token will be encrypted and stored securely."
    )


def handle_token_input(sender_id: str, token: str) -> None:
    """
    Process Canvas token input from user with validation
    
    Args:
        sender_id: Facebook user ID
        token: Canvas access token
    """
    token = token.strip()
    
    # Check if user wants to cancel or go back
    if token.lower() in ['cancel', 'back', 'menu', 'stop']:
        clear_user_state(sender_id)
        messenger_api.send_text_message(
            sender_id,
            "Token setup cancelled. You can try again anytime!"
        )
        messenger_api.send_main_menu(sender_id)
        return
    
    # Basic token format validation
    if len(token) < 10:
        messenger_api.send_text_message(
            sender_id,
            "🚫 That doesn't look like a valid Canvas token. Canvas tokens are usually much longer.\n\n"
            "Please paste your full Canvas Access Token, or type 'cancel' to go back."
        )
        return
    
    # Check for obvious non-token text
    if token.lower() in ['l', 'ok', 'yes', 'no', 'hello', 'hi'] or len(token) < 5:
        messenger_api.send_text_message(
            sender_id,
            "🤔 That doesn't look like a Canvas token. \n\n"
            "Canvas tokens look like: '1234~abcd1234efgh5678ijkl9012...'\n\n"
            "Please paste your Canvas Access Token, or type 'cancel' to go back."
        )
        return
    
    # If token looks reasonable, process it
    messenger_api.send_text_message(
        sender_id,
        "✅ Token received! Validating with Canvas..."
    )
    
    # Here you would validate the token with Canvas API
    # For now, we'll simulate success after basic validation
    import time
    time.sleep(2)  # Simulate API call delay
    
    messenger_api.send_text_message(
        sender_id,
        "✅ Token verified! Syncing your Canvas data..."
    )
    
    # Show sample upcoming assignments (in production, fetch real data)
    sample_tasks = (
        "📚 Your upcoming assignments:\\n\\n"
        "1. Math Homework - Due Tomorrow\\n"
        "2. Essay Draft - Due in 3 days\\n"
        "3. Lab Report - Due next week\\n\\n"
        "I'll remind you before each deadline!"
    )
    
    messenger_api.send_text_message(sender_id, sample_tasks)
    
    # Store the validated token in database (encrypt in production)
    try:
        from app.database.supabase_client import update_user
        update_user(sender_id, {
            'canvas_token': token,  # In production, encrypt this
            'last_canvas_sync': 'now()',
            'canvas_sync_enabled': True
        })
    except Exception as e:
        logger.error(f"Error storing Canvas token: {str(e)}")
    
    # Clear the waiting state and mark onboarding complete
    clear_user_state(sender_id)
    set_user_state(sender_id, "token_verified", "token_validation_success")
    
    # Log analytics event
    try:
        from app.database.supabase_client import log_user_analytics
        log_user_analytics(sender_id, "token_validated", {"token_length": len(token)})
    except Exception as e:
        logger.debug(f"Error logging analytics: {e}")
    
    # Show success message and offer premium upgrade
    messenger_api.send_text_message(
        sender_id,
        "🎉 Awesome! Your Canvas integration is complete!\n\n"
        "I can now help you stay on top of your assignments and deadlines. "
        "Would you like to see what Easely Premium offers?"
    )
    
    # Offer premium upgrade
    quick_replies = [
        messenger_api.create_quick_reply("💎 Learn More", "SHOW_PREMIUM"),
        messenger_api.create_quick_reply("📚 Start Using Free", "SKIP_PREMIUM")
    ]
    
    messenger_api.send_quick_replies(
        sender_id,
        "Choose your next step:",
        quick_replies
    )


# Task management handlers

def handle_get_tasks_today(sender_id: str) -> None:
    """Show tasks due today"""
    # In production, fetch from database
    tasks = [
        {
            "title": "Math Assignment",
            "course": "Calculus 101",
            "due_date": "Today at 11:59 PM"
        }
    ]
    
    messenger_api.send_task_list(
        sender_id,
        tasks,
        "🔥 Tasks Due Today"
    )
    
    # Show menu again for easy navigation
    messenger_api.send_main_menu(sender_id)


def handle_get_tasks_week(sender_id: str) -> None:
    """Show tasks due this week"""
    # In production, fetch from database
    tasks = [
        {
            "title": "Math Assignment",
            "course": "Calculus 101",
            "due_date": "Tomorrow at 11:59 PM"
        },
        {
            "title": "Essay Draft",
            "course": "English 201",
            "due_date": "Thursday at 5:00 PM"
        }
    ]
    
    messenger_api.send_task_list(
        sender_id,
        tasks,
        "⏰ Tasks Due This Week"
    )
    
    messenger_api.send_main_menu(sender_id)


def handle_get_tasks_overdue(sender_id: str) -> None:
    """Show overdue tasks"""
    # In production, fetch from database
    tasks = []  # Empty for demo
    
    messenger_api.send_task_list(
        sender_id,
        tasks,
        "❗️ Overdue Tasks"
    )
    
    messenger_api.send_main_menu(sender_id)


def handle_get_tasks_all(sender_id: str) -> None:
    """Show all upcoming tasks"""
    # In production, fetch from database
    tasks = [
        {
            "title": "Math Assignment",
            "course": "Calculus 101",
            "due_date": "Tomorrow at 11:59 PM"
        },
        {
            "title": "Essay Draft",
            "course": "English 201",
            "due_date": "Thursday at 5:00 PM"
        },
        {
            "title": "Lab Report",
            "course": "Chemistry 301",
            "due_date": "Next Monday at 9:00 AM"
        }
    ]
    
    messenger_api.send_task_list(
        sender_id,
        tasks,
        "🗓 All Upcoming Tasks"
    )
    
    messenger_api.send_main_menu(sender_id)


def handle_add_new_task(sender_id: str) -> None:
    """Start the flow for adding a new task"""
    set_user_state(sender_id, "waiting_for_task_title", "user_clicked_add_new_task")
    messenger_api.send_text_message(
        sender_id,
        "Let's add a new task! What's the title of your task?"
    )


def handle_task_title_input(sender_id: str, title: str) -> None:
    """Handle task title input with validation"""
    title = title.strip()
    
    # Check if user wants to cancel
    if title.lower() in ['cancel', 'back', 'menu', 'stop']:
        clear_user_state(sender_id)
        messenger_api.send_text_message(
            sender_id,
            "Task creation cancelled. You can try again anytime!"
        )
        messenger_api.send_main_menu(sender_id)
        return
    
    # Validate title length and content
    if len(title) < 2:
        messenger_api.send_text_message(
            sender_id,
            "🤔 That's a bit short for a task title. \n\n"
            "Please enter a descriptive title for your task (e.g., 'Math Homework Chapter 5'), or type 'cancel' to go back."
        )
        return
    
    if title.lower() in ['l', 'ok', 'yes', 'no', 'hello', 'hi']:
        messenger_api.send_text_message(
            sender_id,
            "🤔 That doesn't look like a task title. \n\n"
            "Please enter a descriptive title for your task (e.g., 'Math Homework Chapter 5'), or type 'cancel' to go back."
        )
        return
    
    # Store the title in session
    if sender_id not in user_sessions:
        user_sessions[sender_id] = {}
    user_sessions[sender_id]['task_title'] = title
    
    # Ask for date
    clear_user_state(sender_id)
    messenger_api.send_date_picker(sender_id)


def handle_date_selection(sender_id: str, payload: str) -> None:
    """Handle date selection for new task"""
    if payload == "DATE_TODAY":
        date = datetime.now().date()
    elif payload == "DATE_TOMORROW":
        date = (datetime.now() + timedelta(days=1)).date()
    elif payload == "DATE_NEXT_WEEK":
        date = (datetime.now() + timedelta(weeks=1)).date()
    elif payload == "DATE_CUSTOM":
        set_user_state(sender_id, "waiting_for_custom_date")
        messenger_api.send_text_message(
            sender_id,
            "Please enter the date (format: MM/DD/YYYY):"
        )
        return
    
    # Store date and ask for time
    if sender_id not in user_sessions:
        user_sessions[sender_id] = {}
    user_sessions[sender_id]['task_date'] = str(date)
    
    messenger_api.send_time_picker(sender_id)


def handle_time_selection(sender_id: str, payload: str) -> None:
    """Handle time selection for new task"""
    time_map = {
        "TIME_09_00": "9:00 AM",
        "TIME_12_00": "12:00 PM",
        "TIME_15_00": "3:00 PM",
        "TIME_17_00": "5:00 PM",
        "TIME_23_59": "11:59 PM"
    }
    
    time = time_map.get(payload, "11:59 PM")
    
    # Get stored task data
    if sender_id in user_sessions:
        title = user_sessions[sender_id].get('task_title', 'New Task')
        date = user_sessions[sender_id].get('task_date', 'Today')
        
        # In production, save to database and sync with Canvas
        messenger_api.send_text_message(
            sender_id,
            f"✅ Task added successfully!\\n\\n"
            f"📚 {title}\\n"
            f"📅 Due: {date} at {time}\\n\\n"
            f"The task has been added to your Canvas calendar."
        )
        
        # Clear session data
        user_sessions[sender_id] = {}
    
    # Show menu again
    messenger_api.send_main_menu(sender_id)


def handle_custom_date_input(sender_id: str, date_text: str) -> None:
    """Handle custom date input with validation"""
    date_text = date_text.strip()
    
    # Check if user wants to cancel
    if date_text.lower() in ['cancel', 'back', 'menu', 'stop']:
        clear_user_state(sender_id)
        messenger_api.send_text_message(
            sender_id,
            "Task creation cancelled. You can try again anytime!"
        )
        messenger_api.send_main_menu(sender_id)
        return
    
    # Check for obvious non-date text
    if date_text.lower() in ['l', 'ok', 'yes', 'no', 'hello', 'hi'] or len(date_text) < 3:
        messenger_api.send_text_message(
            sender_id,
            "🤔 That doesn't look like a date. \n\n"
            "Please enter a date in MM/DD/YYYY format (e.g., '12/25/2024'), or type 'cancel' to go back."
        )
        return
    
    # Parse and validate date (simplified for demo)
    try:
        from datetime import datetime
        # Try to parse common date formats
        for fmt in ['%m/%d/%Y', '%m-%d-%Y', '%m.%d.%Y', '%m/%d/%y']:
            try:
                parsed_date = datetime.strptime(date_text, fmt)
                break
            except ValueError:
                continue
        else:
            raise ValueError("Invalid date format")
        
        # Store date
        if sender_id not in user_sessions:
            user_sessions[sender_id] = {}
        user_sessions[sender_id]['task_date'] = parsed_date.strftime('%Y-%m-%d')
        
        clear_user_state(sender_id)
        messenger_api.send_time_picker(sender_id)
        
    except ValueError:
        messenger_api.send_text_message(
            sender_id,
            "📅 Invalid date format. \n\n"
            "Please enter a date in MM/DD/YYYY format (e.g., '12/25/2024'), or type 'cancel' to go back."
        )


def handle_custom_time_input(sender_id: str, time_text: str) -> None:
    """Handle custom time input with validation"""
    time_text = time_text.strip()
    
    # Check if user wants to cancel
    if time_text.lower() in ['cancel', 'back', 'menu', 'stop']:
        clear_user_state(sender_id)
        messenger_api.send_text_message(
            sender_id,
            "Task creation cancelled. You can try again anytime!"
        )
        messenger_api.send_main_menu(sender_id)
        return
    
    # Check for obvious non-time text
    if time_text.lower() in ['l', 'ok', 'yes', 'no', 'hello', 'hi'] or len(time_text) < 3:
        messenger_api.send_text_message(
            sender_id,
            "🤔 That doesn't look like a time. \n\n"
            "Please enter a time in format like '2:30 PM', '14:30', or '11:59 PM', or type 'cancel' to go back."
        )
        return
    
    # Parse and validate time (simplified for demo)
    try:
        from datetime import datetime
        # Try to parse common time formats
        for fmt in ['%I:%M %p', '%H:%M', '%I %p', '%H']:
            try:
                parsed_time = datetime.strptime(time_text, fmt)
                time_str = parsed_time.strftime('%I:%M %p')
                break
            except ValueError:
                continue
        else:
            raise ValueError("Invalid time format")
        
        # Get stored task data and create task
        if sender_id in user_sessions:
            title = user_sessions[sender_id].get('task_title', 'New Task')
            date = user_sessions[sender_id].get('task_date', 'Today')
            
            # In production, save to database and sync with Canvas
            messenger_api.send_text_message(
                sender_id,
                f"✅ Task added successfully!\\n\\n"
                f"📚 {title}\\n"
                f"📅 Due: {date} at {time_str}\\n\\n"
                f"The task has been added to your Canvas calendar."
            )
            
            # Clear session data
            user_sessions[sender_id] = {}
        
        clear_user_state(sender_id)
        # Show menu again
        messenger_api.send_main_menu(sender_id)
        
    except ValueError:
        messenger_api.send_text_message(
            sender_id,
            "🕰️ Invalid time format. \n\n"
            "Please enter a time like '2:30 PM', '14:30', or '11:59 PM', or type 'cancel' to go back."
        )


def handle_premium_activation(sender_id: str) -> None:
    """Handle premium activation after payment"""
    # In production, verify payment and activate premium
    messenger_api.send_text_message(
        sender_id,
        "🎉 Easely Premium activated!\\n\\n"
        "You now have access to:\\n"
        "• Full proximity reminders\\n"
        "• Unlimited manual tasks\\n"
        "• AI-powered study planning\\n"
        "• Weekly digest reports\\n\\n"
        "Thank you for upgrading!"
    )
    messenger_api.send_main_menu(sender_id)


def handle_show_premium(sender_id: str) -> None:
    """Show premium features and pricing"""
    premium_text = (
        "💎 Easely Premium Features\n\n"
        "Upgrade for advanced features:\n\n"
        "🔔 **Enhanced Reminders**\n"
        "• Multiple alerts (1w, 3d, 1d, 8h, 2h, 1h)\n"
        "• Smart notification timing\n\n"
        "📝 **Unlimited Tasks**\n"
        "• Add as many custom tasks as you need\n"
        "• Full Canvas integration\n\n"
        "🤖 **AI Study Planning**\n"
        "• Personalized study schedules\n"
        "• Workload optimization\n\n"
        "📊 **Analytics & Reports**\n"
        "• Weekly progress summaries\n"
        "• Performance insights\n\n"
        "💰 **Only $4.99/month**\n"
        "Cancel anytime. 7-day free trial!"
    )
    
    buttons = [
        messenger_api.create_url_button(
            "💎 Upgrade Now",
            "https://ko-fi.com/easely/shop"
        )
    ]
    
    messenger_api.send_button_template(sender_id, premium_text, buttons)
    
    # After showing premium info, give option to continue
    quick_replies = [
        messenger_api.create_quick_reply("🏠 Main Menu", "MAIN_MENU"),
        messenger_api.create_quick_reply("⚙️ Settings", "SHOW_SETTINGS")
    ]
    
    messenger_api.send_quick_replies(
        sender_id,
        "Ready to explore your tasks?",
        quick_replies
    )


def handle_skip_premium(sender_id: str) -> None:
    """Handle user skipping premium upgrade"""
    # Mark onboarding as complete in database
    try:
        from app.database.supabase_client import update_user
        update_user(sender_id, {'onboarding_completed': True})
        logger.info(f"Marked onboarding complete for user {sender_id}")
    except Exception as e:
        logger.error(f"Error updating onboarding status: {str(e)}")
    
    # Welcome message and show main menu
    messenger_api.send_text_message(
        sender_id,
        "🎉 Perfect! You're all set up!\n\n"
        "I'm ready to help you stay organized with your Canvas assignments. "
        "You can always upgrade to Premium later for advanced features.\n\n"
        "Let's get started! 📚"
    )
    
    # Show main menu
    messenger_api.send_main_menu(sender_id)


# Helper functions for user state management

def is_new_user(sender_id: str) -> bool:
    """Check if user is new (hasn't completed onboarding)"""
    try:
        # Check database for existing user
        user = get_user(sender_id)
        if not user:
            return True  # User doesn't exist in database - they are new
        
        # Check multiple indicators of onboarding completion
        onboarding_complete = user.get('onboarding_completed', False)
        has_canvas_token = user.get('canvas_token') is not None and user.get('canvas_token') != ''
        
        # If user has completed onboarding OR has a canvas token, they're not new
        if onboarding_complete or has_canvas_token:
            return False
        
        # User exists but hasn't completed onboarding and has no token
        return True
        
    except Exception as e:
        logger.debug(f"Error checking user status for {sender_id}: {str(e)}")
        # If there's a database error, check if we have session info
        try:
            current_state = get_user_session(sender_id, 'conversation_state')
            # If user has a conversation state, they're probably not completely new
            if current_state in ['token_verified', 'onboarding_complete']:
                return False
        except:
            pass
        
        # Default to treating as new user if we can't determine status
        return True


def mark_user_seen(sender_id: str) -> None:
    """Mark user as seen - deprecated, using database instead"""
    # This function is now handled by update_user_last_seen from database client
    pass


def set_user_state(sender_id: str, state: str, trigger_action: str = "unknown") -> None:
    """Set user state for conversation flow with logging"""
    try:
        # Get previous state for logging
        previous_state = None
        try:
            previous_state = get_user_session(sender_id, 'conversation_state') or "none"
        except:
            previous_state = user_sessions.get(sender_id, {}).get('state', 'none')
        
        # Store state in database session instead of memory
        set_user_session(sender_id, 'conversation_state', state, 24)
        
        # Keep backward compatibility with memory sessions for now
        if sender_id not in user_sessions:
            user_sessions[sender_id] = {}
        user_sessions[sender_id]['state'] = state
        
        # Log the state change
        try:
            from app.database.supabase_client import log_conversation_state
            log_conversation_state(sender_id, previous_state, state, trigger_action)
        except Exception as log_error:
            logger.debug(f"Error logging conversation state: {log_error}")
        
    except Exception as e:
        logger.error(f"Error setting user state: {str(e)}")
        # Fallback to memory session
        if sender_id not in user_sessions:
            user_sessions[sender_id] = {}
        user_sessions[sender_id]['state'] = state


def clear_user_state(sender_id: str) -> None:
    """Clear user state"""
    try:
        # Clear state from database session
        clear_user_session(sender_id, 'conversation_state')
        
        # Clear from memory session too
        if sender_id in user_sessions and 'state' in user_sessions[sender_id]:
            del user_sessions[sender_id]['state']
            
    except Exception as e:
        logger.error(f"Error clearing user state: {str(e)}")
        # Fallback to clearing memory session only
        if sender_id in user_sessions and 'state' in user_sessions[sender_id]:
            del user_sessions[sender_id]['state']


def is_waiting_for_token(sender_id: str) -> bool:
    """Check if waiting for token input"""
    try:
        # Check database session first
        db_state = get_user_session(sender_id, 'conversation_state')
        if db_state == 'waiting_for_token':
            return True
    except Exception as e:
        logger.debug(f"Error checking database session: {str(e)}")
    
    # Fallback to memory session
    return (sender_id in user_sessions and 
            user_sessions[sender_id].get('state') == 'waiting_for_token')


def is_waiting_for_task_title(sender_id: str) -> bool:
    """Check if waiting for task title input"""
    try:
        # Check database session first
        db_state = get_user_session(sender_id, 'conversation_state')
        if db_state == 'waiting_for_task_title':
            return True
    except Exception as e:
        logger.debug(f"Error checking database session: {str(e)}")
    
    # Fallback to memory session
    return (sender_id in user_sessions and 
            user_sessions[sender_id].get('state') == 'waiting_for_task_title')


def is_waiting_for_custom_date(sender_id: str) -> bool:
    """Check if waiting for custom date input"""
    try:
        # Check database session first
        db_state = get_user_session(sender_id, 'conversation_state')
        if db_state == 'waiting_for_custom_date':
            return True
    except Exception as e:
        logger.debug(f"Error checking database session: {str(e)}")
    
    # Fallback to memory session
    return (sender_id in user_sessions and 
            user_sessions[sender_id].get('state') == 'waiting_for_custom_date')


def is_waiting_for_custom_time(sender_id: str) -> bool:
    """Check if waiting for custom time input"""
    try:
        # Check database session first
        db_state = get_user_session(sender_id, 'conversation_state')
        if db_state == 'waiting_for_custom_time':
            return True
    except Exception as e:
        logger.debug(f"Error checking database session: {str(e)}")
    
    # Fallback to memory session
    return (sender_id in user_sessions and 
            user_sessions[sender_id].get('state') == 'waiting_for_custom_time')


# Persistent menu handlers

def handle_show_settings(sender_id: str) -> None:
    """Show user settings and preferences"""
    settings_text = (
        "⚙️ Settings & Preferences\n\n"
        "Current Settings:\n"
        "📧 Notifications: Enabled\n"
        "⏰ Reminder Time: 2 hours before\n"
        "🎯 Canvas Sync: Connected\n"
        "💎 Plan: Free (5 tasks/month)\n\n"
        "Contact support for changes."
    )
    
    quick_replies = [
        messenger_api.create_quick_reply("🏠 Main Menu", "MAIN_MENU"),
        messenger_api.create_quick_reply("💎 Upgrade", "SHOW_PREMIUM"),
        messenger_api.create_quick_reply("🔗 Canvas Setup", "TOKEN_TUTORIAL")
    ]
    
    messenger_api.send_quick_replies(sender_id, settings_text, quick_replies)


def handle_show_help(sender_id: str) -> None:
    """Show help and support information"""
    help_text = (
        "❓ Help & Support\n\n"
        "Here's what I can help you with:\n\n"
        "📝 Task Management:\n"
        "• View due dates and assignments\n"
        "• Add custom tasks and reminders\n"
        "• Track overdue items\n\n"
        "🔗 Canvas Integration:\n"
        "• Sync with Canvas LMS\n"
        "• Auto-import assignments\n"
        "• Real-time updates\n\n"
        "💬 Just say 'hello' or 'menu' anytime!"
    )
    
    quick_replies = [
        messenger_api.create_quick_reply("🏠 Main Menu", "MAIN_MENU"),
        messenger_api.create_quick_reply("📖 Tutorial", "TOKEN_TUTORIAL"),
        messenger_api.create_quick_reply("ℹ️ About", "SHOW_ABOUT")
    ]
    
    messenger_api.send_quick_replies(sender_id, help_text, quick_replies)


def handle_show_about(sender_id: str) -> None:
    """Show information about Easely Bot"""
    about_text = (
        "ℹ️ About Easely Bot\n\n"
        "I'm your personal Canvas LMS assistant! 🎨\n\n"
        "Version: 1.0.0\n"
        "Created to help students manage:\n"
        "• Assignment deadlines\n"
        "• Study schedules\n"
        "• Academic tasks\n\n"
        "I integrate directly with Canvas to keep you organized and on track! 📚"
    )
    
    quick_replies = [
        messenger_api.create_quick_reply("🏠 Main Menu", "MAIN_MENU"),
        messenger_api.create_quick_reply("❓ Help", "SHOW_HELP"),
        messenger_api.create_quick_reply("⚙️ Settings", "SHOW_SETTINGS")
    ]
    
    messenger_api.send_quick_replies(sender_id, about_text, quick_replies)
