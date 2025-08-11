import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../config/database';
import { ValidationResult, ValidationError } from '../types';

/**
 * Base model class providing common functionality for all models
 */
export abstract class BaseModel {
  protected data: Record<string, any>;
  protected errors: ValidationError[];

  constructor(data: Record<string, any> = {}) {
    this.data = data;
    this.errors = [];
  }

  /**
   * Validate model data against schema
   */
  protected static validate<T>(schema: Joi.ObjectSchema, data: any): ValidationResult<T> {
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    return {
      isValid: !error,
      errors: error ? error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        type: detail.type
      })) : [],
      value
    };
  }

  /**
   * Execute a database query with error handling
   */
  protected static async executeQuery(sql: string, params: any[] = []): Promise<any> {
    try {
      return await query(sql, params);
    } catch (error) {
      console.error('Database query error:', {
        sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  protected static async executeTransaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    try {
      return await transaction(callback);
    } catch (error) {
      console.error('Transaction error:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Generate UUID for primary keys
   */
  protected static generateId(): string {
    return uuidv4();
  }

  /**
   * Get current timestamp
   */
  protected static getCurrentTimestamp(): Date {
    return new Date();
  }

  /**
   * Sanitize string input to prevent XSS
   */
  protected static sanitizeString(input: any): string | null {
    if (typeof input !== 'string') return input;
    
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .trim()
      .substring(0, 10000); // Limit length
  }

  /**
   * Validate and sanitize URL
   */
  protected static sanitizeUrl(url: any): string | null {
    if (!url || typeof url !== 'string') return null;
    
    try {
      // Allow relative URLs and full URLs
      if (url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://')) {
        return url.substring(0, 2048); // Limit URL length
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate IP address
   */
  protected static validateIpAddress(ip: any): string | null {
    if (!ip || typeof ip !== 'string') return null;
    
    // Basic IPv4 and IPv6 validation
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    if (ipv4Regex.test(ip) || ipv6Regex.test(ip)) {
      return ip;
    }
    
    return null;
  }
}