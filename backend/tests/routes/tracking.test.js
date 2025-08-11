const request = require('supertest');
const Event = require('../../models/Event');
const PageView = require('../../models/PageView');

// Mock the models
jest.mock('../../models/Event');
jest.mock('../../models/PageView');

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

describe('Event Tracking Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/track/event', () => {
    it('should track custom event successfully', async () => {
      const mockEvent = {
        id: 'test-event-id',
        session_id: 'test-session-id',
        event_type: 'click',
        url: '/test-page',
        timestamp: new Date()
      };

      Event.create.mockResolvedValue(mockEvent);

      const eventData = {
        session_id: 'test-session-id',
        event_type: 'click',
        url: '/test-page',
        url_hash: '#section1',
        properties: {
          element: 'button',
          text: 'Click me'
        }
      };

      const response = await request(app)
        .post('/api/track/event')
        .send(eventData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.event_id).toBe('test-event-id');
      expect(response.body.data.session_id).toBe('test-session-id');
      expect(response.body.data.event_type).toBe('click');
      expect(Event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'test-session-id',
          event_type: 'click',
          url: '/test-page',
          url_hash: '#section1',
          properties: {
            element: 'button',
            text: 'Click me'
          },
          user_agent: null,
          referrer: null
        })
      );
    });

    it('should track event with client information from headers', async () => {
      const mockEvent = {
        id: 'test-event-id',
        session_id: 'test-session-id',
        event_type: 'scroll',
        url: '/test-page',
        timestamp: new Date()
      };

      Event.create.mockResolvedValue(mockEvent);

      const eventData = {
        session_id: 'test-session-id',
        event_type: 'scroll',
        url: '/test-page',
        properties: { depth: 75 }
      };

      const response = await request(app)
        .post('/api/track/event')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        .set('Referer', 'https://example.com/previous-page')
        .send(eventData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(Event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          referrer: 'https://example.com/previous-page'
        })
      );
    });

    it('should return error when session_id is missing', async () => {
      const eventData = {
        event_type: 'click',
        url: '/test-page'
      };

      const response = await request(app)
        .post('/api/track/event')
        .send(eventData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Session ID is required');
      expect(Event.create).not.toHaveBeenCalled();
    });

    it('should return error when event_type is missing', async () => {
      const eventData = {
        session_id: 'test-session-id',
        url: '/test-page'
      };

      const response = await request(app)
        .post('/api/track/event')
        .send(eventData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Event type is required');
      expect(Event.create).not.toHaveBeenCalled();
    });

    it('should return error when url is missing', async () => {
      const eventData = {
        session_id: 'test-session-id',
        event_type: 'click'
      };

      const response = await request(app)
        .post('/api/track/event')
        .send(eventData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('URL is required');
      expect(Event.create).not.toHaveBeenCalled();
    });

    it('should handle event creation errors', async () => {
      Event.create.mockRejectedValue(new Error('Database error'));

      const eventData = {
        session_id: 'test-session-id',
        event_type: 'click',
        url: '/test-page'
      };

      const response = await request(app)
        .post('/api/track/event')
        .send(eventData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });

    it('should handle custom timestamp', async () => {
      const customTimestamp = '2023-01-01T12:00:00Z';
      const mockEvent = {
        id: 'test-event-id',
        session_id: 'test-session-id',
        event_type: 'custom',
        url: '/test-page',
        timestamp: new Date(customTimestamp)
      };

      Event.create.mockResolvedValue(mockEvent);

      const eventData = {
        session_id: 'test-session-id',
        event_type: 'custom',
        url: '/test-page',
        timestamp: customTimestamp
      };

      const response = await request(app)
        .post('/api/track/event')
        .send(eventData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(Event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: new Date(customTimestamp)
        })
      );
    });
  });

  describe('POST /api/track/page', () => {
    it('should track page view successfully', async () => {
      const mockPageView = {
        id: 'test-pageview-id',
        session_id: 'test-session-id',
        url: '/test-page',
        timestamp: new Date()
      };

      const mockEvent = {
        id: 'test-event-id',
        session_id: 'test-session-id',
        event_type: 'page_view',
        url: '/test-page',
        timestamp: new Date()
      };

      // Mock EVENT_TYPES
      Event.EVENT_TYPES = {
        PAGE_VIEW: 'page_view',
        CLICK: 'click',
        SCROLL: 'scroll'
      };

      PageView.create.mockResolvedValue(mockPageView);
      Event.create.mockResolvedValue(mockEvent);

      const pageData = {
        session_id: 'test-session-id',
        url: '/test-page',
        title: 'Test Page',
        load_time: 1500,
        scroll_depth: 50
      };

      const response = await request(app)
        .post('/api/track/page')
        .send(pageData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.page_view_id).toBe('test-pageview-id');
      expect(response.body.data.event_id).toBe('test-event-id');
      expect(response.body.data.session_id).toBe('test-session-id');
      expect(response.body.data.url).toBe('/test-page');

      expect(PageView.create).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'test-session-id',
          url: '/test-page',
          title: 'Test Page',
          load_time: 1500,
          scroll_depth: 50,
          exit_page: false
        })
      );

      expect(Event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'test-session-id',
          event_type: 'page_view',
          url: '/test-page',
          properties: expect.objectContaining({
            title: 'Test Page',
            load_time: 1500,
            scroll_depth: 50,
            exit_page: false
          })
        })
      );
    });

    it('should track page view with minimal data', async () => {
      const mockPageView = {
        id: 'test-pageview-id',
        session_id: 'test-session-id',
        url: '/simple-page',
        timestamp: new Date()
      };

      const mockEvent = {
        id: 'test-event-id',
        session_id: 'test-session-id',
        event_type: 'page_view',
        url: '/simple-page',
        timestamp: new Date()
      };

      Event.EVENT_TYPES = { PAGE_VIEW: 'page_view' };
      PageView.create.mockResolvedValue(mockPageView);
      Event.create.mockResolvedValue(mockEvent);

      const pageData = {
        session_id: 'test-session-id',
        url: '/simple-page'
      };

      const response = await request(app)
        .post('/api/track/page')
        .send(pageData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(PageView.create).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'test-session-id',
          url: '/simple-page',
          title: null,
          load_time: null,
          scroll_depth: null,
          time_on_page: null,
          exit_page: false
        })
      );
    });

    it('should return error when session_id is missing', async () => {
      const pageData = {
        url: '/test-page'
      };

      const response = await request(app)
        .post('/api/track/page')
        .send(pageData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Session ID is required');
      expect(PageView.create).not.toHaveBeenCalled();
      expect(Event.create).not.toHaveBeenCalled();
    });

    it('should return error when url is missing', async () => {
      const pageData = {
        session_id: 'test-session-id'
      };

      const response = await request(app)
        .post('/api/track/page')
        .send(pageData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('URL is required');
      expect(PageView.create).not.toHaveBeenCalled();
      expect(Event.create).not.toHaveBeenCalled();
    });

    it('should handle page view creation errors', async () => {
      PageView.create.mockRejectedValue(new Error('PageView creation failed'));

      const pageData = {
        session_id: 'test-session-id',
        url: '/test-page'
      };

      const response = await request(app)
        .post('/api/track/page')
        .send(pageData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('PageView creation failed');
    });

    it('should track exit page correctly', async () => {
      const mockPageView = {
        id: 'test-pageview-id',
        session_id: 'test-session-id',
        url: '/exit-page',
        timestamp: new Date()
      };

      const mockEvent = {
        id: 'test-event-id',
        session_id: 'test-session-id',
        event_type: 'page_view',
        url: '/exit-page',
        timestamp: new Date()
      };

      Event.EVENT_TYPES = { PAGE_VIEW: 'page_view' };
      PageView.create.mockResolvedValue(mockPageView);
      Event.create.mockResolvedValue(mockEvent);

      const pageData = {
        session_id: 'test-session-id',
        url: '/exit-page',
        exit_page: true,
        time_on_page: 300
      };

      const response = await request(app)
        .post('/api/track/page')
        .send(pageData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(PageView.create).toHaveBeenCalledWith(
        expect.objectContaining({
          exit_page: true,
          time_on_page: 300
        })
      );
    });
  });

  describe('POST /api/track/batch', () => {
    beforeEach(() => {
      Event.EVENT_TYPES = {
        PAGE_VIEW: 'page_view',
        CLICK: 'click',
        SCROLL: 'scroll',
        CUSTOM: 'custom'
      };
    });

    it('should process batch events successfully', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          session_id: 'test-session-id',
          event_type: 'click',
          url: '/page1',
          timestamp: new Date()
        },
        {
          id: 'event-2',
          session_id: 'test-session-id',
          event_type: 'scroll',
          url: '/page1',
          timestamp: new Date()
        }
      ];

      Event.createBatch.mockResolvedValue(mockEvents);

      const batchData = {
        events: [
          {
            session_id: 'test-session-id',
            event_type: 'click',
            url: '/page1',
            properties: { element: 'button' }
          },
          {
            session_id: 'test-session-id',
            event_type: 'scroll',
            url: '/page1',
            properties: { depth: 75 }
          }
        ]
      };

      const response = await request(app)
        .post('/api/track/batch')
        .send(batchData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.events_created).toBe(2);
      expect(response.body.data.page_views_created).toBe(0);
      expect(response.body.data.total_processed).toBe(2);
      expect(response.body.data.events).toHaveLength(2);
      expect(Event.createBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            session_id: 'test-session-id',
            event_type: 'click',
            url: '/page1'
          }),
          expect.objectContaining({
            session_id: 'test-session-id',
            event_type: 'scroll',
            url: '/page1'
          })
        ])
      );
    });

    it('should process batch with page views', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          session_id: 'test-session-id',
          event_type: 'page_view',
          url: '/page1',
          timestamp: new Date()
        }
      ];

      const mockPageView = {
        id: 'pageview-1',
        session_id: 'test-session-id',
        url: '/page1',
        timestamp: new Date()
      };

      Event.createBatch.mockResolvedValue(mockEvents);
      PageView.create.mockResolvedValue(mockPageView);

      const batchData = {
        events: [
          {
            session_id: 'test-session-id',
            event_type: 'page_view',
            url: '/page1',
            properties: {
              title: 'Page 1',
              load_time: 1200
            }
          }
        ]
      };

      const response = await request(app)
        .post('/api/track/batch')
        .send(batchData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.events_created).toBe(1);
      expect(response.body.data.page_views_created).toBe(1);
      expect(response.body.data.total_processed).toBe(1);
      expect(PageView.create).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'test-session-id',
          url: '/page1',
          title: 'Page 1',
          load_time: 1200
        })
      );
    });

    it('should return error when events array is missing', async () => {
      const batchData = {};

      const response = await request(app)
        .post('/api/track/batch')
        .send(batchData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Events array is required');
      expect(Event.createBatch).not.toHaveBeenCalled();
    });

    it('should return error when events array is empty', async () => {
      const batchData = {
        events: []
      };

      const response = await request(app)
        .post('/api/track/batch')
        .send(batchData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Events array cannot be empty');
      expect(Event.createBatch).not.toHaveBeenCalled();
    });

    it('should return error when batch size exceeds limit', async () => {
      const events = Array(101).fill().map((_, i) => ({
        session_id: 'test-session-id',
        event_type: 'click',
        url: `/page${i}`
      }));

      const batchData = { events };

      const response = await request(app)
        .post('/api/track/batch')
        .send(batchData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Batch size cannot exceed 100 events');
      expect(Event.createBatch).not.toHaveBeenCalled();
    });

    it('should return error when event is missing session_id', async () => {
      const batchData = {
        events: [
          {
            event_type: 'click',
            url: '/page1'
          }
        ]
      };

      const response = await request(app)
        .post('/api/track/batch')
        .send(batchData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Event at index 0: Session ID is required');
      expect(Event.createBatch).not.toHaveBeenCalled();
    });

    it('should return error when event is missing event_type', async () => {
      const batchData = {
        events: [
          {
            session_id: 'test-session-id',
            url: '/page1'
          }
        ]
      };

      const response = await request(app)
        .post('/api/track/batch')
        .send(batchData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Event at index 0: Event type is required');
      expect(Event.createBatch).not.toHaveBeenCalled();
    });

    it('should return error when event is missing url', async () => {
      const batchData = {
        events: [
          {
            session_id: 'test-session-id',
            event_type: 'click'
          }
        ]
      };

      const response = await request(app)
        .post('/api/track/batch')
        .send(batchData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Event at index 0: URL is required');
      expect(Event.createBatch).not.toHaveBeenCalled();
    });

    it('should handle batch creation errors', async () => {
      Event.createBatch.mockRejectedValue(new Error('Batch creation failed'));

      const batchData = {
        events: [
          {
            session_id: 'test-session-id',
            event_type: 'click',
            url: '/page1'
          }
        ]
      };

      const response = await request(app)
        .post('/api/track/batch')
        .send(batchData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Batch creation failed');
    });

    it('should continue processing even if page view creation fails', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          session_id: 'test-session-id',
          event_type: 'page_view',
          url: '/page1',
          timestamp: new Date()
        }
      ];

      Event.createBatch.mockResolvedValue(mockEvents);
      PageView.create.mockRejectedValue(new Error('PageView creation failed'));

      const batchData = {
        events: [
          {
            session_id: 'test-session-id',
            event_type: 'page_view',
            url: '/page1',
            properties: { title: 'Page 1' }
          }
        ]
      };

      const response = await request(app)
        .post('/api/track/batch')
        .send(batchData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.events_created).toBe(1);
      expect(response.body.data.page_views_created).toBe(0); // Failed to create
      expect(response.body.data.total_processed).toBe(1);
    });

    it('should handle mixed event types correctly', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          session_id: 'test-session-id',
          event_type: 'page_view',
          url: '/page1',
          timestamp: new Date()
        },
        {
          id: 'event-2',
          session_id: 'test-session-id',
          event_type: 'click',
          url: '/page1',
          timestamp: new Date()
        },
        {
          id: 'event-3',
          session_id: 'test-session-id',
          event_type: 'scroll',
          url: '/page1',
          timestamp: new Date()
        }
      ];

      const mockPageView = {
        id: 'pageview-1',
        session_id: 'test-session-id',
        url: '/page1',
        timestamp: new Date()
      };

      Event.createBatch.mockResolvedValue(mockEvents);
      PageView.create.mockResolvedValue(mockPageView);

      const batchData = {
        events: [
          {
            session_id: 'test-session-id',
            event_type: 'page_view',
            url: '/page1',
            properties: { title: 'Page 1' }
          },
          {
            session_id: 'test-session-id',
            event_type: 'click',
            url: '/page1',
            properties: { element: 'button' }
          },
          {
            session_id: 'test-session-id',
            event_type: 'scroll',
            url: '/page1',
            properties: { depth: 50 }
          }
        ]
      };

      const response = await request(app)
        .post('/api/track/batch')
        .send(batchData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.events_created).toBe(3);
      expect(response.body.data.page_views_created).toBe(1);
      expect(response.body.data.total_processed).toBe(3);
      expect(response.body.data.events).toHaveLength(3);
      expect(response.body.data.page_views).toHaveLength(1);
    });
  });


});