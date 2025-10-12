const { kv } = require('@vercel/kv');
const { rateLimit, validateRequest } = require('../utils/rateLimit');
const { addSecurityHeaders, sanitizeInput, isValidUrl } = require('../utils/security');

module.exports = async (req, res) => {
  addSecurityHeaders(res);
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
  
  if (!rateLimit(clientIP, 50, 60000)) { // 50 requests per minute
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  
  if (!validateRequest(req)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    const { url, title, referrer, userAgent } = req.body;
    
    // Validate and sanitize inputs
    if (!url || !isValidUrl(url)) {
      return res.status(400).json({ error: 'Invalid URL' });
    }
    
    // Create event object
    const event = {
      type: 'pageview',
      url: sanitizeInput(url),
      title: sanitizeInput(title),
      referrer: sanitizeInput(referrer),
      userAgent: sanitizeInput(userAgent),
      ipAddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      sessionId: sanitizeInput(req.headers['x-session-id']) || null,
      timestamp: new Date().toISOString()
    };
    
    // Store in KV with unique key
    const eventKey = `event:${Date.now()}:${Math.random().toString(36).substring(2)}`;
    await kv.set(eventKey, event);
    
    // Increment counters
    await kv.incr('stats:total_pageviews');
    const today = new Date().toISOString().split('T')[0];
    await kv.incr(`stats:daily:${today}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking pageview:', error);
    res.status(500).json({ error: 'Failed to track event' });
  }
};