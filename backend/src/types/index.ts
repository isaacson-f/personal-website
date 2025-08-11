// Database types
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number | null;
  command: string;
}

// Event types
export interface EventData {
  id?: string;
  session_id: string;
  event_type: EventType;
  url: string;
  url_hash?: string | null;
  referrer?: string | null;
  user_agent?: string | null;
  ip_address?: string | null;
  timestamp?: Date;
  properties?: Record<string, any> | null;
  created_at?: Date;
}

export interface PageViewData {
  id?: string;
  session_id: string;
  url: string;
  url_hash?: string | null;
  title?: string | null;
  load_time?: number | null;
  scroll_depth?: number | null;
  time_on_page?: number | null;
  exit_page?: boolean;
  timestamp?: Date;
  created_at?: Date;
}

export interface SessionData {
  id: string;
  visitor_id?: string | null;
  cookie_id?: string | null;
  start_time: Date;
  end_time?: Date | null;
  page_views?: number;
  duration_seconds?: number | null;
  browser_fingerprint?: string | null;
  device_info?: Record<string, any>;
  geographic_data?: Record<string, any>;
  is_returning_visitor?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface VisitorData {
  id: string;
  first_visit: Date;
  last_visit?: Date | null;
  total_sessions?: number;
  total_page_views?: number;
  user_agent?: string | null;
  ip_address?: string | null;
  geographic_data?: Record<string, any>;
  device_info?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}

// Enums
export enum EventType {
  PAGE_VIEW = 'page_view',
  CLICK = 'click',
  SCROLL = 'scroll',
  FORM_SUBMIT = 'form_submit',
  CUSTOM = 'custom',
  SESSION_START = 'session_start',
  SESSION_END = 'session_end'
}

// Validation types
export interface ValidationResult<T = any> {
  isValid: boolean;
  errors: ValidationError[];
  value?: T;
}

export interface ValidationError {
  field: string;
  message: string;
  type: string;
}

// API types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  page?: number;
}

export interface FilterOptions {
  eventType?: EventType;
  url?: string;
  dateFrom?: Date;
  dateTo?: Date;
  sessionId?: string;
}

// Statistics types
export interface EventStatistics {
  total_events: number;
  unique_sessions: number;
  unique_event_types: number;
  unique_urls: number;
  last_event_time: Date | null;
  first_event_time: Date | null;
}

export interface EventTypeCount {
  event_type: EventType;
  count: number;
  unique_sessions: number;
}

export interface PopularUrl {
  url: string;
  count: number;
  unique_sessions: number;
}

// Service types
export interface GeolocationData {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

export interface DeviceInfo {
  browser?: string;
  browser_version?: string;
  os?: string;
  os_version?: string;
  device_type?: string;
  is_mobile?: boolean;
  is_tablet?: boolean;
  is_desktop?: boolean;
}

export interface UserAgentInfo {
  browser: string;
  browser_version: string;
  os: string;
  os_version: string;
  device_type: string;
  is_mobile: boolean;
  is_tablet: boolean;
  is_desktop: boolean;
}

// Express types extensions
declare global {
  namespace Express {
    interface Request {
      sessionId?: string;
      visitorId?: string;
      deviceInfo?: DeviceInfo;
      geolocation?: GeolocationData;
    }
  }
}

export {};