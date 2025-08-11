import https from 'https';
import { GeolocationData } from '../types';

interface CacheEntry {
  data: GeolocationData;
  timestamp: number;
}

interface LocationApiResponse {
  status: string;
  message?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  zip?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  isp?: string;
  org?: string;
  as?: string;
}

/**
 * Service for resolving IP addresses to geographic locations
 * Uses ip-api.com for free IP geolocation (15 requests/minute limit)
 */
export class GeolocationService {
  private cache: Map<string, CacheEntry>;
  private readonly cacheExpiry: number;
  private readonly rateLimitDelay: number;
  private lastRequestTime: number;

  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
    this.rateLimitDelay = 4000; // 4 seconds between requests to respect rate limits
    this.lastRequestTime = 0;
  }

  /**
   * Resolve IP address to geographic location
   */
  async resolveLocation(ipAddress: string): Promise<GeolocationData> {
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
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to resolve location for IP ${ipAddress}:`, message);
      return this.getDefaultLocation();
    }
  }

  /**
   * Check if IP address is private/local
   */
  private isPrivateIP(ipAddress: string): boolean {
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
   */
  private getCachedLocation(ipAddress: string): GeolocationData | null {
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
   */
  private cacheLocation(ipAddress: string, locationData: GeolocationData): void {
    this.cache.set(ipAddress, {
      data: locationData,
      timestamp: Date.now()
    });

    // Prevent cache from growing too large
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }

  /**
   * Enforce rate limiting for API requests
   */
  private async enforceRateLimit(): Promise<void> {
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Fetch location data from IP geolocation API
   */
  private async fetchLocationData(ipAddress: string): Promise<GeolocationData> {
    return new Promise((resolve, reject) => {
      const url = `https://ip-api.com/json/${ipAddress}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as`;
      
      const request = https.get(url, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          try {
            const parsed: LocationApiResponse = JSON.parse(data);
            
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
   */
  private formatLocationData(rawData: LocationApiResponse): GeolocationData {
    const result: GeolocationData = {};
    
    if (rawData.country) result.country = rawData.country;
    if (rawData.regionName) result.region = rawData.regionName;
    if (rawData.city) result.city = rawData.city;
    if (rawData.lat) result.latitude = rawData.lat;
    if (rawData.lon) result.longitude = rawData.lon;
    if (rawData.timezone) result.timezone = rawData.timezone;
    
    return result;
  }

  /**
   * Get default location data for private/local IPs
   */
  private getDefaultLocation(): GeolocationData {
    return {};
  }

  /**
   * Batch resolve multiple IP addresses
   */
  async batchResolveLocations(ipAddresses: string[]): Promise<Array<{
    ip: string;
    location: GeolocationData;
    error: string | null;
  }>> {
    const results = [];
    
    for (const ip of ipAddresses) {
      try {
        const location = await this.resolveLocation(ip);
        results.push({ ip, location, error: null });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        results.push({ ip, location: this.getDefaultLocation(), error: message });
      }
    }
    
    return results;
  }

  /**
   * Clear the location cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    expiryTime: number;
  } {
    return {
      size: this.cache.size,
      maxSize: 1000,
      expiryTime: this.cacheExpiry
    };
  }
}