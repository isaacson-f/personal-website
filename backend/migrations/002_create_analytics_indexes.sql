-- Migration: Create performance indexes for analytics tables
-- Description: Creates indexes on frequently queried columns for optimal performance

-- Indexes for analytics_visitors table
CREATE INDEX IF NOT EXISTS idx_visitors_cookie_id ON analytics_visitors(cookie_id);
CREATE INDEX IF NOT EXISTS idx_visitors_first_visit ON analytics_visitors(first_visit);
CREATE INDEX IF NOT EXISTS idx_visitors_last_visit ON analytics_visitors(last_visit);
CREATE INDEX IF NOT EXISTS idx_visitors_browser_fingerprint ON analytics_visitors(browser_fingerprint);

-- Indexes for analytics_sessions table
CREATE INDEX IF NOT EXISTS idx_sessions_visitor_id ON analytics_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_cookie_id ON analytics_sessions(cookie_id);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON analytics_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_sessions_end_time ON analytics_sessions(end_time);
CREATE INDEX IF NOT EXISTS idx_sessions_is_returning ON analytics_sessions(is_returning_visitor);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON analytics_sessions(created_at);

-- Indexes for analytics_events table
CREATE INDEX IF NOT EXISTS idx_events_session_id ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_url ON analytics_events(url);
CREATE INDEX IF NOT EXISTS idx_events_url_hash ON analytics_events(url_hash);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON analytics_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_ip_address ON analytics_events(ip_address);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_events_session_timestamp ON analytics_events(session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type_timestamp ON analytics_events(event_type, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_url_timestamp ON analytics_events(url, timestamp);

-- Indexes for analytics_page_views table
CREATE INDEX IF NOT EXISTS idx_page_views_session_id ON analytics_page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_url ON analytics_page_views(url);
CREATE INDEX IF NOT EXISTS idx_page_views_url_hash ON analytics_page_views(url_hash);
CREATE INDEX IF NOT EXISTS idx_page_views_timestamp ON analytics_page_views(timestamp);
CREATE INDEX IF NOT EXISTS idx_page_views_exit_page ON analytics_page_views(exit_page);

-- Composite indexes for page views
CREATE INDEX IF NOT EXISTS idx_page_views_session_timestamp ON analytics_page_views(session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_page_views_url_timestamp ON analytics_page_views(url, timestamp);

-- JSONB indexes for properties and device info (using GIN indexes)
CREATE INDEX IF NOT EXISTS idx_events_properties ON analytics_events USING GIN (properties);
CREATE INDEX IF NOT EXISTS idx_sessions_device_info ON analytics_sessions USING GIN (device_info);
CREATE INDEX IF NOT EXISTS idx_sessions_geographic_data ON analytics_sessions USING GIN (geographic_data);