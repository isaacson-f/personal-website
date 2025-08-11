/**
 * Service for parsing user agent strings to extract device and browser information
 * Uses lightweight regex-based parsing to avoid external dependencies
 */
class UserAgentParsingService {
  constructor() {
    // Browser detection patterns (order matters - more specific patterns first)
    this.browserPatterns = [
      { name: 'Edge', pattern: /Edg\/(\d+\.\d+)/ },
      { name: 'Opera', pattern: /OPR\/(\d+\.\d+)/ },
      { name: 'Chrome', pattern: /Chrome\/(\d+\.\d+)/ },
      { name: 'Firefox', pattern: /Firefox\/(\d+\.\d+)/ },
      { name: 'Safari', pattern: /Version\/(\d+\.\d+).*Safari/ },
      { name: 'Internet Explorer', pattern: /MSIE (\d+\.\d+)/ },
      { name: 'Internet Explorer', pattern: /Trident.*rv:(\d+\.\d+)/ }
    ];

    // Operating system detection patterns (order matters - more specific patterns first)
    this.osPatterns = [
      { name: 'Windows 11', pattern: /Windows NT 10\.0.*Win64.*x64/ },
      { name: 'Windows 10', pattern: /Windows NT 10\.0/ },
      { name: 'Windows 8.1', pattern: /Windows NT 6\.3/ },
      { name: 'Windows 8', pattern: /Windows NT 6\.2/ },
      { name: 'Windows 7', pattern: /Windows NT 6\.1/ },
      { name: 'Chrome OS', pattern: /CrOS/ },
      { name: 'Android', pattern: /Android (\d+(?:\.\d+)?)/ },
      { name: 'iOS', pattern: /OS (\d+_\d+).*like Mac OS X/ },
      { name: 'macOS', pattern: /Mac OS X (\d+[._]\d+)/ },
      { name: 'Ubuntu', pattern: /Ubuntu/ },
      { name: 'Linux', pattern: /Linux/ }
    ];

    // Device type detection patterns (order matters - more specific patterns first)
    this.devicePatterns = [
      { type: 'tablet', pattern: /Tablet|iPad|Android(?!.*Mobile)/ },
      { type: 'mobile', pattern: /Mobile|Android.*Mobile|iPhone/ },
      { type: 'desktop', pattern: /.*/ } // Default fallback
    ];

    // Bot detection patterns
    this.botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /facebookexternalhit/i,
      /twitterbot/i,
      /linkedinbot/i,
      /whatsapp/i,
      /googlebot/i,
      /bingbot/i,
      /slackbot/i,
      /telegrambot/i
    ];
  }

  /**
   * Parse user agent string and extract device/browser information
   * @param {string} userAgent - User agent string to parse
   * @returns {Object} - Parsed device and browser information
   */
  parseUserAgent(userAgent) {
    if (!userAgent || typeof userAgent !== 'string') {
      return this.getDefaultDeviceInfo();
    }

    const sanitizedUA = this.sanitizeUserAgent(userAgent);

    return {
      browser: this.parseBrowser(sanitizedUA),
      os: this.parseOperatingSystem(sanitizedUA),
      device: this.parseDevice(sanitizedUA),
      is_bot: this.isBot(sanitizedUA),
      raw_user_agent: sanitizedUA.substring(0, 500) // Truncate for storage
    };
  }

  /**
   * Sanitize user agent string
   * @param {string} userAgent - Raw user agent string
   * @returns {string} - Sanitized user agent string
   */
  sanitizeUserAgent(userAgent) {
    return userAgent
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Parse browser information from user agent
   * @param {string} userAgent - User agent string
   * @returns {Object} - Browser information
   */
  parseBrowser(userAgent) {
    for (const browser of this.browserPatterns) {
      const match = userAgent.match(browser.pattern);
      if (match) {
        return {
          name: browser.name,
          version: match[1] || 'unknown',
          major_version: match[1] ? parseInt(match[1].split('.')[0]) : null
        };
      }
    }

    return {
      name: 'unknown',
      version: 'unknown',
      major_version: null
    };
  }

  /**
   * Parse operating system information from user agent
   * @param {string} userAgent - User agent string
   * @returns {Object} - Operating system information
   */
  parseOperatingSystem(userAgent) {
    for (const os of this.osPatterns) {
      const match = userAgent.match(os.pattern);
      if (match) {
        let version = 'unknown';
        if (match[1]) {
          version = match[1].replace(/_/g, '.');
        }

        return {
          name: os.name,
          version: version,
          family: this.getOSFamily(os.name)
        };
      }
    }

    return {
      name: 'unknown',
      version: 'unknown',
      family: 'unknown'
    };
  }

  /**
   * Get operating system family
   * @param {string} osName - Operating system name
   * @returns {string} - OS family
   */
  getOSFamily(osName) {
    if (osName.includes('Windows')) return 'Windows';
    if (osName.includes('macOS') || osName.includes('iOS')) return 'Apple';
    if (osName.includes('Android')) return 'Android';
    if (osName.includes('Linux') || osName.includes('Ubuntu')) return 'Linux';
    if (osName.includes('Chrome OS')) return 'Chrome OS';
    return 'unknown';
  }

  /**
   * Parse device information from user agent
   * @param {string} userAgent - User agent string
   * @returns {Object} - Device information
   */
  parseDevice(userAgent) {
    for (const device of this.devicePatterns) {
      if (device.pattern.test(userAgent)) {
        return {
          type: device.type,
          is_mobile: device.type === 'mobile',
          is_tablet: device.type === 'tablet',
          is_desktop: device.type === 'desktop'
        };
      }
    }

    return {
      type: 'unknown',
      is_mobile: false,
      is_tablet: false,
      is_desktop: false
    };
  }

  /**
   * Check if user agent indicates a bot/crawler
   * @param {string} userAgent - User agent string
   * @returns {boolean} - True if bot detected
   */
  isBot(userAgent) {
    return this.botPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Get default device information
   * @returns {Object} - Default device info
   */
  getDefaultDeviceInfo() {
    return {
      browser: {
        name: 'unknown',
        version: 'unknown',
        major_version: null
      },
      os: {
        name: 'unknown',
        version: 'unknown',
        family: 'unknown'
      },
      device: {
        type: 'unknown',
        is_mobile: false,
        is_tablet: false,
        is_desktop: false
      },
      is_bot: false,
      raw_user_agent: ''
    };
  }

  /**
   * Parse multiple user agent strings in batch
   * @param {Array<string>} userAgents - Array of user agent strings
   * @returns {Array<Object>} - Array of parsed device information
   */
  batchParseUserAgents(userAgents) {
    if (!Array.isArray(userAgents)) {
      throw new Error('User agents must be an array');
    }

    return userAgents.map((ua, index) => {
      try {
        return {
          index,
          userAgent: ua,
          parsed: this.parseUserAgent(ua),
          error: null
        };
      } catch (error) {
        return {
          index,
          userAgent: ua,
          parsed: this.getDefaultDeviceInfo(),
          error: error.message
        };
      }
    });
  }

  /**
   * Get browser market share category
   * @param {string} browserName - Browser name
   * @returns {string} - Market share category
   */
  getBrowserCategory(browserName) {
    const majorBrowsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];
    return majorBrowsers.includes(browserName) ? 'major' : 'minor';
  }

  /**
   * Check if browser version is outdated
   * @param {string} browserName - Browser name
   * @param {number} majorVersion - Major version number
   * @returns {boolean} - True if outdated
   */
  isOutdatedBrowser(browserName, majorVersion) {
    const minVersions = {
      'Chrome': 90,
      'Firefox': 88,
      'Safari': 14,
      'Edge': 90
    };

    const minVersion = minVersions[browserName];
    if (!minVersion || !majorVersion) {
      return false;
    }
    return majorVersion < minVersion;
  }

  /**
   * Extract screen resolution from user agent (if available)
   * @param {string} userAgent - User agent string
   * @returns {Object|null} - Screen resolution or null
   */
  extractScreenResolution(userAgent) {
    const resolutionPattern = /(\d{3,4})x(\d{3,4})/;
    const match = userAgent.match(resolutionPattern);
    
    if (match) {
      return {
        width: parseInt(match[1]),
        height: parseInt(match[2])
      };
    }
    
    return null;
  }

  /**
   * Get device capabilities based on parsed information
   * @param {Object} deviceInfo - Parsed device information
   * @returns {Object} - Device capabilities
   */
  getDeviceCapabilities(deviceInfo) {
    const capabilities = {
      touch_support: deviceInfo.device.is_mobile || deviceInfo.device.is_tablet,
      javascript_enabled: true, // Assume true since we're parsing UA
      cookies_enabled: null, // Cannot determine from UA alone
      local_storage_support: true, // Modern browsers support this
      webgl_support: null, // Cannot determine from UA alone
      canvas_support: true // Modern browsers support this
    };

    // Adjust based on browser
    if (deviceInfo.browser.name === 'Internet Explorer' && 
        deviceInfo.browser.major_version < 11) {
      capabilities.local_storage_support = false;
      capabilities.canvas_support = false;
    }

    return capabilities;
  }
}

module.exports = UserAgentParsingService;