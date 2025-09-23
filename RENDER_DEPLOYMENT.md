# 🚀 Render Deployment Guide for EaselyBot

## Prerequisites
- GitHub repository with the EaselyBot code
- Render account (free tier works)
- Facebook App with Page Access Token
- Supabase account (optional, for database features)

## 🔧 Build and Start Commands

### For Render Dashboard:
- **Build Command:** `npm ci --production`
- **Start Command:** `npm start`

### Alternative (if you want more control):
- **Build Command:** `npm install --production`
- **Start Command:** `NODE_ENV=production node main.js`

## 📝 Step-by-Step Deployment

### 1. Connect GitHub Repository
1. Log in to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub account and select the EaselyBot repository
4. Select the branch to deploy (usually `main` or `master`)

### 2. Configure Service Settings
- **Name:** `easely-bot` (or your preferred name)
- **Environment:** `Node`
- **Region:** Choose closest to your users
- **Branch:** `main` (or your default branch)
- **Build Command:** `npm ci --production`
- **Start Command:** `npm start`
- **Plan:** Free (upgradeable later)

### 3. Set Environment Variables
Click "Advanced" and add these environment variables:

#### Required Variables:
```
PAGE_ACCESS_TOKEN=your_facebook_page_access_token
VERIFY_TOKEN=your_webhook_verify_token
```

#### Optional but Recommended:
```
# Supabase (for database features)
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key

# Canvas LMS (for assignment sync)
CANVAS_BASE_URL=https://your-canvas-instance.instructure.com

# Application Settings
NODE_ENV=production
APP_ENV=production
DEBUG_MODE=false
LOG_LEVEL=INFO

# Render Flag
RENDER=true
```

### 4. Deploy
1. Click "Create Web Service"
2. Wait for the build and deploy to complete (5-10 minutes)
3. Your service URL will be: `https://easely-bot.onrender.com`

## 🔗 Configure Facebook Webhook

### 1. Get Your Render URL
After deployment, your webhook URL will be:
```
https://your-service-name.onrender.com/webhook
```

### 2. Configure in Facebook App
1. Go to Facebook Developers → Your App → Webhooks
2. Add Callback URL: `https://your-service-name.onrender.com/webhook`
3. Verify Token: Use the same value as your `VERIFY_TOKEN` env variable
4. Subscribe to fields: `messages`, `messaging_postbacks`, `messaging_optins`

### 3. Verify Webhook
Click "Verify and Save" in Facebook App dashboard

## 🏃 Post-Deployment Setup

### 1. Initialize Bot Profile
Run this once after deployment to set up the persistent menu:
```bash
curl -X POST https://your-service-name.onrender.com/setup
```

### 2. Test the Bot
1. Go to your Facebook Page
2. Send a message to test the bot
3. Check logs in Render dashboard for any issues

## 🔍 Monitoring

### Health Check
Visit: `https://your-service-name.onrender.com/`

Should return:
```json
{
  "status": "running",
  "service": "Easely Bot",
  "version": "1.0.0",
  "environment": "production",
  "database": "connected"
}
```

### View Logs
In Render Dashboard → Your Service → Logs

## 🚨 Troubleshooting

### Bot Not Responding
1. Check environment variables are set correctly
2. Verify webhook is configured in Facebook App
3. Check logs for errors
4. Ensure PAGE_ACCESS_TOKEN has necessary permissions

### Database Issues
1. Verify SUPABASE_URL and SUPABASE_KEY are correct
2. Check Supabase project is active
3. Review database connection logs

### Webhook Verification Failed
1. Ensure VERIFY_TOKEN matches in both Render and Facebook
2. Check webhook URL is correct (includes `/webhook` path)
3. Service must be running before verification

## 🔄 Updates and Redeploy

### Automatic Deploy (if enabled):
Push to your connected branch → Render auto-deploys

### Manual Deploy:
Render Dashboard → Your Service → "Manual Deploy" → "Deploy latest commit"

## 📊 Performance Tips

1. **Free Tier Limitations:**
   - Service spins down after 15 minutes of inactivity
   - First request after spin-down takes 10-30 seconds
   - Consider upgrading for always-on service

2. **Optimization:**
   - Use environment variables for all secrets
   - Enable production mode (`NODE_ENV=production`)
   - Monitor memory usage in Render dashboard

## 🎯 Next Steps

1. Test all bot features
2. Monitor logs for first 24 hours
3. Set up error alerting (optional)
4. Consider custom domain (optional)
5. Upgrade to paid tier if needed for:
   - Always-on service
   - More memory/CPU
   - Custom domains
   - Auto-scaling

## 📚 Resources

- [Render Documentation](https://render.com/docs)
- [Facebook Messenger Platform](https://developers.facebook.com/docs/messenger-platform)
- [Supabase Documentation](https://supabase.com/docs)
- [Node.js on Render](https://render.com/docs/deploy-node-express-app)

---

**Note:** The bot is configured to handle Render's platform-specific behaviors, including graceful shutdowns and health checks. The free tier is suitable for testing and small-scale usage.
