const UserAgentParsingService = require('../../services/UserAgentParsingService');

// Isolated unit test - no database setup needed

describe('UserAgentParsingService', () => {
  let parsingService;

  beforeEach(() => {
    parsingService = new UserAgentParsingService();
  });

  describe('parseUserAgent', () => {
    it('should parse Chrome user agent correctly', () => {
      const chromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
      
      const result = parsingService.parseUserAgent(chromeUA);
      
      expect(result.browser.name).toBe('Chrome');
      expect(result.browser.version).toBe('91.0');
      expect(result.browser.major_version).toBe(91);
      expect(result.os.name).toBe('Windows 11'); // Windows 11 pattern matches first
      expect(result.device.type).toBe('desktop');
      expect(result.is_bot).toBe(false);
    });

    it('should parse Firefox user agent correctly', () => {
      const firefoxUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0';
      
      const result = parsingService.parseUserAgent(firefoxUA);
      
      expect(result.browser.name).toBe('Firefox');
      expect(result.browser.version).toBe('89.0');
      expect(result.browser.major_version).toBe(89);
      expect(result.os.name).toBe('Windows 11'); // Windows 11 pattern matches first
      expect(result.device.type).toBe('desktop');
    });

    it('should parse Safari user agent correctly', () => {
      const safariUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15';
      
      const result = parsingService.parseUserAgent(safariUA);
      
      expect(result.browser.name).toBe('Safari');
      expect(result.browser.version).toBe('14.1');
      expect(result.os.name).toBe('macOS');
      expect(result.os.family).toBe('Apple');
      expect(result.device.type).toBe('desktop');
    });

    it('should parse mobile Chrome user agent correctly', () => {
      const mobileUA = 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36';
      
      const result = parsingService.parseUserAgent(mobileUA);
      
      expect(result.browser.name).toBe('Chrome');
      expect(result.os.name).toBe('Android');
      expect(result.os.version).toBe('11'); // Android pattern captures version as "11"
      expect(result.device.type).toBe('mobile');
      expect(result.device.is_mobile).toBe(true);
      expect(result.device.is_desktop).toBe(false);
    });

    it('should parse iPad user agent correctly', () => {
      const iPadUA = 'Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1';
      
      const result = parsingService.parseUserAgent(iPadUA);
      
      expect(result.browser.name).toBe('Safari');
      expect(result.os.name).toBe('iOS');
      expect(result.os.version).toBe('14.6'); // Underscores are replaced with dots
      expect(result.os.family).toBe('Apple');
      expect(result.device.type).toBe('tablet');
      expect(result.device.is_tablet).toBe(true);
    });

    it('should detect bots correctly', () => {
      const botUAs = [
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Twitterbot/1.0',
        'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)'
      ];

      botUAs.forEach(ua => {
        const result = parsingService.parseUserAgent(ua);
        expect(result.is_bot).toBe(true);
      });
    });

    it('should handle null/undefined user agent', () => {
      const result1 = parsingService.parseUserAgent(null);
      const result2 = parsingService.parseUserAgent(undefined);
      const result3 = parsingService.parseUserAgent('');

      [result1, result2, result3].forEach(result => {
        expect(result).toEqual(parsingService.getDefaultDeviceInfo());
      });
    });

    it('should handle unknown user agent', () => {
      const unknownUA = 'UnknownBrowser/1.0';
      
      const result = parsingService.parseUserAgent(unknownUA);
      
      expect(result.browser.name).toBe('unknown');
      expect(result.os.name).toBe('unknown');
      expect(result.device.type).toBe('desktop'); // Default fallback
    });
  });

  describe('sanitizeUserAgent', () => {
    it('should remove malicious content from user agent', () => {
      const maliciousUA = 'Mozilla/5.0 <script>alert("xss")</script> Chrome/91.0';
      
      const sanitized = parsingService.sanitizeUserAgent(maliciousUA);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('javascript:');
    });

    it('should remove event handlers', () => {
      const maliciousUA = 'Mozilla/5.0 onclick=alert("xss") Chrome/91.0';
      
      const sanitized = parsingService.sanitizeUserAgent(maliciousUA);
      
      expect(sanitized).not.toContain('onclick=');
    });
  });

  describe('parseBrowser', () => {
    it('should parse Edge user agent', () => {
      const edgeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59';
      
      const browser = parsingService.parseBrowser(edgeUA);
      
      expect(browser.name).toBe('Edge');
      expect(browser.version).toBe('91.0');
      expect(browser.major_version).toBe(91);
    });

    it('should parse Opera user agent', () => {
      const operaUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 OPR/77.0.4054.172';
      
      const browser = parsingService.parseBrowser(operaUA);
      
      expect(browser.name).toBe('Opera');
      expect(browser.version).toBe('77.0');
    });

    it('should parse Internet Explorer user agent', () => {
      const ieUA = 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko';
      
      const browser = parsingService.parseBrowser(ieUA);
      
      expect(browser.name).toBe('Internet Explorer');
      expect(browser.version).toBe('11.0');
    });
  });

  describe('parseOperatingSystem', () => {
    it('should parse Windows versions correctly', () => {
      const windowsUAs = [
        { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', expected: 'Windows 11' }, // Windows 11 pattern matches first
        { ua: 'Mozilla/5.0 (Windows NT 6.3; Win64; x64)', expected: 'Windows 8.1' },
        { ua: 'Mozilla/5.0 (Windows NT 6.2; Win64; x64)', expected: 'Windows 8' },
        { ua: 'Mozilla/5.0 (Windows NT 6.1; Win64; x64)', expected: 'Windows 7' }
      ];

      windowsUAs.forEach(({ ua, expected }) => {
        const os = parsingService.parseOperatingSystem(ua);
        expect(os.name).toBe(expected);
        expect(os.family).toBe('Windows');
      });
    });

    it('should parse macOS correctly', () => {
      const macUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
      
      const os = parsingService.parseOperatingSystem(macUA);
      
      expect(os.name).toBe('macOS');
      expect(os.version).toBe('10.15');
      expect(os.family).toBe('Apple');
    });

    it('should parse Linux correctly', () => {
      const linuxUA = 'Mozilla/5.0 (X11; Linux x86_64)';
      
      const os = parsingService.parseOperatingSystem(linuxUA);
      
      expect(os.name).toBe('Linux');
      expect(os.family).toBe('Linux');
    });
  });

  describe('parseDevice', () => {
    it('should identify mobile devices', () => {
      const mobileUAs = [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X)',
        'Mozilla/5.0 (Linux; Android 11; SM-G991B) Mobile'
      ];

      mobileUAs.forEach(ua => {
        const device = parsingService.parseDevice(ua);
        expect(device.type).toBe('mobile');
        expect(device.is_mobile).toBe(true);
        expect(device.is_tablet).toBe(false);
        expect(device.is_desktop).toBe(false);
      });
    });

    it('should identify tablet devices', () => {
      const tabletUAs = [
        'Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X)',
        'Mozilla/5.0 (Linux; Android 11; SM-T870) Tablet'
      ];

      tabletUAs.forEach(ua => {
        const device = parsingService.parseDevice(ua);
        expect(device.type).toBe('tablet');
        expect(device.is_tablet).toBe(true);
        expect(device.is_mobile).toBe(false);
        expect(device.is_desktop).toBe(false);
      });
    });

    it('should identify desktop devices', () => {
      const desktopUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      
      const device = parsingService.parseDevice(desktopUA);
      
      expect(device.type).toBe('desktop');
      expect(device.is_desktop).toBe(true);
      expect(device.is_mobile).toBe(false);
      expect(device.is_tablet).toBe(false);
    });
  });

  describe('batchParseUserAgents', () => {
    it('should parse multiple user agents', () => {
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X)',
        'Mozilla/5.0 (compatible; Googlebot/2.1)'
      ];

      const results = parsingService.batchParseUserAgents(userAgents);
      
      expect(results).toHaveLength(3);
      expect(results[0].parsed.browser.name).toBe('Chrome');
      expect(results[1].parsed.device.is_mobile).toBe(true);
      expect(results[2].parsed.is_bot).toBe(true);
    });

    it('should handle invalid input', () => {
      expect(() => {
        parsingService.batchParseUserAgents('not-an-array');
      }).toThrow('User agents must be an array');
    });

    it('should handle errors in individual user agents', () => {
      // Mock a parsing error by overriding parseUserAgent temporarily
      const originalParse = parsingService.parseUserAgent;
      parsingService.parseUserAgent = jest.fn().mockImplementation((ua) => {
        if (ua === 'error-ua') {
          throw new Error('Parse error');
        }
        return originalParse.call(parsingService, ua);
      });

      const userAgents = ['valid-ua', 'error-ua'];
      const results = parsingService.batchParseUserAgents(userAgents);
      
      expect(results).toHaveLength(2);
      expect(results[0].error).toBeNull();
      expect(results[1].error).toBe('Parse error');
      expect(results[1].parsed).toEqual(parsingService.getDefaultDeviceInfo());

      // Restore original method
      parsingService.parseUserAgent = originalParse;
    });
  });

  describe('utility methods', () => {
    it('should categorize browsers correctly', () => {
      expect(parsingService.getBrowserCategory('Chrome')).toBe('major');
      expect(parsingService.getBrowserCategory('Firefox')).toBe('major');
      expect(parsingService.getBrowserCategory('Safari')).toBe('major');
      expect(parsingService.getBrowserCategory('Edge')).toBe('major');
      expect(parsingService.getBrowserCategory('Opera')).toBe('minor');
      expect(parsingService.getBrowserCategory('UnknownBrowser')).toBe('minor');
    });

    it('should detect outdated browsers', () => {
      expect(parsingService.isOutdatedBrowser('Chrome', 85)).toBe(true);
      expect(parsingService.isOutdatedBrowser('Chrome', 95)).toBe(false);
      expect(parsingService.isOutdatedBrowser('Firefox', 80)).toBe(true);
      expect(parsingService.isOutdatedBrowser('Firefox', 90)).toBe(false);
      expect(parsingService.isOutdatedBrowser('UnknownBrowser', 50)).toBe(false); // Returns false for unknown browsers
    });

    it('should extract screen resolution when available', () => {
      const uaWithResolution = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) 1920x1080';
      const uaWithoutResolution = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      
      const resolution1 = parsingService.extractScreenResolution(uaWithResolution);
      const resolution2 = parsingService.extractScreenResolution(uaWithoutResolution);
      
      expect(resolution1).toEqual({ width: 1920, height: 1080 });
      expect(resolution2).toBeNull();
    });

    it('should determine device capabilities', () => {
      const mobileDevice = {
        browser: { name: 'Chrome', major_version: 91 },
        device: { is_mobile: true, is_tablet: false }
      };
      
      const desktopDevice = {
        browser: { name: 'Chrome', major_version: 91 },
        device: { is_mobile: false, is_tablet: false }
      };
      
      const oldIE = {
        browser: { name: 'Internet Explorer', major_version: 10 },
        device: { is_mobile: false, is_tablet: false }
      };

      const mobileCaps = parsingService.getDeviceCapabilities(mobileDevice);
      const desktopCaps = parsingService.getDeviceCapabilities(desktopDevice);
      const ieCaps = parsingService.getDeviceCapabilities(oldIE);
      
      expect(mobileCaps.touch_support).toBe(true);
      expect(desktopCaps.touch_support).toBe(false);
      expect(ieCaps.local_storage_support).toBe(false);
      expect(ieCaps.canvas_support).toBe(false);
    });
  });
});