# Migration Guide: In-Memory to Database Storage

## Current Status
✅ Database schema created  
✅ Database service module created (`services/database.js`)  
❌ Code still using in-memory Maps  
❌ Database not integrated into main code  

## Steps to Complete Migration

### Step 1: Install Dependencies
```bash
npm install @supabase/supabase-js crypto-js
```

### Step 2: Update index.js Imports
Replace at the top of `index.js`:

```javascript
// OLD CODE (Remove these):
const users = new Map();
const userSessions = new Map();

// NEW CODE (Add this):
const db = require('./services/database');
```

### Step 3: Replace User Functions
Find and replace in `index.js`:

| Old Function | New Function |
|-------------|--------------|
| `getUser(senderId)` | `await db.getUser(senderId)` |
| `createUser(senderId)` | `await db.createUser(senderId)` |
| `updateUser(senderId, data)` | `await db.updateUser(senderId, data)` |

### Step 4: Replace Session Functions
Find and replace in `index.js`:

| Old Function | New Function |
|-------------|--------------|
| `getUserSession(senderId)` | `await db.getUserSession(senderId)` |
| `setUserSession(senderId, data)` | `await db.setUserSession(senderId, data)` |
| `clearUserSession(senderId)` | `await db.clearUserSession(senderId)` |

### Step 5: Update Task Management
When creating tasks, replace:

```javascript
// OLD CODE:
user.assignments.push(newTask);
updateUser(senderId, { assignments: user.assignments });

// NEW CODE:
await db.createTask(senderId, newTask);
```

### Step 6: Update Broadcast Function
Replace the broadcast user fetching:

```javascript
// OLD CODE:
targetUserIds = Array.from(users.entries())
  .filter(([id, user]) => user.isOnboarded)
  .map(([id, user]) => id);

// NEW CODE:
const users = await db.getAllUsers('onboarded');
targetUserIds = users.map(user => user.sender_id);
```

### Step 7: Make Functions Async
IMPORTANT: All functions that call database functions must be `async`:

```javascript
// Example: Update handleMessage function
async function handleMessage(senderId, message) {
  // Change from:
  let user = getUser(senderId);
  
  // To:
  let user = await db.getUser(senderId);
}
```

### Step 8: Add Periodic Cleanup
Add to your main app initialization:

```javascript
// Clean up expired sessions every hour
setInterval(async () => {
  await db.cleanupExpiredSessions();
}, 60 * 60 * 1000);
```

## Testing the Migration

### 1. Test Database Connection
Create `test-db.js`:

```javascript
require('dotenv').config();
const db = require('./services/database');

async function test() {
  console.log('Testing database connection...');
  
  // Test user creation
  const testUser = await db.createUser('test_sender_123');
  console.log('Created user:', testUser);
  
  // Test user retrieval
  const retrieved = await db.getUser('test_sender_123');
  console.log('Retrieved user:', retrieved);
  
  // Test update
  const updated = await db.updateUser('test_sender_123', {
    subscription_tier: 'premium'
  });
  console.log('Updated user:', updated);
}

test().catch(console.error);
```

Run with: `node test-db.js`

### 2. Deploy to Render
1. Add environment variables in Render dashboard:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_KEY
   - ENCRYPTION_KEY

2. Push changes:
```bash
git add .
git commit -m "Add database integration"
git push origin main
```

## Migration Checklist

Before deploying:

- [ ] Installed @supabase/supabase-js and crypto-js
- [ ] Created services/database.js
- [ ] Replaced all Map references with db functions
- [ ] Made all relevant functions async
- [ ] Updated all getUser calls to await db.getUser
- [ ] Updated all updateUser calls to await db.updateUser
- [ ] Updated task management to use db.createTask
- [ ] Updated broadcast function to use db.getAllUsers
- [ ] Tested locally with test-db.js
- [ ] Added all env vars to Render dashboard
- [ ] Run database schema in Supabase SQL Editor

## Benefits After Migration

✅ **Data Persistence**: User data survives deployments  
✅ **Scalability**: Can handle thousands of users  
✅ **Security**: Canvas tokens are encrypted  
✅ **Analytics**: Activity logging for insights  
✅ **Reliability**: No more memory loss on restart  

## Rollback Plan

If issues occur, you can temporarily use both:

```javascript
// Hybrid approach during migration
async function getUser(senderId) {
  // Try database first
  let user = await db.getUser(senderId);
  
  // Fall back to memory if needed
  if (!user) {
    user = users.get(senderId);
  }
  
  return user;
}
```

## Need Help?

1. Check Supabase logs: Dashboard → Logs → API
2. Check Node.js logs: `npm start` and watch console
3. Test individual functions with test-db.js
4. Verify environment variables are set correctly
