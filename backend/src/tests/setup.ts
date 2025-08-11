import { initializeDatabase, closeDatabaseConnection } from '../config/database';
import { EventData, SessionData, VisitorData, PageViewData } from '../types';

// Test database setup
process.env['NODE_ENV'] = 'test';
process.env['DB_NAME'] = 'analytics_test_db';

// Mock console methods to reduce test noise
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(async () => {
  // Suppress console output during tests unless explicitly needed
  console.log = jest.fn();
  console.error = jest.fn();
  
  try {
    // Initialize test database
    await initializeDatabase();
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
  await closeDatabaseConnection();
});

// Helper function to create test data
declare global {
  var createTestData: {
    visitor: (overrides?: Partial<VisitorData>) => Partial<VisitorData>;
    session: (overrides?: Partial<SessionData>) => Partial<SessionData>;
    event: (overrides?: Partial<EventData>) => Partial<EventData>;
    pageView: (overrides?: Partial<PageViewData>) => Partial<PageViewData>;
  };
}

global.createTestData = {
  visitor: (overrides: Partial<VisitorData> = {}): Partial<VisitorData> => ({
    id: 'test-visitor-' + Date.now(),
    first_visit: new Date(),
    last_visit: new Date(),
    total_sessions: 1,
    total_page_views: 0,
    user_agent: 'test-user-agent',
    ip_address: '127.0.0.1',
    geographic_data: { country: 'US', city: 'New York' },
    device_info: { browser: 'Chrome', os: 'Windows' },
    ...overrides
  }),
  
  session: (overrides: Partial<SessionData> = {}): Partial<SessionData> => ({
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
  
  event: (overrides: Partial<EventData> = {}): Partial<EventData> => ({
    session_id: 'test-session-' + Date.now(),
    event_type: 'page_view' as any,
    url: '/test-page',
    timestamp: new Date(),
    properties: { test: true },
    ...overrides
  }),
  
  pageView: (overrides: Partial<PageViewData> = {}): Partial<PageViewData> => ({
    session_id: 'test-session-' + Date.now(),
    url: '/test-page',
    title: 'Test Page',
    timestamp: new Date(),
    ...overrides
  })
};