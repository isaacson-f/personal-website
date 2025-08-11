const https = require('https');

/**
 * Service for resolving IP addresses to geographic locations
 * Uses ip-api.com for free IP geolocation (15 requests/minute limit)
 */
class GeolocationService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
    this.rateLimitDelay = 4000; // 4 seconds between requests to respect rate limits
    this.lastRequestTime = 0;
  }

  /**
   * Resolve IP address to geographic location
   * @param {string} ipAddress - IP address to resolve
   * @returns {Promise<Object>} - Geographic data object
   */
  async resolveLocation(ipAddress) {
    // Skip localhost and private IPs
    if (this.isPrivateIP(ipAddress)) {
      return this.getDefaultLocation();
    }

    // Check cache first
    const cached = this.getCachedLocation(ipAddress);
    if (cached) {
      return cached;
    }

    try {
      // Rate limiting
      await this.enforceRateLimit();

      const locationData = await this.fetchLocationData(ipAddress);
      
      // Cache the result
      this.cacheLocation(ipAddress, locationData);
      
      return locationData;
    } catch (error) {
      console.error(`Failed to resolve location for IP ${ipAddress}:`, error.message);
      return this.getDefaultLocation();
    }
  }

  /**
   * Check if IP address is private/local
   * @param {string} ipAddress - IP address to check
   * @returns {boolean} - True if private IP
   */
  isPrivateIP(ipAddress) {
    if (!ipAddress || ipAddress === '::1' || ipAddress === '127.0.0.1') {
      return true;
    }

    // IPv4 private ranges
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./ // Link-local
    ];

    return privateRanges.some(range => range.test(ipAddress));
  }

  /**
   * Get cached location data
   * @param {string} ipAddress - IP address
   * @returns {Object|null} - Cached location data or null
   */
  getCachedLocation(ipAddress) {
    const cached = this.cache.get(ipAddress);
    if (!cached) return null;

    // Check if cache entry has expired
    if (Date.now() - cached.timestamp > this.cacheExpiry) {
      this.cache.delete(ipAddress);
      return null;
    }

    return cached.data;
  }

  /**
   * Cache location data
   * @param {string} ipAddress - IP address
   * @param {Object} locationData - Location data to cache
   */
  cacheLocation(ipAddress, locationData) {
    this.cache.set(ipAddress, {
      data: locationData,
      timestamp: Date.now()
    });

    // Prevent cache from growing too large
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  /**
   * Enforce rate limiting for API requests
   * @returns {Promise<void>}
   */
  async enforceRateLimit() {
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Fetch location data from IP geolocation API
   * @param {string} ipAddress - IP address to resolve
   * @returns {Promise<Object>} - Location data
   */
  async fetchLocationData(ipAddress) {
    return new Promise((resolve, reject) => {
      const url = `https://ip-api.com/json/${ipAddress}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as`;
      
      const request = https.get(url, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            
            if (parsed.status === 'fail') {
              reject(new Error(parsed.message || 'Failed to resolve IP location'));
              return;
            }
            
            resolve(this.formatLocationData(parsed));
          } catch (error) {
            reject(new Error('Failed to parse location response'));
          }
        });
      });
      
      request.on('error', (error) => {
        reject(error);
      });
      
      request.setTimeout(5000, () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * Format location data into standardized format
   * @param {Object} rawData - Raw API response data
   * @returns {Object} - Formatted location data
   */
  formatLocationData(rawData) {
    return {
      country: rawData.country || null,
      country_code: rawData.countryCode || null,
      region: rawData.regionName || null,
      region_code: rawData.region || null,
      city: rawData.city || null,
      zip_code: rawData.zip || null,
      latitude: rawData.lat || null,
      longitude: rawData.lon || null,
      timezone: rawData.timezone || null,
      isp: rawData.isp || null,
      organization: rawData.org || null,
      as_number: rawData.as || null
    };
  }

  /**
   * Get default location data for private/local IPs
   * @returns {Object} - Default location data
   */
  getDefaultLocation() {
    return {
      country: null,
      country_code: null,
      region: null,
      region_code: null,
      city: null,
      zip_code: null,
      latitude: null,
      longitude: null,
      timezone: null,
      isp: null,
      organization: null,
      as_number: null
    };
  }

  /**
   * Batch resolve multiple IP addresses
   * @param {Array<string>} ipAddresses - Array of IP addresses
   * @returns {Promise<Array<Object>>} - Array of location data objects
   */
  async batchResolveLocations(ipAddresses) {
    const results = [];
    
    for (const ip of ipAddresses) {
      try {
        const location = await this.resolveLocation(ip);
        results.push({ ip, location, error: null });
      } catch (error) {
        results.push({ ip, location: this.getDefaultLocation(), error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Clear the location cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: 1000,
      expiryTime: this.cacheExpiry
    };
  }
}

module.exports = GeolocationService;