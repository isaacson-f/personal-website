const Event = require('../../models/Event');
const Session = require('../../models/Session');
const Visitor = require('../../models/Visitor');

describe('Event Model', () => {
  let testEvent;
  let testSession;

  beforeEach(async () => {
    const testVisitor = await Visitor.create(createTestData.visitor());
    testSession = await Session.create(createTestData.session({ visitor_id: testVisitor.id }));
    testEvent = createTestData.event({ session_id: testSession.id });
  });

  describe('EVENT_TYPES', () => {
    it('should have valid event types', () => {
      expect(Event.EVENT_TYPES.PAGE_VIEW).toBe('page_view');
      expect(Event.EVENT_TYPES.CLICK).toBe('click');
      expect(Event.EVENT_TYPES.SCROLL).toBe('scroll');
      expect(Event.EVENT_TYPES.CUSTOM).toBe('custom');
    });
  });

  describe('create', () => {
    it('should create a new event with valid data', async () => {
      const event = await Event.create(testEvent);
      
      expect(event).toBeDefined();
      expect(event.session_id).toBe(testEvent.session_id);
      expect(event.event_type).toBe(testEvent.event_type);
      expect(event.url).toBe(testEvent.url);
      expect(event.id).toBeDefined();
    });

    it('should throw error with invalid event type', async () => {
      const invalidEvent = { ...testEvent, event_type: 'invalid_type' };
      
      await expect(Event.create(invalidEvent)).rejects.toThrow('Invalid event type');
    });

    it('should throw error with invalid data', async () => {
      const invalidData = { ...testEvent, session_id: null };
      
      await expect(Event.create(invalidData)).rejects.toThrow('Validation failed');
    });

    it('should sanitize URL and other inputs', async () => {
      const eventWithUnsafeData = {
        ...testEvent,
        url: '/test<script>alert("xss")</script>',
        referrer: 'http://evil.com<script>',
        user_agent: 'Mozilla<script>alert("xss")</script>'
      };
      
      const event = await Event.create(eventWithUnsafeData);
      
      expect(event.url).not.toContain('<script>');
      expect(event.user_agent).not.toContain('<script>');
    });

    it('should validate IP addresses', async () => {
      const eventWithValidIP = { ...testEvent, ip_address: '192.168.1.1' };
      const event = await Event.create(eventWithValidIP);
      
      expect(event.ip_address).toBe('192.168.1.1');
    });
  });

  describe('createBatch', () => {
    it('should create multiple events in batch', async () => {
      const events = [
        { ...testEvent, event_type: 'page_view' },
        { ...testEvent, event_type: 'click', url: '/another-page' },
        { ...testEvent, event_type: 'scroll', url: '/third-page' }
      ];
      
      const createdEvents = await Event.createBatch(events);
      
      expect(createdEvents).toHaveLength(3);
      expect(createdEvents[0].event_type).toBe('page_view');
      expect(createdEvents[1].event_type).toBe('click');
      expect(createdEvents[2].event_type).toBe('scroll');
    });

    it('should throw error for empty array', async () => {
      await expect(Event.createBatch([])).rejects.toThrow('Events data must be a non-empty array');
    });

    it('should rollback transaction on validation error', async () => {
      const events = [
        { ...testEvent, event_type: 'page_view' },
        { ...testEvent, event_type: 'invalid_type' } // This should cause rollback
      ];
      
      await expect(Event.createBatch(events)).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should find event by ID', async () => {
      const createdEvent = await Event.create(testEvent);
      const foundEvent = await Event.findById(createdEvent.id);
      
      expect(foundEvent).toBeDefined();
      expect(foundEvent.id).toBe(createdEvent.id);
    });

    it('should return null for non-existent ID', async () => {
      const event = await Event.findById('non-existent-id');
      expect(event).toBeNull();
    });
  });

  describe('findBySession', () => {
    it('should find events by session ID', async () => {
      await Event.create(testEvent);
      await Event.create({ ...testEvent, event_type: 'click' });
      
      const events = await Event.findBySession(testSession.id);
      
      expect(events).toBeDefined();
      expect(events.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by event type', async () => {
      await Event.create({ ...testEvent, event_type: 'page_view' });
      await Event.create({ ...testEvent, event_type: 'click' });
      
      const pageViewEvents = await Event.findBySession(testSession.id, { eventType: 'page_view' });
      
      expect(pageViewEvents.length).toBeGreaterThanOrEqual(1);
      expect(pageViewEvents[0].event_type).toBe('page_view');
    });
  });

  describe('findByFilters', () => {
    it('should find events with filters', async () => {
      await Event.create(testEvent);
      
      const events = await Event.findByFilters({
        eventType: 'page_view',
        url: '/test-page'
      });
      
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].event_type).toBe('page_view');
      expect(events[0].url).toBe('/test-page');
    });

    it('should support date range filters', async () => {
      await Event.create(testEvent);
      
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const events = await Event.findByFilters({
        dateFrom: oneHourAgo,
        dateTo: now
      });
      
      expect(events.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getStatistics', () => {
    it('should return event statistics', async () => {
      await Event.create(testEvent);
      await Event.create({ ...testEvent, event_type: 'click' });
      
      const stats = await Event.getStatistics();
      
      expect(stats).toBeDefined();
      expect(parseInt(stats.total_events)).toBeGreaterThanOrEqual(2);
      expect(parseInt(stats.unique_sessions)).toBeGreaterThanOrEqual(1);
      expect(parseInt(stats.unique_event_types)).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getEventCountsByType', () => {
    it('should return event counts by type', async () => {
      await Event.create({ ...testEvent, event_type: 'page_view' });
      await Event.create({ ...testEvent, event_type: 'click' });
      await Event.create({ ...testEvent, event_type: 'click' });
      
      const counts = await Event.getEventCountsByType();
      
      expect(counts).toBeDefined();
      expect(counts.length).toBeGreaterThanOrEqual(2);
      
      const clickCount = counts.find(c => c.event_type === 'click');
      expect(parseInt(clickCount.count)).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getPopularUrls', () => {
    it('should return popular URLs', async () => {
      await Event.create({ ...testEvent, url: '/popular-page' });
      await Event.create({ ...testEvent, url: '/popular-page' });
      await Event.create({ ...testEvent, url: '/another-page' });
      
      const popularUrls = await Event.getPopularUrls();
      
      expect(popularUrls).toBeDefined();
      expect(popularUrls.length).toBeGreaterThanOrEqual(2);
      
      const topUrl = popularUrls[0];
      expect(parseInt(topUrl.count)).toBeGreaterThanOrEqual(2);
    });
  });
});