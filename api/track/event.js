const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { rateLimit, validateRequest } = require('../utils/rateLimit');

const DATABASE_PATH = '/tmp/analytics.db';

function initDB() {
  const dataDir = path.dirname(DATABASE_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = new Database(DATABASE_PATH);
  
  // Create table if not exists
  db.exec(`
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
  
  return db;
}

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
    const db = initDB();
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
    db.close();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking event:', error);
    res.status(500).json({ error: 'Failed to track event' });
  }
};