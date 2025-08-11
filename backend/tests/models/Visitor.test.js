const Visitor = require('../../models/Visitor');

describe('Visitor Model', () => {
  let testVisitor;

  beforeEach(() => {
    testVisitor = createTestData.visitor();
  });

  describe('create', () => {
    it('should create a new visitor with valid data', async () => {
      const visitor = await Visitor.create(testVisitor);
      
      expect(visitor).toBeDefined();
      expect(visitor.id).toBe(testVisitor.id);
      expect(visitor.cookie_id).toBe(testVisitor.cookie_id);
      expect(visitor.total_sessions).toBe(1);
      expect(visitor.total_page_views).toBe(0);
    });

    it('should throw error with invalid data', async () => {
      const invalidData = { ...testVisitor, id: null };
      
      await expect(Visitor.create(invalidData)).rejects.toThrow('Validation failed');
    });

    it('should sanitize string inputs', async () => {
      const dataWithHtml = {
        ...testVisitor,
        id: 'test<script>alert("xss")</script>',
        browser_fingerprint: 'fingerprint<>'
      };
      
      const visitor = await Visitor.create(dataWithHtml);
      
      expect(visitor.id).not.toContain('<script>');
      expect(visitor.browser_fingerprint).not.toContain('<>');
    });
  });

  describe('findById', () => {
    it('should find visitor by ID', async () => {
      const createdVisitor = await Visitor.create(testVisitor);
      const foundVisitor = await Visitor.findById(createdVisitor.id);
      
      expect(foundVisitor).toBeDefined();
      expect(foundVisitor.id).toBe(createdVisitor.id);
    });

    it('should return null for non-existent ID', async () => {
      const visitor = await Visitor.findById('non-existent-id');
      expect(visitor).toBeNull();
    });
  });

  describe('findByCookieId', () => {
    it('should find visitor by cookie ID', async () => {
      const createdVisitor = await Visitor.create(testVisitor);
      const foundVisitor = await Visitor.findByCookieId(createdVisitor.cookie_id);
      
      expect(foundVisitor).toBeDefined();
      expect(foundVisitor.cookie_id).toBe(createdVisitor.cookie_id);
    });
  });

  describe('update', () => {
    it('should update visitor data', async () => {
      const createdVisitor = await Visitor.create(testVisitor);
      const updates = {
        total_sessions: 2,
        total_page_views: 5
      };
      
      const updatedVisitor = await Visitor.update(createdVisitor.id, updates);
      
      expect(updatedVisitor.total_sessions).toBe(2);
      expect(updatedVisitor.total_page_views).toBe(5);
    });

    it('should throw error for invalid visitor ID', async () => {
      await expect(Visitor.update('invalid-id', { total_sessions: 2 }))
        .rejects.toThrow('Visitor not found');
    });
  });

  describe('incrementSessions', () => {
    it('should increment session count', async () => {
      const createdVisitor = await Visitor.create(testVisitor);
      const updatedVisitor = await Visitor.incrementSessions(createdVisitor.id);
      
      expect(updatedVisitor.total_sessions).toBe(2);
    });
  });

  describe('incrementPageViews', () => {
    it('should increment page view count', async () => {
      const createdVisitor = await Visitor.create(testVisitor);
      const updatedVisitor = await Visitor.incrementPageViews(createdVisitor.id, 3);
      
      expect(updatedVisitor.total_page_views).toBe(3);
    });
  });

  describe('getStatistics', () => {
    it('should return visitor statistics', async () => {
      await Visitor.create(testVisitor);
      await Visitor.create(createTestData.visitor({ total_sessions: 2 }));
      
      const stats = await Visitor.getStatistics();
      
      expect(stats).toBeDefined();
      expect(parseInt(stats.total_visitors)).toBeGreaterThanOrEqual(2);
      expect(stats.avg_sessions_per_visitor).toBeDefined();
    });
  });
});