const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { rateLimit } = require('../utils/rateLimit');

const DATABASE_PATH = '/tmp/analytics.db';

function initDB() {
  const dataDir = path.dirname(DATABASE_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = new sqlite3.Database(DATABASE_PATH);
  
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
  });
  
  return db;
}

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
    const db = initDB();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    
    return new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) as count FROM events WHERE type = 'pageview'", (err, totalResult) => {
        if (err) return reject(err);
        
        db.get("SELECT COUNT(*) as count FROM events WHERE type = 'pageview' AND timestamp >= ?", [todayISO], (err, todayResult) => {
          if (err) return reject(err);
          
          db.all(`
            SELECT url, COUNT(*) as views 
            FROM events 
            WHERE type = 'pageview' AND url IS NOT NULL
            GROUP BY url 
            ORDER BY views DESC 
            LIMIT 10
          `, (err, topPages) => {
            if (err) return reject(err);
            
            db.close();
            
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
    
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
};