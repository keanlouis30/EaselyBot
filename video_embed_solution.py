"""
Video Embedding Solutions for Facebook Messenger Bot
=====================================================

Here are multiple approaches to embed/share your video tutorial:

## OPTION 1: YouTube/Vimeo (Recommended)
-----------------------------------------
1. Upload your video to YouTube or Vimeo
2. Send as a structured message with preview

Example implementation:
"""

def send_video_url_attachment(recipient_id: str, video_url: str, title: str = None) -> bool:
    """
    Send a video via URL attachment (works with YouTube, Vimeo, or direct video URLs)
    
    Args:
        recipient_id: Facebook user ID
        video_url: URL to the video (YouTube, Vimeo, or direct .mp4 URL)
        title: Optional title for the video
    
    Returns:
        bool: True if message sent successfully
    """
    # For YouTube/Vimeo - will show preview
    message_data = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "media",
                "elements": [{
                    "media_type": "video",
                    "url": video_url,
                    "buttons": [{
                        "type": "web_url",
                        "url": video_url,
                        "title": "Watch Full Video"
                    }]
                }]
            }
        }
    }
    
    # Alternative: Generic template with video preview
    alternative_message = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "generic",
                "elements": [{
                    "title": title or "Canvas Token Tutorial",
                    "subtitle": "Step-by-step guide to generate your Canvas access token",
                    "image_url": "https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg",  # YouTube thumbnail
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

"""
## OPTION 2: Direct Video Hosting (GitHub Pages / CDN)
-------------------------------------------------------
1. Convert video to MP4 format (best compatibility)
2. Host on GitHub Pages, Cloudinary, or CDN
3. Send as direct video attachment
"""

def send_hosted_video(recipient_id: str, video_url: str) -> bool:
    """
    Send video from a direct URL (must be publicly accessible HTTPS)
    
    Args:
        recipient_id: Facebook user ID  
        video_url: Direct URL to video file (must be .mp4 and HTTPS)
    
    Returns:
        bool: True if sent successfully
    """
    message_data = {
        "attachment": {
            "type": "video",
            "payload": {
                "url": video_url,
                "is_reusable": True  # Facebook will cache the video
            }
        }
    }
    return send_message(recipient_id, message_data)

"""
## OPTION 3: Upload to Facebook (One-time Setup)
-------------------------------------------------
Upload video to Facebook's servers once, get attachment_id, reuse forever
"""

def upload_video_to_facebook(video_url: str) -> str:
    """
    Upload video to Facebook and get reusable attachment_id
    Run this once during setup
    
    Args:
        video_url: URL to video file
    
    Returns:
        str: Attachment ID for reuse
    """
    import requests
    from config.settings import PAGE_ACCESS_TOKEN, GRAPH_API_URL
    
    url = f"{GRAPH_API_URL}/me/message_attachments"
    
    payload = {
        "message": {
            "attachment": {
                "type": "video",
                "payload": {
                    "url": video_url,
                    "is_reusable": True
                }
            }
        }
    }
    
    params = {"access_token": PAGE_ACCESS_TOKEN}
    
    response = requests.post(url, json=payload, params=params)
    data = response.json()
    
    # Returns: {"attachment_id": "123456789"}
    return data.get("attachment_id")

def send_video_by_attachment_id(recipient_id: str, attachment_id: str) -> bool:
    """
    Send pre-uploaded video using attachment_id (very fast)
    
    Args:
        recipient_id: Facebook user ID
        attachment_id: Facebook attachment ID from upload
    
    Returns:
        bool: True if sent successfully
    """
    message_data = {
        "attachment": {
            "type": "video",
            "payload": {
                "attachment_id": attachment_id
            }
        }
    }
    return send_message(recipient_id, message_data)

"""
## OPTION 4: Convert to GIF (For Short Tutorials)
--------------------------------------------------
For short tutorials (< 30 seconds), convert to animated GIF
"""

def send_gif_tutorial(recipient_id: str, gif_url: str) -> bool:
    """
    Send animated GIF tutorial (auto-plays in Messenger)
    
    Args:
        recipient_id: Facebook user ID
        gif_url: URL to GIF file
    
    Returns:
        bool: True if sent successfully
    """
    message_data = {
        "attachment": {
            "type": "image",
            "payload": {
                "url": gif_url,
                "is_reusable": True
            }
        }
    }
    return send_message(recipient_id, message_data)

"""
## RECOMMENDED IMPLEMENTATION
-----------------------------

For production, I recommend:

1. Convert your test.mkv to MP4 format:
   ffmpeg -i test.mkv -codec:v libx264 -preset slow -crf 22 -codec:a aac tutorial.mp4

2. Upload to YouTube as "Unlisted" or to GitHub releases/pages

3. Update your handle_watch_video function:
"""

# In event_handler.py, update handle_watch_video:

def handle_watch_video_production(sender_id: str) -> None:
    """Production-ready video tutorial handler"""
    import os
    
    # Option A: YouTube/Vimeo URL
    VIDEO_URL = "https://www.youtube.com/watch?v=YOUR_VIDEO_ID"
    
    # Option B: Direct hosted video
    # VIDEO_URL = "https://your-cdn.com/canvas-tutorial.mp4"
    
    # Option C: Use pre-uploaded Facebook attachment ID
    # FACEBOOK_VIDEO_ATTACHMENT_ID = "1234567890"  # Store in env variable
    
    # Send introduction
    messenger_api.send_text_message(
        sender_id,
        "🎥 Here's a video tutorial showing how to generate your Canvas token:"
    )
    
    # Send video using generic template (works with YouTube)
    message_data = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "generic",
                "elements": [{
                    "title": "Canvas Token Tutorial",
                    "subtitle": "Step-by-step guide (3 minutes)",
                    "image_url": "https://i.imgur.com/YOUR_THUMBNAIL.jpg",  # Upload thumbnail to imgur
                    "default_action": {
                        "type": "web_url",
                        "url": VIDEO_URL
                    },
                    "buttons": [{
                        "type": "web_url",
                        "url": VIDEO_URL,
                        "title": "▶️ Watch Tutorial"
                    }]
                }]
            }
        }
    }
    
    messenger_api.send_message(sender_id, message_data)
    
    # Follow up with quick replies
    quick_replies = [
        messenger_api.create_quick_reply("🔑 I have my token", "TOKEN_READY"),
        messenger_api.create_quick_reply("📝 Show text steps", "TOKEN_NEED_HELP")
    ]
    
    messenger_api.send_quick_replies(
        sender_id,
        "After watching, do you have your Canvas token ready?",
        quick_replies
    )

"""
## QUICK SETUP STEPS
--------------------

1. Convert video to MP4:
   ffmpeg -i test.mkv -c:v h264 -c:a aac -movflags +faststart tutorial.mp4

2. Choose hosting option:
   - YouTube (easiest): Upload as unlisted
   - GitHub: Add to releases as asset
   - Free CDN: Use Cloudinary (free tier)
   - Imgur: For video under 60 seconds

3. Update environment variable:
   VIDEO_TUTORIAL_URL=https://your-video-url-here

4. Implement in your code using one of the methods above
"""