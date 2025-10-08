const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Use /tmp for serverless environment
const DATABASE_PATH = '/tmp/analytics.db';

let db;

// Initialize database
function initDB() {
  if (!db) {
    // Ensure directory exists
    const dataDir = path.dirname(DATABASE_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    db = new sqlite3.Database(DATABASE_PATH);
    
    // Create table if not exists
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          url TEXT,
          title TEXT,
          referrer TEXT,
          event_name TEXT,
          properties TEXT,
          user_agent TEXT,
          ip_address TEXT,
          session_id TEXT,
          timestamp TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create indexes
      db.run(`CREATE INDEX IF NOT EXISTS idx_events_type ON events(type)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_events_url ON events(url)`);
    });
  }
  return db;
}

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-ID');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const db = initDB();
  const { method, url } = req;
  
  try {
    if (method === 'POST' && url.includes('/track/pageview')) {
      const { url: pageUrl, title, referrer, userAgent } = req.body;
      
      const stmt = db.prepare(`
        INSERT INTO events (type, url, title, referrer, user_agent, ip_address, session_id, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        'pageview',
        pageUrl,
        title,
        referrer,
        userAgent,
        req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        req.headers['x-session-id'] || null,
        new Date().toISOString()
      );
      
      stmt.finalize();
      return res.json({ success: true });
      
    } else if (method === 'POST' && url.includes('/track/event')) {
      const { name, properties } = req.body;
      
      const stmt = db.prepare(`
        INSERT INTO events (type, event_name, properties, user_agent, ip_address, session_id, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        'custom',
        name,
        JSON.stringify(properties || {}),
        req.headers['user-agent'],
        req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        req.headers['x-session-id'] || null,
        new Date().toISOString()
      );
      
      stmt.finalize();
      return res.json({ success: true });
      
    } else if (method === 'GET' && url.includes('/analytics/summary')) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();
      
      // Get analytics data
      return new Promise((resolve) => {
        db.get("SELECT COUNT(*) as count FROM events WHERE type = 'pageview'", (err, totalResult) => {
          if (err) throw err;
          
          db.get("SELECT COUNT(*) as count FROM events WHERE type = 'pageview' AND timestamp >= ?", [todayISO], (err, todayResult) => {
            if (err) throw err;
            
            db.all(`
              SELECT url, COUNT(*) as views 
              FROM events 
              WHERE type = 'pageview' AND url IS NOT NULL
              GROUP BY url 
              ORDER BY views DESC 
              LIMIT 10
            `, (err, topPages) => {
              if (err) throw err;
              
              res.json({
                totalViews: totalResult.count,
                todayViews: todayResult.count,
                topPages: topPages.map(p => ({ url: p.url, views: p.views }))
              });
              resolve();
            });
          });
        });
      });
      
    } else {
      return res.status(404).json({ error: 'Not found' });
    }
    
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};