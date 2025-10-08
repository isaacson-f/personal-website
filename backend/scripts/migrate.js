require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DATABASE_PATH = process.env.DATABASE_PATH || './data/analytics.db';

// Ensure data directory exists
const dataDir = path.dirname(DATABASE_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(DATABASE_PATH);

console.log('Running database migrations...');

// Create events table
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
  `, (err) => {
    if (err) {
      console.error('Error creating events table:', err);
    } else {
      console.log('Events table created/verified');
    }
  });

  // Create indexes for better performance
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type)
  `);
  
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)
  `);
  
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_events_url ON events(url)
  `);
  
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id)
  `, (err) => {
    if (err) {
      console.error('Error creating indexes:', err);
    } else {
      console.log('Database indexes created/verified');
    }
    
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Migration completed successfully');
      }
    });
  });
});