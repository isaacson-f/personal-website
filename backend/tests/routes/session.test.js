const request = require('supertest');
const Session = require('../../models/Session');
const Visitor = require('../../models/Visitor');

// Mock the models
jest.mock('../../models/Session');
jest.mock('../../models/Visitor');

// Mock the database and health config to avoid connection issues
jest.mock('../../config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
  checkDatabaseHealth: jest.fn().mockResolvedValue({ status: 'healthy' }),
  initializeDatabase: jest.fn().mockResolvedValue(true),
  closeDatabaseConnection: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../config/health', () => ({
  initializeSystem: jest.fn().mockResolvedValue(true)
}));

// Import app after mocking
const app = require('../../server');

describe('Session Management Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/session/start', () => {
    it('should create a new session successfully', async () => {
      const mockSession = {
        id: 'test-session-id',
        visitor_id: 'test-visitor-id',
        start_time: new Date(),
        is_returning_visitor: false
      };

      Session.create.mockResolvedValue(mockSession);
      Visitor.findById.mockResolvedValue(null); // New visitor

      const sessionData = {
        visitor_id: 'test-visitor-id',
        cookie_id: 'test-cookie-id',
        browser_fingerprint: 'test-fingerprint',
        device_info: { browser: 'Chrome', os: 'Windows' },
        geographic_data: { country: 'US', city: 'New York' }
      };

      const response = await request(app)
        .post('/api/session/start')
        .send(sessionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.session_id).toBe('test-session-id');
      expect(response.body.data.visitor_id).toBe('test-visitor-id');
      expect(response.body.data.is_returning_visitor).toBe(false);
      expect(Session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          visitor_id: 'test-visitor-id',
          cookie_id: 'test-cookie-id',
          browser_fingerprint: 'test-fingerprint',
          is_returning_visitor: false
        })
      );
    });

    it('should identify returning visitor', async () => {
      const mockSession = {
        id: 'test-session-id',
        visitor_id: 'existing-visitor-id',
        start_time: new Date(),
        is_returning_visitor: true
      };

      const mockExistingVisitor = {
        id: 'existing-visitor-id',
        first_visit: new Date('2023-01-01')
      };

      Session.create.mockResolvedValue(mockSession);
      Visitor.findById.mockResolvedValue(mockExistingVisitor);

      const sessionData = {
        visitor_id: 'existing-visitor-id',
        cookie_id: 'test-cookie-id'
      };

      const response = await request(app)
        .post('/api/session/start')
        .send(sessionData)
        .expect(201);

      expect(response.body.data.is_returning_visitor).toBe(true);
      expect(Visitor.findById).toHaveBeenCalledWith('existing-visitor-id');
    });

    it('should handle session creation without visitor_id', async () => {
      const mockSession = {
        id: 'test-session-id',
        visitor_id: null,
        start_time: new Date(),
        is_returning_visitor: false
      };

      Session.create.mockResolvedValue(mockSession);

      const sessionData = {
        cookie_id: 'test-cookie-id',
        browser_fingerprint: 'test-fingerprint'
      };

      const response = await request(app)
        .post('/api/session/start')
        .send(sessionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.visitor_id).toBeNull();
      expect(response.body.data.is_returning_visitor).toBe(false);
    });

    it('should handle session creation errors', async () => {
      Session.create.mockRejectedValue(new Error('Database error'));

      const sessionData = {
        visitor_id: 'test-visitor-id'
      };

      const response = await request(app)
        .post('/api/session/start')
        .send(sessionData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });
  });

  describe('PUT /api/session/update', () => {
    it('should update session successfully', async () => {
      const mockExistingSession = {
        id: 'test-session-id',
        page_views: 1,
        duration_seconds: null
      };

      const mockUpdatedSession = {
        id: 'test-session-id',
        page_views: 2,
        duration_seconds: 120
      };

      Session.findById.mockResolvedValue(mockExistingSession);
      Session.update.mockResolvedValue(mockUpdatedSession);

      const updateData = {
        session_id: 'test-session-id',
        page_views: 2,
        duration_seconds: 120
      };

      const response = await request(app)
        .put('/api/session/update')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.session_id).toBe('test-session-id');
      expect(response.body.data.page_views).toBe(2);
      expect(response.body.data.duration_seconds).toBe(120);
      expect(Session.update).toHaveBeenCalledWith('test-session-id', {
        page_views: 2,
        duration_seconds: 120
      });
    });

    it('should return error when session_id is missing', async () => {
      const updateData = {
        page_views: 2
      };

      const response = await request(app)
        .put('/api/session/update')
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Session ID is required');
    });

    it('should return error when session not found', async () => {
      Session.findById.mockResolvedValue(null);

      const updateData = {
        session_id: 'non-existent-session',
        page_views: 2
      };

      const response = await request(app)
        .put('/api/session/update')
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Session not found');
    });

    it('should handle update errors', async () => {
      const mockExistingSession = {
        id: 'test-session-id',
        page_views: 1
      };

      Session.findById.mockResolvedValue(mockExistingSession);
      Session.update.mockRejectedValue(new Error('Update failed'));

      const updateData = {
        session_id: 'test-session-id',
        page_views: 2
      };

      const response = await request(app)
        .put('/api/session/update')
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Update failed');
    });
  });

  describe('POST /api/session/end', () => {
    it('should end session successfully', async () => {
      const mockExistingSession = {
        id: 'test-session-id',
        start_time: new Date('2023-01-01T10:00:00Z'),
        end_time: null,
        page_views: 3
      };

      const mockEndedSession = {
        id: 'test-session-id',
        start_time: new Date('2023-01-01T10:00:00Z'),
        end_time: new Date('2023-01-01T10:30:00Z'),
        duration_seconds: 1800,
        page_views: 3
      };

      Session.findById.mockResolvedValue(mockExistingSession);
      Session.endSession.mockResolvedValue(mockEndedSession);

      const endData = {
        session_id: 'test-session-id'
      };

      const response = await request(app)
        .post('/api/session/end')
        .send(endData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.session_id).toBe('test-session-id');
      expect(response.body.data.duration_seconds).toBe(1800);
      expect(response.body.data.page_views).toBe(3);
      expect(Session.endSession).toHaveBeenCalledWith('test-session-id', null);
    });

    it('should end session with custom end time', async () => {
      const mockExistingSession = {
        id: 'test-session-id',
        start_time: new Date('2023-01-01T10:00:00Z'),
        end_time: null
      };

      const customEndTime = '2023-01-01T10:45:00Z';
      const mockEndedSession = {
        id: 'test-session-id',
        start_time: new Date('2023-01-01T10:00:00Z'),
        end_time: new Date(customEndTime),
        duration_seconds: 2700
      };

      Session.findById.mockResolvedValue(mockExistingSession);
      Session.endSession.mockResolvedValue(mockEndedSession);

      const endData = {
        session_id: 'test-session-id',
        end_time: customEndTime
      };

      const response = await request(app)
        .post('/api/session/end')
        .send(endData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Session.endSession).toHaveBeenCalledWith('test-session-id', new Date(customEndTime));
    });

    it('should return error when session_id is missing', async () => {
      const endData = {};

      const response = await request(app)
        .post('/api/session/end')
        .send(endData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Session ID is required');
    });

    it('should return error when session not found', async () => {
      Session.findById.mockResolvedValue(null);

      const endData = {
        session_id: 'non-existent-session'
      };

      const response = await request(app)
        .post('/api/session/end')
        .send(endData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Session not found');
    });

    it('should return error when session is already ended', async () => {
      const mockEndedSession = {
        id: 'test-session-id',
        start_time: new Date('2023-01-01T10:00:00Z'),
        end_time: new Date('2023-01-01T10:30:00Z')
      };

      Session.findById.mockResolvedValue(mockEndedSession);

      const endData = {
        session_id: 'test-session-id'
      };

      const response = await request(app)
        .post('/api/session/end')
        .send(endData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Session is already ended');
    });

    it('should handle end session errors', async () => {
      const mockExistingSession = {
        id: 'test-session-id',
        end_time: null
      };

      Session.findById.mockResolvedValue(mockExistingSession);
      Session.endSession.mockRejectedValue(new Error('End session failed'));

      const endData = {
        session_id: 'test-session-id'
      };

      const response = await request(app)
        .post('/api/session/end')
        .send(endData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('End session failed');
    });
  });

  describe('GET /api/session/:id', () => {
    it('should retrieve session successfully', async () => {
      const mockSession = {
        id: 'test-session-id',
        visitor_id: 'test-visitor-id',
        start_time: new Date(),
        page_views: 2,
        duration_seconds: 300
      };

      Session.findById.mockResolvedValue(mockSession);

      const response = await request(app)
        .get('/api/session/test-session-id')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('test-session-id');
      expect(response.body.data.visitor_id).toBe('test-visitor-id');
      expect(Session.findById).toHaveBeenCalledWith('test-session-id');
    });

    it('should return error when session not found', async () => {
      Session.findById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/session/non-existent-session')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Session not found');
    });

    it('should handle retrieval errors', async () => {
      Session.findById.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/session/test-session-id')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to retrieve session');
    });
  });
});