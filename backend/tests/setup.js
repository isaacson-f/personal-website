const { initializeSystem } = require('../config/health');

// Test database setup
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'analytics_test_db';

// Mock console methods to reduce test noise
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(async () => {
  // Suppress console output during tests unless explicitly needed
  console.log = jest.fn();
  console.error = jest.fn();
  
  try {
    // Initialize test database
    await initializeSystem();
  } catch (error) {
    // Restore console for error reporting
    console.error = originalConsoleError;
    console.error('Failed to initialize test database:', error);
    throw error;
  }
});

afterAll(async () => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  
  // Close database connections
  const { closeDatabaseConnection } = require('../config/database');
  await closeDatabaseConnection();
});

// Helper function to create test data
global.createTestData = {
  visitor: (overrides = {}) => ({
    id: 'test-visitor-' + Date.now(),
    cookie_id: 'test-cookie-' + Date.now(),
    first_visit: new Date(),
    last_visit: new Date(),
    total_sessions: 1,
    total_page_views: 0,
    browser_fingerprint: 'test-fingerprint',
    ...overrides
  }),
  
  session: (overrides = {}) => ({
    id: 'test-session-' + Date.now(),
    visitor_id: 'test-visitor-' + Date.now(),
    cookie_id: 'test-cookie-' + Date.now(),
    start_time: new Date(),
    page_views: 0,
    is_returning_visitor: false,
    device_info: { browser: 'Chrome', os: 'Windows' },
    geographic_data: { country: 'US', city: 'New York' },
    ...overrides
  }),
  
  event: (overrides = {}) => ({
    session_id: 'test-session-' + Date.now(),
    event_type: 'page_view',
    url: '/test-page',
    timestamp: new Date(),
    properties: { test: true },
    ...overrides
  }),
  
  pageView: (overrides = {}) => ({
    session_id: 'test-session-' + Date.now(),
    url: '/test-page',
    title: 'Test Page',
    timestamp: new Date(),
    ...overrides
  })
};