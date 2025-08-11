const EventValidationService = require('../../services/EventValidationService');
const GeolocationService = require('../../services/GeolocationService');
const UserAgentParsingService = require('../../services/UserAgentParsingService');

describe('Event Processing Pipeline Integration', () => {
  let validationService;
  let geolocationService;
  let parsingService;

  beforeEach(() => {
    validationService = new EventValidationService();
    geolocationService = new GeolocationService();
    parsingService = new UserAgentParsingService();
  });

  it('should process a complete event through the pipeline', async () => {
    // Raw event data
    const rawEvent = {
      session_id: 'test-session-123',
      event_type: 'page_view',
      url: 'https://example.com/page',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      ip_address: '8.8.8.8',
      properties: { page_title: 'Test Page' }
    };

    // Step 1: Validate and sanitize the event
    const validatedEvent = validationService.validateEvent(rawEvent);
    expect(validatedEvent.session_id).toBe('test-session-123');
    expect(validatedEvent.event_type).toBe('page_view');
    expect(validatedEvent.url).toBe('https://example.com/page');

    // Step 2: Parse user agent
    const deviceInfo = parsingService.parseUserAgent(rawEvent.user_agent);
    expect(deviceInfo.browser.name).toBe('Chrome');
    expect(deviceInfo.os.name).toBe('Windows 11');
    expect(deviceInfo.device.type).toBe('desktop');

    // Step 3: Resolve geolocation (will return default for public IP in test)
    const locationData = await geolocationService.resolveLocation(rawEvent.ip_address);
    expect(locationData).toBeDefined();
    expect(typeof locationData).toBe('object');

    // Verify the complete processed event structure
    const processedEvent = {
      ...validatedEvent,
      device_info: deviceInfo,
      geographic_data: locationData
    };

    expect(processedEvent).toHaveProperty('session_id');
    expect(processedEvent).toHaveProperty('event_type');
    expect(processedEvent).toHaveProperty('url');
    expect(processedEvent).toHaveProperty('device_info');
    expect(processedEvent).toHaveProperty('geographic_data');
    expect(processedEvent).toHaveProperty('timestamp');
  });

  it('should handle batch event processing', async () => {
    const events = [
      {
        session_id: 'session-1',
        event_type: 'page_view',
        url: 'https://example.com/page1',
        user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X)',
        ip_address: '192.168.1.1'
      },
      {
        session_id: 'session-2',
        event_type: 'click',
        url: 'https://example.com/page2',
        user_agent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) Mobile',
        ip_address: '10.0.0.1'
      }
    ];

    // Process batch validation
    const validatedEvents = validationService.validateEventBatch(events);
    expect(validatedEvents).toHaveLength(2);

    // Process user agents in batch
    const userAgents = events.map(e => e.user_agent);
    const deviceInfos = parsingService.batchParseUserAgents(userAgents);
    expect(deviceInfos).toHaveLength(2);
    expect(deviceInfos[0].parsed.device.is_mobile).toBe(true);
    expect(deviceInfos[1].parsed.device.is_mobile).toBe(true);

    // Process IPs in batch
    const ips = events.map(e => e.ip_address);
    const locations = await geolocationService.batchResolveLocations(ips);
    expect(locations).toHaveLength(2);
    expect(locations[0].location).toEqual(geolocationService.getDefaultLocation());
    expect(locations[1].location).toEqual(geolocationService.getDefaultLocation());
  });

  it('should handle malicious input safely', () => {
    const maliciousEvent = {
      session_id: 'test-session-123',
      event_type: 'page_view',
      url: 'https://example.com/page',
      user_agent: 'Mozilla/5.0 <script>alert("xss")</script>',
      ip_address: '192.168.1.1',
      properties: {
        'malicious<script>': 'value',
        'onclick=alert("xss")': 'another_value'
      }
    };

    const validatedEvent = validationService.validateEvent(maliciousEvent);
    const deviceInfo = parsingService.parseUserAgent(maliciousEvent.user_agent);

    // Verify sanitization
    expect(validatedEvent.user_agent).not.toContain('<script>');
    expect(deviceInfo.raw_user_agent).not.toContain('<script>');
    
    const propertyKeys = Object.keys(validatedEvent.properties);
    expect(propertyKeys.some(key => key.includes('<script>'))).toBe(false);
    expect(propertyKeys.some(key => key.includes('onclick='))).toBe(false);
  });
});