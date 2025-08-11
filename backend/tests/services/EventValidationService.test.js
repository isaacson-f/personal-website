const EventValidationService = require('../../services/EventValidationService');

// Isolated unit test - no database setup needed

describe('EventValidationService', () => {
  let validationService;

  beforeEach(() => {
    validationService = new EventValidationService();
  });

  describe('validateEvent', () => {
    it('should validate a valid event', () => {
      const validEvent = {
        session_id: 'test-session-123',
        event_type: 'page_view',
        url: 'https://example.com/page',
        url_hash: '#section1',
        referrer: 'https://google.com',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ip_address: '192.168.1.1',
        properties: { custom: 'data' }
      };

      const result = validationService.validateEvent(validEvent);
      
      expect(result).toMatchObject({
        session_id: 'test-session-123',
        event_type: 'page_view',
        url: 'https://example.com/page',
        url_hash: '#section1',
        referrer: 'https://google.com',
        ip_address: '192.168.1.1'
      });
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.properties).toEqual({ custom: 'data' });
    });

    it('should reject invalid event type', () => {
      const invalidEvent = {
        session_id: 'test-session-123',
        event_type: 'invalid_type',
        url: 'https://example.com/page',
        ip_address: '192.168.1.1'
      };

      expect(() => {
        validationService.validateEvent(invalidEvent);
      }).toThrow('Event validation failed');
    });

    it('should reject missing required fields', () => {
      const invalidEvent = {
        event_type: 'page_view',
        url: 'https://example.com/page'
        // Missing session_id and ip_address
      };

      expect(() => {
        validationService.validateEvent(invalidEvent);
      }).toThrow('Event validation failed');
    });

    it('should reject invalid URL', () => {
      const invalidEvent = {
        session_id: 'test-session-123',
        event_type: 'page_view',
        url: 'not-a-valid-url',
        ip_address: '192.168.1.1'
      };

      expect(() => {
        validationService.validateEvent(invalidEvent);
      }).toThrow('Event validation failed');
    });

    it('should reject invalid IP address', () => {
      const invalidEvent = {
        session_id: 'test-session-123',
        event_type: 'page_view',
        url: 'https://example.com/page',
        ip_address: 'not-an-ip'
      };

      expect(() => {
        validationService.validateEvent(invalidEvent);
      }).toThrow('Event validation failed');
    });
  });

  describe('validatePageView', () => {
    it('should validate a valid page view', () => {
      const validPageView = {
        session_id: 'test-session-123',
        url: 'https://example.com/page',
        url_hash: '#section1',
        title: 'Test Page',
        load_time: 1500,
        scroll_depth: 75,
        time_on_page: 30,
        exit_page: false
      };

      const result = validationService.validatePageView(validPageView);
      
      expect(result).toMatchObject(validPageView);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should set default values for optional fields', () => {
      const minimalPageView = {
        session_id: 'test-session-123',
        url: 'https://example.com/page'
      };

      const result = validationService.validatePageView(minimalPageView);
      
      expect(result.exit_page).toBe(false);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should reject invalid scroll depth', () => {
      const invalidPageView = {
        session_id: 'test-session-123',
        url: 'https://example.com/page',
        scroll_depth: 150 // Invalid: > 100
      };

      expect(() => {
        validationService.validatePageView(invalidPageView);
      }).toThrow('Page view validation failed');
    });
  });

  describe('validateSession', () => {
    it('should validate a valid session', () => {
      const validSession = {
        id: 'session-123',
        visitor_id: 'visitor-456',
        cookie_id: 'cookie-789',
        start_time: new Date().toISOString(),
        page_views: 5,
        duration_seconds: 300,
        browser_fingerprint: 'fp-123',
        device_info: { browser: 'Chrome' },
        geographic_data: { country: 'US' },
        is_returning_visitor: true
      };

      const result = validationService.validateSession(validSession);
      
      expect(result).toMatchObject({
        id: 'session-123',
        visitor_id: 'visitor-456',
        cookie_id: 'cookie-789',
        page_views: 5,
        duration_seconds: 300,
        is_returning_visitor: true
      });
    });

    it('should set default values', () => {
      const minimalSession = {
        id: 'session-123',
        start_time: new Date().toISOString()
      };

      const result = validationService.validateSession(minimalSession);
      
      expect(result.page_views).toBe(0);
      expect(result.is_returning_visitor).toBe(false);
      expect(result.device_info).toEqual({});
      expect(result.geographic_data).toEqual({});
    });
  });

  describe('sanitization', () => {
    it('should sanitize malicious URLs', () => {
      const maliciousEvent = {
        session_id: 'test-session-123',
        event_type: 'page_view',
        url: 'https://example.com/page',
        referrer: 'https://example.com/referrer',
        ip_address: '192.168.1.1'
      };

      // Test the sanitization methods directly since validation happens first
      const sanitizedUrl = validationService.sanitizeUrl('https://example.com/page<script>alert("xss")</script>');
      const sanitizedReferrer = validationService.sanitizeUrl('javascript:alert("xss")');
      
      expect(sanitizedUrl).not.toContain('<script>');
      expect(sanitizedReferrer).not.toContain('javascript:');
    });

    it('should sanitize user agent strings', () => {
      const maliciousEvent = {
        session_id: 'test-session-123',
        event_type: 'page_view',
        url: 'https://example.com/page',
        user_agent: 'Mozilla/5.0 <script>alert("xss")</script>',
        ip_address: '192.168.1.1'
      };

      const result = validationService.validateEvent(maliciousEvent);
      
      expect(result.user_agent).not.toContain('<script>');
    });

    it('should sanitize properties recursively', () => {
      const maliciousEvent = {
        session_id: 'test-session-123',
        event_type: 'page_view',
        url: 'https://example.com/page',
        ip_address: '192.168.1.1',
        properties: {
          'malicious<script>': 'value',
          nested: {
            'onclick=alert("xss")': 'nested_value'
          }
        }
      };

      const result = validationService.validateEvent(maliciousEvent);
      
      const propertyKeys = Object.keys(result.properties);
      expect(propertyKeys.some(key => key.includes('<script>'))).toBe(false);
      expect(propertyKeys.some(key => key.includes('onclick='))).toBe(false);
    });
  });

  describe('validateEventBatch', () => {
    it('should validate a batch of valid events', () => {
      const events = [
        {
          session_id: 'test-session-123',
          event_type: 'page_view',
          url: 'https://example.com/page1',
          ip_address: '192.168.1.1'
        },
        {
          session_id: 'test-session-123',
          event_type: 'click',
          url: 'https://example.com/page2',
          ip_address: '192.168.1.1'
        }
      ];

      const result = validationService.validateEventBatch(events);
      
      expect(result).toHaveLength(2);
      expect(result[0].event_type).toBe('page_view');
      expect(result[1].event_type).toBe('click');
    });

    it('should reject non-array input', () => {
      expect(() => {
        validationService.validateEventBatch('not-an-array');
      }).toThrow('Events must be an array');
    });

    it('should reject empty array', () => {
      expect(() => {
        validationService.validateEventBatch([]);
      }).toThrow('Events array cannot be empty');
    });

    it('should reject batch size > 100', () => {
      const events = Array(101).fill({
        session_id: 'test-session-123',
        event_type: 'page_view',
        url: 'https://example.com/page',
        ip_address: '192.168.1.1'
      });

      expect(() => {
        validationService.validateEventBatch(events);
      }).toThrow('Batch size cannot exceed 100 events');
    });

    it('should provide detailed error for invalid event in batch', () => {
      const events = [
        {
          session_id: 'test-session-123',
          event_type: 'page_view',
          url: 'https://example.com/page',
          ip_address: '192.168.1.1'
        },
        {
          session_id: 'test-session-123',
          event_type: 'invalid_type', // Invalid
          url: 'https://example.com/page',
          ip_address: '192.168.1.1'
        }
      ];

      expect(() => {
        validationService.validateEventBatch(events);
      }).toThrow('Event at index 1:');
    });
  });
});