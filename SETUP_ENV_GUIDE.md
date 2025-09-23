# Complete Guide to Getting Your .env Credentials

## Overview
This guide will help you obtain all the necessary credentials for your EaselyBot `.env` file.

---

## 1. 🔵 **Facebook/Meta Credentials**

### Required Variables:
```bash
VERIFY_TOKEN=your_custom_verify_token
PAGE_ACCESS_TOKEN=your_page_access_token
APP_SECRET=your_app_secret
```

### Steps to Get Them:

#### A. Create a Facebook App
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click **"My Apps"** → **"Create App"**
3. Choose **"Business"** type
4. Select **"Messenger"** as the product
5. Fill in the app details

#### B. Get APP_SECRET
1. In your app dashboard, go to **Settings** → **Basic**
2. You'll see **"App Secret"** (click "Show" and enter your password)
3. Copy this value for `APP_SECRET`

#### C. Create/Connect a Facebook Page
1. Go to [Facebook Pages](https://www.facebook.com/pages/create)
2. Create a page for your bot (or use existing)
3. Note your Page ID

#### D. Get PAGE_ACCESS_TOKEN
1. In Facebook App Dashboard, go to **Messenger** → **Settings**
2. Under **"Access Tokens"**, find your page
3. Click **"Generate Token"**
4. Copy this long token for `PAGE_ACCESS_TOKEN`

#### E. Set VERIFY_TOKEN
1. This is any random string you create yourself
2. Example: `VERIFY_TOKEN=my_super_secret_verify_token_2024`
3. You'll use this when setting up the webhook

#### F. Setup Webhook (after deploying)
1. In Messenger Settings, under **"Webhooks"**
2. Click **"Add Callback URL"**
3. Enter:
   - Callback URL: `https://your-app.onrender.com/webhook`
   - Verify Token: (use the same VERIFY_TOKEN from your .env)
4. Subscribe to: `messages`, `messaging_postbacks`

---

## 2. 🟢 **Supabase Credentials**

### Required Variables:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
```

### Steps to Get Them:

1. **Create Supabase Account**
   - Go to [Supabase](https://app.supabase.com/)
   - Sign up (free tier is fine)

2. **Create New Project**
   - Click **"New project"**
   - Choose organization
   - Set project name: `easelybot`
   - Set database password (save this!)
   - Choose region closest to you
   - Click **"Create new project"** (takes ~2 minutes)

3. **Get Your Credentials**
   - Once project is ready, go to **Settings** → **API**
   - You'll see:
     - **Project URL**: Copy this for `SUPABASE_URL`
     - **anon public**: Copy for `SUPABASE_ANON_KEY`
     - **service_role**: Copy for `SUPABASE_SERVICE_KEY` (⚠️ Keep this secret!)

4. **Run Database Schema**
   - Go to **SQL Editor** in left sidebar
   - Click **"New query"**
   - Copy contents from `database/schema_fixed.sql`
   - Paste and click **"Run"**

---

## 3. 🎓 **Canvas LMS Settings**

### Required Variable:
```bash
CANVAS_BASE_URL=https://dlsu.instructure.com
```

### Common Canvas URLs:
- DLSU: `https://dlsu.instructure.com`
- UST: `https://ust.instructure.com`  
- ADMU: `https://canvas.ateneo.edu`
- UP: `https://canvas.upd.edu.ph`
- Generic: `https://canvas.instructure.com`

Change this based on your institution's Canvas URL.

---

## 4. 🔐 **Encryption Key (For Token Security)**

### Required Variable:
```bash
ENCRYPTION_KEY=your-32-character-secret-key
```

### Generate a Secure Key:

#### Option 1: Using OpenSSL (Recommended)
```bash
# Run this in your terminal
openssl rand -base64 32
```

#### Option 2: Using Node.js
```bash
# Run this in your terminal
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### Option 3: Online Generator
- Go to [RandomKeygen](https://randomkeygen.com/)
- Use a "Fort Knox Password" 
- Copy one for your `ENCRYPTION_KEY`

---

## 5. 🚀 **Render.com Deployment Variables**

### Required Variables (for render.yaml):
```bash
PORT=3000  # Usually set automatically by Render
NODE_ENV=production
```

### If Using Render:
1. These are often auto-configured
2. Add all other env vars in Render Dashboard → Environment

---

## 📝 **Complete .env.example Template**

Create a `.env` file with all variables:

```bash
# Facebook/Meta Configuration
VERIFY_TOKEN=my_unique_verify_token_2024
PAGE_ACCESS_TOKEN=EAAxxxxxxxxx...very_long_token...xxxxx
APP_SECRET=1234567890abcdef1234567890abcdef

# Supabase Configuration  
SUPABASE_URL=https://abcdefghijklmnop.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...xxxxx
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...xxxxx

# Canvas Configuration
CANVAS_BASE_URL=https://dlsu.instructure.com

# Security
ENCRYPTION_KEY=AbC123XyZ789+/DefGhiJklMnoPqrStu=

# Server Configuration
PORT=3000
NODE_ENV=development
```

---

## 🔒 **Security Best Practices**

### DO:
✅ Add `.env` to `.gitignore` (already done)
✅ Use different tokens for dev/production
✅ Rotate tokens periodically
✅ Use environment variables in production (Render dashboard)

### DON'T:
❌ Commit `.env` to Git
❌ Share tokens in Discord/forums
❌ Use weak encryption keys
❌ Log tokens in console

---

## 🧪 **Testing Your Credentials**

### 1. Test Facebook Connection:
```bash
# After setting up, your webhook GET should return:
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=test"
# Should return: test
```

### 2. Test Supabase Connection:
```javascript
// Quick test file: test-supabase.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function test() {
  const { data, error } = await supabase
    .from('users')
    .select('count');
  
  if (error) console.error('Error:', error);
  else console.log('Success! Connected to Supabase');
}

