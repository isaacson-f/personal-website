const Session = require('../../models/Session');
const Visitor = require('../../models/Visitor');

describe('Session Model', () => {
  let testSession;
  let testVisitor;

  beforeEach(async () => {
    testVisitor = await Visitor.create(createTestData.visitor());
    testSession = createTestData.session({ visitor_id: testVisitor.id });
  });

  describe('create', () => {
    it('should create a new session with valid data', async () => {
      const session = await Session.create(testSession);
      
      expect(session).toBeDefined();
      expect(session.id).toBe(testSession.id);
      expect(session.visitor_id).toBe(testSession.visitor_id);
      expect(session.page_views).toBe(0);
      expect(session.is_returning_visitor).toBe(false);
    });

    it('should throw error with invalid data', async () => {
      const invalidData = { ...testSession, id: null };
      
      await expect(Session.create(invalidData)).rejects.toThrow('Validation failed');
    });

    it('should handle JSONB fields correctly', async () => {
      const sessionWithData = {
        ...testSession,
        device_info: { browser: 'Chrome', version: '91.0' },
        geographic_data: { country: 'US', region: 'CA' }
      };
      
      const session = await Session.create(sessionWithData);
      
      expect(session.device_info).toBeDefined();
      expect(session.geographic_data).toBeDefined();
    });
  });

  describe('findById', () => {
    it('should find session by ID', async () => {
      const createdSession = await Session.create(testSession);
      const foundSession = await Session.findById(createdSession.id);
      
      expect(foundSession).toBeDefined();
      expect(foundSession.id).toBe(createdSession.id);
    });

    it('should return null for non-existent ID', async () => {
      const session = await Session.findById('non-existent-id');
      expect(session).toBeNull();
    });
  });

  describe('findActiveByVisitor', () => {
    it('should find active sessions for visitor', async () => {
      const createdSession = await Session.create(testSession);
      const activeSessions = await Session.findActiveByVisitor(testVisitor.id);
      
      expect(activeSessions).toBeDefined();
      expect(activeSessions.length).toBeGreaterThan(0);
      expect(activeSessions[0].id).toBe(createdSession.id);
    });
  });

  describe('update', () => {
    it('should update session data', async () => {
      const createdSession = await Session.create(testSession);
      const updates = {
        page_views: 5,
        device_info: { browser: 'Firefox' }
      };
      
      const updatedSession = await Session.update(createdSession.id, updates);
      
      expect(updatedSession.page_views).toBe(5);
      expect(updatedSession.device_info).toBeDefined();
    });
  });

  describe('endSession', () => {
    it('should end a session and calculate duration', async () => {
      const createdSession = await Session.create(testSession);
      const endedSession = await Session.endSession(createdSession.id);
      
      expect(endedSession.end_time).toBeDefined();
      expect(endedSession.duration_seconds).toBeGreaterThanOrEqual(0);
    });
  });

  describe('incrementPageViews', () => {
    it('should increment page view count', async () => {
      const createdSession = await Session.create(testSession);
      const updatedSession = await Session.incrementPageViews(createdSession.id, 2);
      
      expect(updatedSession.page_views).toBe(2);
    });
  });

  describe('getStatistics', () => {
    it('should return session statistics', async () => {
      await Session.create(testSession);
      
      const stats = await Session.getStatistics();
      
      expect(stats).toBeDefined();
      expect(parseInt(stats.total_sessions)).toBeGreaterThanOrEqual(1);
      expect(stats.avg_page_views_per_session).toBeDefined();
    });
  });

  describe('getActiveSessionsCount', () => {
    it('should return count of active sessions', async () => {
      await Session.create(testSession);
      
      const count = await Session.getActiveSessionsCount();
      
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('endExpiredSessions', () => {
    it('should end expired sessions', async () => {
      // Create a session with old start time
      const oldSession = {
        ...testSession,
        id: 'old-session-' + Date.now(),
        start_time: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
      };
      
      await Session.create(oldSession);
      
      const endedCount = await Session.endExpiredSessions(60); // 60 minute timeout
      
      expect(endedCount).toBeGreaterThanOrEqual(1);
    });
  });
});