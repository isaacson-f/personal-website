const { kv } = require('@vercel/kv');
const { rateLimit } = require('../utils/rateLimit');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting for analytics endpoint
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  
  if (!rateLimit(clientIP, 10, 60000)) { // 10 requests per minute for analytics
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  try {
    // Get stats from KV
    const totalPageViews = await kv.get('stats:total_pageviews') || 0;
    const totalEvents = await kv.get('stats:total_events') || 0;
    
    const today = new Date().toISOString().split('T')[0];
    const todayViews = await kv.get(`stats:daily:${today}`) || 0;
    
    // For now, return basic stats (top pages would require more complex KV queries)
    res.json({
      totalPageViews: totalPageViews,
      totalEvents: totalEvents,
      todayViews: todayViews,
      uniqueVisitors: Math.floor(totalPageViews * 0.7), // Rough estimate
      topPages: [] // Would need more complex implementation
    });
    
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
};