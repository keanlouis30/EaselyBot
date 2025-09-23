# 🍔 Hamburger Menu Setup Guide

## Overview
EaselyBot uses a **Persistent Menu** (hamburger menu ☰) instead of default buttons. This provides a better user experience with organized, nested navigation that's always accessible.

## 📱 Menu Structure

The hamburger menu (☰) appears in the **bottom-left corner** of the Messenger conversation and includes:

```
☰ Menu
├── 📚 My Tasks
├── 🎯 Quick Actions
│   ├── Due Today
│   ├── This Week
│   ├── Overdue
│   ├── All Tasks
│   └── Add New Task
├── ⚙️ Settings
│   ├── Canvas Setup
│   ├── Sync Canvas
│   ├── Notifications
│   └── Account Settings
├── 💎 Premium
│   ├── View Features
│   ├── Upgrade Now
│   └── Enter Code
└── ℹ️ Help
    ├── How to Use
    ├── About Easely
    ├── Privacy Policy
    ├── Terms of Use
    └── Contact Support
```

## 🚀 How to Set Up

### Prerequisites
1. **Facebook Page Access Token** in your `.env` file
2. **Node.js** and npm installed

### Setup Steps

1. **Add your Facebook Page Access Token to `.env`:**
   ```env
   PAGE_ACCESS_TOKEN=your_actual_token_here
   GRAPH_API_URL=https://graph.facebook.com/v17.0
   ```

2. **Run the setup script:**
   ```bash
   npm run setup
   ```
   
   This will:
   - Configure the hamburger menu (☰)
   - Set up the Get Started button
   - Add a welcome greeting message

3. **Verify the setup:**
   - Open your Facebook Page
   - Start a conversation with your bot
   - Look for the hamburger menu icon (☰) in the bottom-left corner
   - Click it to see all menu options

## 🔧 Manual Setup (Alternative)

If you prefer to set it up manually via Facebook's API:

```bash
# Using curl
curl -X POST "https://graph.facebook.com/v17.0/me/messenger_profile?access_token=YOUR_PAGE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d @hamburger_menu.json
```

Where `hamburger_menu.json` contains the persistent menu configuration.

## ✨ Features

### Advantages of Hamburger Menu:
1. **Always Accessible**: Available throughout the conversation
2. **No Clutter**: Doesn't interfere with chat interface
3. **Organized Navigation**: Nested menus for better organization
4. **Professional Look**: Cleaner than multiple buttons
5. **More Options**: Can have up to 5 top-level items with 5 sub-items each

### User Experience:
- Users can access all features without typing commands
- Quick access to common tasks (Due Today, This Week, etc.)
- Settings and premium features are easily discoverable
- Help and support options are always available

## 🎨 Customization

To customize the menu, edit the `setupPersistentMenu()` function in `setupBot.js`:

```javascript
// Example: Add a new menu item
{
    title: "📊 Reports",
    type: "postback",
    payload: "SHOW_REPORTS"
}
```

Then add the corresponding handler in `eventHandler.js`:

```javascript
else if (payload === "SHOW_REPORTS") {
    await handleShowReports(senderId);
}
```

## 🐛 Troubleshooting

### Menu Not Appearing?
1. **Check Access Token**: Ensure PAGE_ACCESS_TOKEN is correct
2. **Page Role**: Verify you're an admin/editor of the Facebook Page
3. **Clear Cache**: Try refreshing Messenger or clearing browser cache
4. **Mobile vs Desktop**: Menu may look different on mobile devices

### Menu Not Working?
1. **Check Handlers**: Ensure all payloads have corresponding handlers
2. **Server Running**: Make sure your bot server is running
3. **Webhook Active**: Verify webhook is properly configured

### Reset Menu
To clear and reset the menu:
```bash
# First clear the existing menu
node setupBot.js --clear

# Then set it up again
npm run setup
```

## 📝 Notes

- The hamburger menu is **persistent** - it stays throughout the conversation
- It **replaces** any default "like" or other buttons
- Users can still type commands if they prefer
- The menu is **language-agnostic** but currently set to English

## 🔗 Resources

- [Facebook Persistent Menu Documentation](https://developers.facebook.com/docs/messenger-platform/send-messages/persistent-menu)
- [Messenger Profile API](https://developers.facebook.com/docs/messenger-platform/reference/messenger-profile-api)
- [Best Practices for Persistent Menu](https://developers.facebook.com/docs/messenger-platform/introduction/navigation)

## 💡 Tips

1. **Keep menu items short**: Maximum 30 characters for titles
2. **Use emojis**: They make the menu more visual and engaging
3. **Group related items**: Use nested menus for better organization
4. **Test on mobile**: Most users will access via mobile devices
5. **Update regularly**: Add new features to the menu as you develop them

---

The hamburger menu provides a professional, organized way for users to navigate your bot's features without cluttering the conversation interface!
