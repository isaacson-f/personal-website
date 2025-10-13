const { createClient } = require('@supabase/supabase-js');
const { rateLimit, validateRequest } = require('../utils/rateLimit');
const { addSecurityHeaders, sanitizeInput, isValidUrl } = require('../utils/security');

// Initialize Supabase client
const supabase = createClient(
  process.env.STORAGE_SUPABASE_URL,
  process.env.STORAGE_NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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
    
    // Insert into Supabase
    const { error } = await supabase
      .from('analytics_events')
      .insert({
        type: 'pageview',
        url: sanitizeInput(url),
        title: sanitizeInput(title),
        referrer: sanitizeInput(referrer),
        user_agent: sanitizeInput(userAgent),
        ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        session_id: sanitizeInput(req.headers['x-session-id']) || null,
        timestamp: new Date().toISOString()
      });
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to track event' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking pageview:', error);
    res.status(500).json({ error: 'Failed to track event' });
  }
};