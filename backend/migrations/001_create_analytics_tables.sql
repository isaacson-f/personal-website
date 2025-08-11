-- Migration: Create analytics tables
-- Description: Creates the core analytics tables for tracking events, sessions, visitors, and page views

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create analytics_visitors table
CREATE TABLE IF NOT EXISTS analytics_visitors (
  id VARCHAR(255) PRIMARY KEY,
  cookie_id VARCHAR(255) UNIQUE,
  first_visit TIMESTAMP WITH TIME ZONE NOT NULL,
  last_visit TIMESTAMP WITH TIME ZONE NOT NULL,
  total_sessions INTEGER DEFAULT 1,
  total_page_views INTEGER DEFAULT 0,
  browser_fingerprint VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create analytics_sessions table
CREATE TABLE IF NOT EXISTS analytics_sessions (
  id VARCHAR(255) PRIMARY KEY,
  visitor_id VARCHAR(255),
  cookie_id VARCHAR(255),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  page_views INTEGER DEFAULT 0,
  duration_seconds INTEGER,
  browser_fingerprint VARCHAR(255),
  device_info JSONB,
  geographic_data JSONB,
  is_returning_visitor BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (visitor_id) REFERENCES analytics_visitors(id) ON DELETE CASCADE
);

-- Create analytics_events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  url TEXT NOT NULL,
  url_hash VARCHAR(255),
  referrer TEXT,
  user_agent TEXT,
  ip_address INET,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  properties JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (session_id) REFERENCES analytics_sessions(id) ON DELETE CASCADE
);

-- Create analytics_page_views table
CREATE TABLE IF NOT EXISTS analytics_page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  url_hash VARCHAR(255),
  title VARCHAR(500),
  load_time INTEGER,
  scroll_depth INTEGER,
  time_on_page INTEGER,
  exit_page BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (session_id) REFERENCES analytics_sessions(id) ON DELETE CASCADE
);