test();
```

### 3. Test Canvas URL:
```bash
# Test if Canvas URL is accessible
curl -I https://dlsu.instructure.com/api/v1/courses
# Should return HTTP headers (401 is expected without token)
```

---

## 🆘 **Troubleshooting**

### Facebook Issues:
- **"Invalid Verify Token"**: Make sure VERIFY_TOKEN in .env matches webhook setup
- **"Page not found"**: Ensure PAGE_ACCESS_TOKEN is for the correct page
- **Webhook not receiving**: Check if app is in Development mode

### Supabase Issues:
- **"Invalid API key"**: Check you copied the full key (they're very long)
- **"relation does not exist"**: Run the schema.sql first
- **Connection timeout**: Check if project is paused (free tier pauses after 1 week inactive)

### Canvas Issues:
- **Wrong URL**: Ask your IT department for the correct Canvas URL
- **Token issues**: Users create their own Canvas tokens

---

## 📞 **Getting Help**

1. **Facebook/Meta**: [Facebook Developers Community](https://developers.facebook.com/community/)
2. **Supabase**: [Supabase Discord](https://discord.supabase.com/)
3. **Canvas**: Your institution's IT support
4. **EaselyBot**: Check the README.md and WARP.md files

---

## ✅ **Checklist**

Before running your bot, ensure you have:

- [ ] Facebook App created and configured
- [ ] VERIFY_TOKEN set (your custom string)
- [ ] PAGE_ACCESS_TOKEN obtained from Facebook
- [ ] APP_SECRET copied from Facebook app settings
- [ ] Supabase project created
- [ ] SUPABASE_URL copied
- [ ] SUPABASE_ANON_KEY copied
- [ ] SUPABASE_SERVICE_KEY copied (keep secret!)
- [ ] Database schema run in Supabase SQL editor
- [ ] CANVAS_BASE_URL set to your institution
- [ ] ENCRYPTION_KEY generated (32+ characters)
- [ ] .env file created with all variables
- [ ] .env added to .gitignore (should already be)

Once all checked, you're ready to run: `npm start` 🚀
