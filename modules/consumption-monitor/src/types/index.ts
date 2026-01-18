// Browser service interface (matches core BrowserService)
export interface BrowserService {
  createSession(options?: BrowserOptions): Promise<BrowserSession>;
  closeSession(sessionId: string): Promise<void>;
  closeAllSessions(): Promise<void>;
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

// Logger interface (matches core Logger)
export interface Logger {
  debug(message: string, meta?: Record<string, any>): void;
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, error?: Error | Record<string, any>): void;
}

// Module context for routes/plugin
export interface ModuleContext {
    module: {
        id: string;
        name: string;
        version: string;
        config?: Record<string, unknown>;
    };
    services: {
        prisma: any;
        logger: Logger;
        browser: BrowserService;
    };
}

// Job context provided by core job executor (matches core JobContext)
export interface JobContext {
  config: Record<string, any>;
  module: {
    id: string;
    name: string;
    config: Record<string, any>;
  };
  services: {
    prisma: any;
    browser: BrowserService;
    notifications: any;
    http: any;
    logger: Logger;
    database: any;
    events: any;
  };
}
