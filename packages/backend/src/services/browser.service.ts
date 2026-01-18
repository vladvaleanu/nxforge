/**
 * Browser Service
 * Provides Playwright browser automation capabilities
 */

import { chromium, firefox, webkit, Browser, BrowserContext, Page } from 'playwright';
import { logger } from '../config/logger.js';
import { TIMEOUTS, BROWSER } from '../config/constants.js';
import type { BrowserService as IBrowserService, BrowserOptions, BrowserSession } from '../types/job.types.js';

export class BrowserService implements IBrowserService {
  private activeBrowsers = new Map<string, Browser>();
  private activeSessions = new Map<string, BrowserSessionImpl>();

  /**
   * Create a new browser session
   */
  async createSession(options: BrowserOptions = {}): Promise<BrowserSession> {
    const sessionId = this.generateSessionId();

    const {
      headless = true,
      timeout = TIMEOUTS.BROWSER_NAVIGATION,
      viewport = BROWSER.DEFAULT_VIEWPORT,
      browserType = 'chromium',
    } = options as BrowserOptions & { browserType?: 'chromium' | 'firefox' | 'webkit' };

    try {
      // Launch browser
      let browser: Browser;
      switch (browserType) {
        case 'firefox':
          browser = await firefox.launch({ headless });
          break;
        case 'webkit':
          browser = await webkit.launch({ headless });
          break;
        case 'chromium':
        default:
          browser = await chromium.launch({ headless });
          break;
      }

      // Create context with viewport settings
      const context = await browser.newContext({
        viewport,
        userAgent: BROWSER.DEFAULT_USER_AGENT,
      });

      // Set default timeout
      context.setDefaultTimeout(timeout);

      // Store browser reference
      this.activeBrowsers.set(sessionId, browser);

      // Create and store session
      const session = new BrowserSessionImpl(sessionId, browser, context, this);
      this.activeSessions.set(sessionId, session);

      logger.info(`Browser session created: ${sessionId}`, {
        browserType,
        headless,
        viewport,
      });

      return session;
    } catch (error: any) {
      logger.error(`Failed to create browser session: ${error.message}`, error);
      throw new Error(`Failed to create browser session: ${error.message}`);
    }
  }

  /**
   * Close a browser session
   */
  async closeSession(sessionId: string): Promise<void> {
    const browser = this.activeBrowsers.get(sessionId);
    const session = this.activeSessions.get(sessionId);

    if (browser) {
      await browser.close();
      this.activeBrowsers.delete(sessionId);
      logger.info(`Browser session closed: ${sessionId}`);
    }

    if (session) {
      this.activeSessions.delete(sessionId);
    }
  }

  /**
   * Close all active browser sessions
   */
  async closeAllSessions(): Promise<void> {
    logger.info(`Closing ${this.activeBrowsers.size} active browser sessions...`);

    const closePromises = Array.from(this.activeBrowsers.keys()).map((sessionId) =>
      this.closeSession(sessionId)
    );

    await Promise.all(closePromises);
    logger.info('All browser sessions closed');
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.activeBrowsers.size;
  }

  /**
   * Get session statistics
   */
  getStats() {
    return {
      activeSessions: this.activeBrowsers.size,
      sessionIds: Array.from(this.activeBrowsers.keys()),
    };
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `browser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Browser Session Implementation
 */
class BrowserSessionImpl implements BrowserSession {
  private pages: Page[] = [];
  private closed = false;

  constructor(
    private sessionId: string,
    private _browser: Browser, // Stored for potential future use (e.g., lifecycle management)
    private context: BrowserContext,
    private service: BrowserService
  ) { }

  /**
   * Create a new page in this session
   */
  async newPage(): Promise<Page> {
    if (this.closed) {
      throw new Error('Browser session is closed');
    }

    const page = await this.context.newPage();
    this.pages.push(page);

    logger.debug(`New page created in session ${this.sessionId}`);
    return page;
  }

  /**
   * Close the browser session
   */
  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    // Close all pages
    await Promise.all(this.pages.map((page) => page.close().catch(() => { })));
    this.pages = [];

    // Close context and browser via service
    await this.service.closeSession(this.sessionId);

    this.closed = true;
  }

  /**
   * Get the browser context
   */
  getContext(): BrowserContext {
    return this.context;
  }

  /**
   * Get all pages in this session
   */
  getPages(): Page[] {
    return this.pages;
  }

  /**
   * Check if session is closed
   */
  isClosed(): boolean {
    return this.closed;
  }

  /**
   * Get the browser instance for this session
   */
  getBrowser(): Browser {
    return this._browser;
  }
}

// Singleton instance
export const browserService = new BrowserService();
