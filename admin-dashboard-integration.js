// Admin Dashboard Integration Example
// This shows how your admin dashboard can send messages to all users via the webhook

// Example 1: Simple broadcast function for your admin dashboard
async function sendBroadcastMessage(message, targetUsers = 'onboarded', testMode = false) {
  const WEBHOOK_URL = process.env.EASELY_WEBHOOK_URL || 'http://localhost:3000';
  const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN;
  
  if (!ADMIN_TOKEN) {
    throw new Error('ADMIN_API_TOKEN not configured');
  }
  
  try {
    const response = await fetch(`${WEBHOOK_URL}/admin/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': ADMIN_TOKEN
      },
      body: JSON.stringify({
        message: {
          text: message
        },
        targetUsers: targetUsers, // 'all', 'onboarded', 'premium', or array of user IDs
        testMode: testMode
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Broadcast failed: ${error.error}`);
    }
    
    const result = await response.json();
    console.log('Broadcast initiated:', result);
    return result;
    
  } catch (error) {
    console.error('Error sending broadcast:', error);
    throw error;
  }
}

// Example 2: React component for admin dashboard
function BroadcastPanel() {
  const [message, setMessage] = useState('');
  const [targetUsers, setTargetUsers] = useState('onboarded');
  const [testMode, setTestMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    
    if (!message.trim()) {
      alert('Please enter a message');
      return;
    }
    
    setLoading(true);
    setResult(null);
    
    try {
      const response = await sendBroadcastMessage(message, targetUsers, testMode);
      setResult(response);
      setMessage(''); // Clear form on success
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="broadcast-panel">
      <h2>📢 Send Broadcast Message</h2>
      
      <form onSubmit={handleSendBroadcast}>
        <div className="form-group">
          <label htmlFor="message">Message:</label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter your broadcast message..."
            rows={4}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="target">Target Users:</label>
          <select 
            id="target"
            value={targetUsers} 
            onChange={(e) => setTargetUsers(e.target.value)}
          >
            <option value="onboarded">All Onboarded Users</option>
            <option value="premium">Premium Users Only</option>
            <option value="all">All Users</option>
          </select>
        </div>
        
        <div className="form-group">
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
        <div className="result">
          <h3>Broadcast Result:</h3>
          <p>✅ Broadcast initiated successfully!</p>
          <p>Target Users: {result.totalUsers}</p>
          <p>Test Mode: {result.testMode ? 'Yes' : 'No'}</p>
        </div>
      )}
    </div>
  );
}

// Example 3: Node.js/Express admin dashboard endpoint
app.post('/admin/send-broadcast', async (req, res) => {
  try {
    const { message, targetUsers = 'onboarded', testMode = false } = req.body;
    
    // Your admin authentication logic here
    if (!req.session.isAdmin) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Send to webhook
    const result = await sendBroadcastMessage(message, targetUsers, testMode);
    
    // Log the broadcast action
    console.log(`Admin ${req.session.adminId} sent broadcast: "${message.substring(0, 50)}..."`);
    
    res.json({
      success: true,
      message: 'Broadcast sent successfully',
      details: result
    });
    
  } catch (error) {
    console.error('Admin broadcast error:', error);
    res.status(500).json({ 
      error: 'Failed to send broadcast',
      details: error.message 
    });
  }
});

// Example 4: Command line broadcast tool
async function sendBroadcastFromCLI() {
  const args = process.argv.slice(2);
  const message = args[0];
  const targetUsers = args[1] || 'onboarded';
  const testMode = args.includes('--test');
  
  if (!message) {
    console.log('Usage: node broadcast.js "Your message" [targetUsers] [--test]');
    console.log('Example: node broadcast.js "Hello everyone!" onboarded --test');
    return;
  }
  
  try {
    const result = await sendBroadcastMessage(message, targetUsers, testMode);
    console.log('Broadcast sent successfully:', result);
  } catch (error) {
    console.error('Failed to send broadcast:', error.message);
    process.exit(1);
  }
}

// Example 5: Scheduled broadcasts with cron
const cron = require('node-cron');

// Send weekly digest every Sunday at 6 PM
cron.schedule('0 18 * * 0', async () => {
  const weeklyMessage = `📅 Weekly Digest\n\nHere's what's coming up this week! Check your tasks and stay on top of your assignments.\n\nHave a great week! 🚀`;
  
  try {
    await sendBroadcastMessage(weeklyMessage, 'onboarded', false);
    console.log('Weekly digest sent successfully');
  } catch (error) {
    console.error('Failed to send weekly digest:', error);
  }
});

module.exports = {
  sendBroadcastMessage,
  BroadcastPanel
};
