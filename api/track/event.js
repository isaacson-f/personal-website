const { kv } = require('@vercel/kv');
const { rateLimit, validateRequest } = require('../utils/rateLimit');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-ID');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting and validation
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  
  if (!rateLimit(clientIP, 30, 60000)) { // 30 requests per minute for events
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  
  if (!validateRequest(req)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    const { name, properties } = req.body;
    
    // Create event object
    const event = {
      type: 'custom',
      eventName: name,
      properties: properties || {},
      userAgent: req.headers['user-agent'],
      ipAddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      sessionId: req.headers['x-session-id'] || null,
      timestamp: new Date().toISOString()
    };
    
    // Store in KV with unique key
    const eventKey = `event:${Date.now()}:${Math.random().toString(36).substring(2)}`;
    await kv.set(eventKey, event);
    
    // Increment counters
    await kv.incr('stats:total_events');
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking event:', error);
    res.status(500).json({ error: 'Failed to track event' });
  }
};