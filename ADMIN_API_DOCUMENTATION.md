# Admin API Documentation

## Overview
The EaselyBot Admin API allows authorized administrators to send broadcast messages to users and retrieve system statistics. All admin endpoints require authentication via an API token.

## Authentication
All admin endpoints require the `X-Admin-Token` header with your admin API token.

```http
X-Admin-Token: your_admin_api_token
```

Set this token in your `.env` file:
```env
ADMIN_API_TOKEN=your_secure_token_here
```

## Endpoints

### 1. Send Broadcast Message

**Endpoint:** `POST /admin/broadcast`

**Description:** Sends a message to all onboarded users or a specific subset.

**Headers:**
```http
Content-Type: application/json
X-Admin-Token: your_admin_api_token
```

**Request Body:**
```json
{
  "message": {
    "text": "📢 Important announcement: Classes will resume on Monday!",
    "quick_replies": [
      {
        "content_type": "text",
        "title": "Got it!",
        "payload": "ACKNOWLEDGE"
      },
      {
        "content_type": "text",
        "title": "View Menu",
        "payload": "MENU"
      }
    ]
  },
  "targetUsers": "all",
  "testMode": false
}
```

**Parameters:**
- `message.text` (required): The message text to broadcast
- `message.quick_replies` (optional): Quick reply buttons to include
- `targetUsers` (optional): Target audience
  - `"all"` - All onboarded users (default)
  - `"premium"` - Premium users only
  - `["user_id_1", "user_id_2"]` - Specific user IDs
- `testMode` (optional): If true, only sends to first 3 users for testing

**Response:**
```json
{
  "success": true,
  "message": "Broadcast initiated",
  "totalUsers": 150,
  "testMode": false
}
```

**Example cURL:**
```bash
curl -X POST http://localhost:3000/admin/broadcast \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: your_admin_token" \
  -d '{
    "message": {
      "text": "📢 System maintenance tonight from 10 PM to 12 AM. The bot will be temporarily unavailable."
    },
    "targetUsers": "all",
    "testMode": true
  }'
```

### 2. Get User Statistics

**Endpoint:** `GET /admin/stats`

**Description:** Retrieves user statistics and system metrics.

**Headers:**
```http
X-Admin-Token: your_admin_api_token
```

**Response:**
```json
{
  "totalUsers": 250,
  "onboardedUsers": 200,
  "premiumUsers": 50,
  "usersWithCanvas": 180,
  "timestamp": "2024-01-09T10:30:00Z"
}
```

**Example cURL:**
```bash
curl -X GET http://localhost:3000/admin/stats \
  -H "X-Admin-Token: your_admin_token"
```

## Integration Examples

### JavaScript/Node.js Client

```javascript
const axios = require('axios');

class EaselyBotAdmin {
  constructor(apiUrl, adminToken) {
    this.apiUrl = apiUrl;
    this.adminToken = adminToken;
  }

  async sendBroadcast(messageText, targetUsers = 'all', testMode = false) {
    try {
      const response = await axios.post(
        `${this.apiUrl}/admin/broadcast`,
        {
          message: { text: messageText },
          targetUsers,
          testMode
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Token': this.adminToken
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Broadcast failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async getStats() {
    try {
      const response = await axios.get(
        `${this.apiUrl}/admin/stats`,
        {
          headers: {
            'X-Admin-Token': this.adminToken
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to get stats:', error.response?.data || error.message);
      throw error;
    }
  }
}

// Usage example
const admin = new EaselyBotAdmin(
  'https://your-bot-url.com',
  'your_admin_token'
);

// Send a broadcast
admin.sendBroadcast(
  '📢 Reminder: Submit your assignments by midnight!',
  'all',
  true // test mode
).then(result => {
  console.log('Broadcast sent:', result);
});

// Get statistics
admin.getStats().then(stats => {
  console.log('User stats:', stats);
});
```

### Python Client

```python
import requests
import json

class EaselyBotAdmin:
    def __init__(self, api_url, admin_token):
        self.api_url = api_url
        self.admin_token = admin_token
        self.headers = {
            'Content-Type': 'application/json',
            'X-Admin-Token': admin_token
        }
    
    def send_broadcast(self, message_text, target_users='all', test_mode=False):
        """Send a broadcast message to users"""
        url = f"{self.api_url}/admin/broadcast"
        payload = {
            'message': {'text': message_text},
            'targetUsers': target_users,
            'testMode': test_mode
        }
        
        response = requests.post(url, json=payload, headers=self.headers)
        response.raise_for_status()
        return response.json()
    
    def get_stats(self):
        """Get user statistics"""
        url = f"{self.api_url}/admin/stats"
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()

# Usage
admin = EaselyBotAdmin('https://your-bot-url.com', 'your_admin_token')

# Send broadcast
result = admin.send_broadcast(
    '📢 System update completed successfully!',
    target_users='all',
    test_mode=True
)
print(f"Broadcast sent to {result['totalUsers']} users")

# Get stats
stats = admin.get_stats()
print(f"Total users: {stats['totalUsers']}")
```

