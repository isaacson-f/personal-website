import { UserAgentInfo } from '../types';

interface BrowserPattern {
  name: string;
  pattern: RegExp;
}

interface OSPattern {
  name: string;
  pattern: RegExp;
}

interface DevicePattern {
  type: 'mobile' | 'tablet' | 'desktop';
  pattern: RegExp;
}

interface ParsedBrowser {
  name: string;
  version: string;
  major_version: number | null;
}

interface ParsedOS {
  name: string;
  version: string;
  family: string;
}

interface ParsedDevice {
  type: string;
  is_mobile: boolean;
  is_tablet: boolean;
  is_desktop: boolean;
}

/**
 * Service for parsing user agent strings to extract device and browser information
 * Uses lightweight regex-based parsing to avoid external dependencies
 */
export class UserAgentParsingService {
  private readonly browserPatterns: BrowserPattern[];
  private readonly osPatterns: OSPattern[];
  private readonly devicePatterns: DevicePattern[];
  private readonly botPatterns: RegExp[];

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
   */
  parseUserAgent(userAgent: string | null | undefined): UserAgentInfo {
    if (!userAgent || typeof userAgent !== 'string') {
      return this.getDefaultDeviceInfo();
    }

    const sanitizedUA = this.sanitizeUserAgent(userAgent);

    const browser = this.parseBrowser(sanitizedUA);
    const os = this.parseOperatingSystem(sanitizedUA);
    const device = this.parseDevice(sanitizedUA);

    return {
      browser: browser.name,
      browser_version: browser.version,
      os: os.name,
      os_version: os.version,
      device_type: device.type,
      is_mobile: device.is_mobile,
      is_tablet: device.is_tablet,
      is_desktop: device.is_desktop
    };
  }

  /**
   * Sanitize user agent string
   */
  private sanitizeUserAgent(userAgent: string): string {
    return userAgent
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Parse browser information from user agent
   */
  private parseBrowser(userAgent: string): ParsedBrowser {
    for (const browser of this.browserPatterns) {
      const match = userAgent.match(browser.pattern);
      if (match) {
        return {
          name: browser.name,
          version: match[1] || 'unknown',
          major_version: match[1] ? parseInt(match[1].split('.')[0]!) : null
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
   */
  private parseOperatingSystem(userAgent: string): ParsedOS {
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
   */
  private getOSFamily(osName: string): string {
    if (osName.includes('Windows')) return 'Windows';
    if (osName.includes('macOS') || osName.includes('iOS')) return 'Apple';
    if (osName.includes('Android')) return 'Android';
    if (osName.includes('Linux') || osName.includes('Ubuntu')) return 'Linux';
    if (osName.includes('Chrome OS')) return 'Chrome OS';
    return 'unknown';
  }

  /**
   * Parse device information from user agent
   */
  private parseDevice(userAgent: string): ParsedDevice {
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
   */
  isBot(userAgent: string): boolean {
    return this.botPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Get default device information
   */
  private getDefaultDeviceInfo(): UserAgentInfo {
    return {
      browser: 'unknown',
      browser_version: 'unknown',
      os: 'unknown',
      os_version: 'unknown',
      device_type: 'unknown',
      is_mobile: false,
      is_tablet: false,
      is_desktop: false
    };
  }

  /**
   * Parse multiple user agent strings in batch
   */
  batchParseUserAgents(userAgents: string[]): Array<{
    index: number;
    userAgent: string;
    parsed: UserAgentInfo;
    error: string | null;
  }> {
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
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          index,
          userAgent: ua,
          parsed: this.getDefaultDeviceInfo(),
          error: message
        };
      }
    });
  }

  /**
   * Get browser market share category
   */
  getBrowserCategory(browserName: string): 'major' | 'minor' {
    const majorBrowsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];
    return majorBrowsers.includes(browserName) ? 'major' : 'minor';
  }

  /**
   * Check if browser version is outdated
   */
  isOutdatedBrowser(browserName: string, majorVersion: number | null): boolean {
    const minVersions: Record<string, number> = {
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
   */
  extractScreenResolution(userAgent: string): { width: number; height: number } | null {
    const resolutionPattern = /(\d{3,4})x(\d{3,4})/;
    const match = userAgent.match(resolutionPattern);
    
    if (match) {
      return {
        width: parseInt(match[1]!),
        height: parseInt(match[2]!)
      };
    }
    
    return null;
  }

  /**
   * Get device capabilities based on parsed information
   */
  getDeviceCapabilities(deviceInfo: UserAgentInfo): {
    touch_support: boolean;
    javascript_enabled: boolean;
    cookies_enabled: null;
    local_storage_support: boolean;
    webgl_support: null;
    canvas_support: boolean;
  } {
    const capabilities = {
      touch_support: deviceInfo.is_mobile || deviceInfo.is_tablet,
      javascript_enabled: true, // Assume true since we're parsing UA
      cookies_enabled: null, // Cannot determine from UA alone
      local_storage_support: true, // Modern browsers support this
      webgl_support: null, // Cannot determine from UA alone
      canvas_support: true // Modern browsers support this
    };

    // Adjust based on browser
    if (deviceInfo.browser === 'Internet Explorer') {
      const majorVersion = parseInt(deviceInfo.browser_version.split('.')[0]!);
      if (majorVersion < 11) {
        capabilities.local_storage_support = false;
        capabilities.canvas_support = false;
      }
    }

    return capabilities;
  }
}