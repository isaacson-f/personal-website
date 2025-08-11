import Joi from 'joi';
import { ValidationResult, ValidationError } from '../types';
/**
 * Base model class providing common functionality for all models
 */
export declare abstract class BaseModel {
    protected data: Record<string, any>;
    protected errors: ValidationError[];
    constructor(data?: Record<string, any>);
    /**
     * Validate model data against schema
     */
    protected static validate<T>(schema: Joi.ObjectSchema, data: any): ValidationResult<T>;
    /**
     * Execute a database query with error handling
     */
    protected static executeQuery(sql: string, params?: any[]): Promise<any>;
    /**
     * Execute multiple queries in a transaction
     */
    protected static executeTransaction<T>(callback: (client: any) => Promise<T>): Promise<T>;
    /**
     * Generate UUID for primary keys
     */
    protected static generateId(): string;
    /**
     * Get current timestamp
     */
    protected static getCurrentTimestamp(): Date;
    /**
     * Sanitize string input to prevent XSS
     */
    protected static sanitizeString(input: any): string | null;
    /**
     * Validate and sanitize URL
     */
    protected static sanitizeUrl(url: any): string | null;
    /**
     * Validate IP address
     */
    protected static validateIpAddress(ip: any): string | null;
}
//# sourceMappingURL=BaseModel.d.ts.map