### React Admin Dashboard Component

```jsx
import React, { useState } from 'react';
import axios from 'axios';

const BroadcastForm = ({ apiUrl, adminToken }) => {
  const [message, setMessage] = useState('');
  const [targetUsers, setTargetUsers] = useState('all');
  const [testMode, setTestMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const sendBroadcast = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.post(
        `${apiUrl}/admin/broadcast`,
        {
          message: { text: message },
          targetUsers,
          testMode
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Token': adminToken
          }
        }
      );
      
      setResult(response.data);
      setMessage(''); // Clear form
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="broadcast-form">
      <h2>Send Broadcast Message</h2>
      <form onSubmit={sendBroadcast}>
        <div>
          <label>Message:</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter your broadcast message..."
            required
            rows={4}
            cols={50}
          />
        </div>
        
        <div>
          <label>Target Users:</label>
          <select
            value={targetUsers}
            onChange={(e) => setTargetUsers(e.target.value)}
          >
            <option value="all">All Onboarded Users</option>
            <option value="premium">Premium Users Only</option>
          </select>
        </div>
        
        <div>
          <label>
            <input
              type="checkbox"
              checked={testMode}
              onChange={(e) => setTestMode(e.target.checked)}
            />
            Test Mode (send to first 3 users only)
          </label>
        </div>
        
        <button type="submit" disabled={loading}>
          {loading ? 'Sending...' : 'Send Broadcast'}
        </button>
      </form>
      
      {result && (
        <div className="success">
          ✅ Broadcast sent to {result.totalUsers} users
          {result.testMode && ' (Test Mode)'}
        </div>
      )}
      
      {error && (
        <div className="error">
          ❌ Error: {error}
        </div>
      )}
    </div>
  );
};

export default BroadcastForm;
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Message with text property is required"
}
```

### 401 Unauthorized
```json
{
  "error": "Missing X-Admin-Token header"
}
```

### 403 Forbidden
```json
{
  "error": "Invalid admin token"
}
```

### 500 Internal Server Error
```json
{
  "error": "Admin API not configured"
}
```

## Rate Limits

- The broadcast endpoint processes messages in batches of 20 users
- 2-second delay between batches to respect Facebook rate limits
- Facebook allows up to 100 API requests per second per app

## Security Best Practices

1. **Generate a strong admin token:**
   ```bash
   openssl rand -base64 32
   ```

2. **Use HTTPS in production** to protect the token in transit

3. **Rotate tokens regularly** and store them securely

4. **Implement IP whitelisting** if possible

5. **Add rate limiting** to prevent abuse:
   ```javascript
   // Example rate limiting middleware
   const rateLimit = require('express-rate-limit');
   
   const adminLimiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 10, // limit each IP to 10 requests per window
     message: 'Too many admin requests, please try again later'
   });
   
   app.use('/admin/', adminLimiter);
   ```

## Testing

### Test the broadcast in test mode first:
```bash
# Send to first 3 users only
curl -X POST http://localhost:3000/admin/broadcast \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: your_token" \
  -d '{
    "message": {"text": "Test broadcast message"},
    "testMode": true
  }'
```

### Monitor the logs:
```bash
# View broadcast progress in server logs
tail -f logs/app.log | grep "broadcast"
```

## Webhook Integration

If you want to trigger broadcasts from external services (like your admin dashboard), you can use webhooks:

### From GitHub Actions:
```yaml
- name: Send broadcast notification
  run: |
    curl -X POST ${{ secrets.BOT_URL }}/admin/broadcast \
      -H "Content-Type: application/json" \
      -H "X-Admin-Token: ${{ secrets.ADMIN_TOKEN }}" \
      -d '{
        "message": {
          "text": "🚀 New update deployed! Check out the latest features."
        }
      }'
```

### From Zapier/IFTTT:
Configure a webhook action with:
- URL: `https://your-bot.com/admin/broadcast`
- Method: `POST`
- Headers: `X-Admin-Token: your_token`
- Body: JSON with message structure

## Monitoring & Analytics

Track broadcast performance by storing results in the database:

```sql
-- View broadcast history
SELECT * FROM broadcast_messages
ORDER BY created_at DESC
LIMIT 10;

-- Success rate
SELECT 
  COUNT(*) as total_broadcasts,
  SUM(successful_sends) as total_sent,
  AVG(successful_sends::float / NULLIF(total_recipients, 0)) as avg_success_rate
FROM broadcast_messages
WHERE created_at > NOW() - INTERVAL '30 days';
```

## Support

For issues or questions:
1. Check server logs for detailed error messages
2. Verify admin token is correctly set in environment variables
3. Ensure Facebook Page Access Token has necessary permissions
4. Test with a single user ID first before broadcasting to all
