import { GeolocationData } from '../types';
/**
 * Service for resolving IP addresses to geographic locations
 * Uses ip-api.com for free IP geolocation (15 requests/minute limit)
 */
export declare class GeolocationService {
    private cache;
    private readonly cacheExpiry;
    private readonly rateLimitDelay;
    private lastRequestTime;
    constructor();
    /**
     * Resolve IP address to geographic location
     */
    resolveLocation(ipAddress: string): Promise<GeolocationData>;
    /**
     * Check if IP address is private/local
     */
    private isPrivateIP;
    /**
     * Get cached location data
     */
    private getCachedLocation;
    /**
     * Cache location data
     */
    private cacheLocation;
    /**
     * Enforce rate limiting for API requests
     */
    private enforceRateLimit;
    /**
     * Fetch location data from IP geolocation API
     */
    private fetchLocationData;
    /**
     * Format location data into standardized format
     */
    private formatLocationData;
    /**
     * Get default location data for private/local IPs
     */
    private getDefaultLocation;
    /**
     * Batch resolve multiple IP addresses
     */
    batchResolveLocations(ipAddresses: string[]): Promise<Array<{
        ip: string;
        location: GeolocationData;
        error: string | null;
    }>>;
    /**
     * Clear the location cache
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        maxSize: number;
        expiryTime: number;
    };
}
//# sourceMappingURL=GeolocationService.d.ts.map