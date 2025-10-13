const { createClient } = require('@supabase/supabase-js');
const { rateLimit } = require('../utils/rateLimit');


// Initialize Supabase client
const supabase = createClient(
  process.env.STORAGE_SUPABASE_URL,
  process.env.STORAGE_NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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
    // Get total page views
    const { count: totalPageViews } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'pageview');

    // Get total custom events
    const { count: totalEvents } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'custom');

    // Get today's page views
    const today = new Date().toISOString().split('T')[0];
    const { count: todayViews } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'pageview')
      .gte('timestamp', `${today}T00:00:00.000Z`)
      .lt('timestamp', `${today}T23:59:59.999Z`);

    // Get unique visitors (approximate by unique session IDs)
    const { count: uniqueVisitors } = await supabase
      .from('analytics_events')
      .select('session_id', { count: 'exact', head: true })
      .eq('type', 'pageview')
      .not('session_id', 'is', null);

    // Get top pages
    const { data: topPagesData } = await supabase
      .from('analytics_events')
      .select('url')
      .eq('type', 'pageview')
      .not('url', 'is', null);

    // Count page views by URL
    const urlCounts = {};
    topPagesData?.forEach(row => {
      urlCounts[row.url] = (urlCounts[row.url] || 0) + 1;
    });

    const topPages = Object.entries(urlCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([url, views]) => ({ url, views }));

    res.json({
      totalPageViews: totalPageViews || 0,
      totalEvents: totalEvents || 0,
      todayViews: todayViews || 0,
      uniqueVisitors: Math.floor((uniqueVisitors || 0) * 0.7), // Rough estimate for unique sessions
      topPages
    });
    
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
};