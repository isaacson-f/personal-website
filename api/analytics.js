const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.STORAGE_SUPABASE_URL,
  process.env.STORAGE_NEXT_PUBLIC_SUPABASE_ANON_KEY
);

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-ID');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { method, url } = req;
  
  try {
    if (method === 'POST' && url.includes('/track/pageview')) {
      const { url: pageUrl, referrer, userAgent } = req.body;
      console.log(
        'Received pageview data:',
        { url: pageUrl, referrer, userAgent }
      )
      const { error } = await supabase
        .from('analytics_events')
        .insert({
          type: 'pageview',
          url: pageUrl,
          referrer: referrer,
          user_agent: userAgent,
          ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
          session_id: req.headers['x-session-id'] || null,
          timestamp: new Date().toISOString()
        });
      
      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({ error: 'Failed to track pageview' });
      }
      
      return res.json({ success: true });
      
    } else if (method === 'POST' && url.includes('/track/event')) {
      const { name, properties } = req.body;
      
      const { error } = await supabase
        .from('analytics_events')
        .insert({
          type: 'custom',
          event_name: name,
          properties: properties || {},
          user_agent: req.headers['user-agent'],
          ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
          session_id: req.headers['x-session-id'] || null,
          timestamp: new Date().toISOString()
        });
      
      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({ error: 'Failed to track event' });
      }
      
      return res.json({ success: true });
      
    } else if (method === 'GET' && url.includes('/analytics/summary')) {
      // Get total page views
      const { count: totalViews } = await supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'pageview');

      // Get today's page views
      const today = new Date().toISOString().split('T')[0];
      const { count: todayViews } = await supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'pageview')
        .gte('timestamp', `${today}T00:00:00.000Z`)
        .lt('timestamp', `${today}T23:59:59.999Z`);

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
      
      return res.json({
        totalViews: totalViews || 0,
        todayViews: todayViews || 0,
        topPages
      });
      
    } else {
      return res.status(404).json({ error: 'Not found' });
    }
    
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};