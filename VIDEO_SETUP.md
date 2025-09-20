# Video Tutorial Setup Guide

## Video File Ready
Your video has been converted to MP4 format: `canvas_tutorial.mp4` (405KB)

## Option 1: GitHub Release (Recommended)
1. Go to your repository: https://github.com/keanlouis30/EaselyBot
2. Click on "Releases" → "Create a new release"
3. Tag version: `v1.0.0-tutorial`
4. Upload `canvas_tutorial.mp4` as a release asset
5. After uploading, right-click the video file and copy its URL
6. The URL will look like: `https://github.com/keanlouis30/EaselyBot/releases/download/v1.0.0-tutorial/canvas_tutorial.mp4`

## Option 2: GitHub Pages
1. Create a `docs` folder in your repository
2. Copy `canvas_tutorial.mp4` to the `docs` folder
3. Enable GitHub Pages in Settings → Pages
4. Your video URL will be: `https://keanlouis30.github.io/EaselyBot/canvas_tutorial.mp4`

## Option 3: Free Video Hosting Services

### YouTube (Best for accessibility)
1. Upload to YouTube as "Unlisted"
2. Get the share URL
3. Users can watch directly in their browser

### Cloudinary (Direct MP4 hosting)
1. Sign up for free at cloudinary.com
2. Upload the MP4 file
3. Get the direct URL (HTTPS required)

### Streamable
1. Upload at streamable.com (free, no account needed)
2. Get the direct link
3. Works well with Facebook Messenger

## Configure the Bot

Once you have your video URL, add it to your Render environment variables:

1. Go to your Render dashboard
2. Navigate to your service → Environment
3. Add a new environment variable:
   ```
   VIDEO_TUTORIAL_URL=https://your-video-url-here
   ```

## How It Works

The bot now has three methods to send videos:

1. **URL Template** (Production): When `VIDEO_TUTORIAL_URL` is set, sends a clickable video card
2. **Local File** (Development): Uses local video file when available
3. **Text Fallback**: Shows detailed text instructions if video isn't available

## Testing

After setting up:
1. Message your bot
2. Navigate to the token setup
3. Click "Watch Video"
4. You should see a video card that opens the tutorial when clicked

## Current Implementation

The video handler now:
- Checks for `VIDEO_TUTORIAL_URL` environment variable first
- Falls back to local file in development
- Shows text instructions if neither is available
- Works seamlessly across all environments

## File Formats

- **Original**: `test.mkv` (860KB)
- **Converted**: `canvas_tutorial.mp4` (405KB)
- **Format**: H.264 video, AAC audio
- **Compatibility**: Works on all browsers and devices