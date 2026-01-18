/**
 * Job and Event System Types
 * Phase 3: Automation Runtime
 */

// Job execution status
export enum JobExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  TIMEOUT = 'TIMEOUT',
  CANCELLED = 'CANCELLED'
}

// Job definition
export interface Job {
  id: string;
  name: string;
  description?: string;
  moduleId: string;
  handler: string;
  schedule?: string;
  enabled: boolean;
  timeout: number;
  retries: number;
  config?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

// Job execution record
export interface JobExecution {
  id: string;
  jobId: string;
  status: JobExecutionStatus;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  result?: Record<string, any>;
  error?: string;
  logs?: string;
}

// Job schedule (cron-based)
export interface JobSchedule {
  id: string;
  jobId: string;
  schedule: string;
  timezone: string;
  nextRun?: Date;
  lastRun?: Date;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Event for pub/sub
export interface Event {
  id: string;
  name: string;
  source: string;
  payload: Record<string, any>;
  createdAt: Date;
}

// Context provided to job handlers
export interface JobContext {
  // Job configuration
  config: Record<string, any>;

  // Module information
  module: {
    id: string;
    name: string;
    config: Record<string, any>;
  };

  // Core shared services
  services: {
    prisma: any; // Prisma client for direct database access
    browser: BrowserService;
    notifications: NotificationService;
    http: HttpService;
    logger: Logger;
    database: DatabaseService;
    events: EventBusService;
  };
}

// Context provided to event handlers
export interface EventContext {
  // Event that triggered this handler
  event: Event;

  // Module information
  module: {
    id: string;
    name: string;
    config: Record<string, any>;
  };

  // Core shared services
  services: {
    notifications: NotificationService;
    http: HttpService;
    logger: Logger;
    database: DatabaseService;
    events: EventBusService;
  };
}

// Job handler function signature
export type JobHandler = (context: JobContext) => Promise<any>;

// Event handler function signature
export type EventHandler = (context: EventContext) => Promise<void>;

// Service interfaces (to be implemented in Phase 3)
export interface BrowserService {
  createSession(options?: BrowserOptions): Promise<BrowserSession>;
}

export interface BrowserOptions {
  headless?: boolean;
  timeout?: number;
  viewport?: { width: number; height: number };
}

export interface BrowserSession {
  newPage(): Promise<any>; // Playwright Page
  close(): Promise<void>;
}

export interface NotificationService {
  email(options: EmailOptions): Promise<void>;
  sms(options: SmsOptions): Promise<void>;
  webhook(options: WebhookOptions): Promise<void>;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  body: string;
  html?: string;
}

export interface SmsOptions {
  to: string;
  message: string;
}

export interface WebhookOptions {
  url: string;
  payload: Record<string, any>;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
}

export interface HttpService {
  get<T = any>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
  post<T = any>(url: string, data?: any, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
  put<T = any>(url: string, data?: any, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
  delete<T = any>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
}

export interface HttpRequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

export interface HttpResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export interface Logger {
  debug(message: string, meta?: Record<string, any>): void;
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, error?: Error | Record<string, any>): void;
}

export interface DatabaseService {
  // Prisma client is already available, this provides helpers
  transaction<T>(callback: () => Promise<T>): Promise<T>;
}

export interface EventBusService {
  emit(name: string, payload: Record<string, any>): Promise<void>;
  on(name: string, handler: EventHandler): void;
  off(name: string, handler: EventHandler): void;
}

// DTOs for API requests/responses
export interface CreateJobDTO {
  name: string;
  description?: string;
  moduleId: string;
  handler: string;
  schedule?: string;
  enabled?: boolean;
  timeout?: number;
  retries?: number;
  config?: Record<string, any>;
}

export interface UpdateJobDTO {
  name?: string;
  description?: string;
  handler?: string;
  schedule?: string | null; // null to remove schedule
  enabled?: boolean;
  timeout?: number;
  retries?: number;
  config?: Record<string, any>;
}

export interface ListJobsQuery {
  moduleId?: string;
  enabled?: boolean;
  page?: number;
  limit?: number;
}

export interface ListExecutionsQuery {
  jobId?: string;
  status?: JobExecutionStatus;
  page?: number;
  limit?: number;
}

export interface ListEventsQuery {
  name?: string;
  source?: string;
  since?: Date;
  page?: number;
  limit?: number;
}
