require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATABASE_PATH = process.env.DATABASE_PATH || './data/analytics.db';

// Ensure data directory exists
const dataDir = path.dirname(DATABASE_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize SQLite database
const db = new sqlite3.Database(DATABASE_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*'
}));
app.use(express.json({ limit: '10mb' }));

// Track page view
app.post('/track/pageview', (req, res) => {
  try {
    const { url, title, referrer, userAgent } = req.body;
    
    const stmt = db.prepare(`
      INSERT INTO events (type, url, title, referrer, user_agent, ip_address, session_id, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      'pageview',
      url,
      title,
      referrer,
      userAgent,
      req.ip || req.connection.remoteAddress,
      req.headers['x-session-id'] || null,
      new Date().toISOString()
    );
    
    stmt.finalize();
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking pageview:', error);
    res.status(500).json({ error: 'Failed to track event' });
  }
});

// Track custom event
app.post('/track/event', (req, res) => {
  try {
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
      req.ip || req.connection.remoteAddress,
      req.headers['x-session-id'] || null,
      new Date().toISOString()
    );
    
    stmt.finalize();
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking event:', error);
    res.status(500).json({ error: 'Failed to track event' });
  }
});

// Get basic analytics
app.get('/analytics/summary', (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    
    // Get total page views
    db.get("SELECT COUNT(*) as count FROM events WHERE type = 'pageview'", (err, totalResult) => {
      if (err) throw err;
      
      // Get today's page views
      db.get("SELECT COUNT(*) as count FROM events WHERE type = 'pageview' AND timestamp >= ?", [todayISO], (err, todayResult) => {
        if (err) throw err;
        
        // Get top pages
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
        });
      });
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`Analytics server running on port ${PORT}`);
});