/**
 * Scraper Utility for Consumption Monitor
 * Uses the core browserService for Playwright automation
 */

import type { Page } from 'playwright';
import type { BrowserService, BrowserSession, Logger } from '../types/index.js';

export interface AuthConfig {
  username?: string;
  password?: string;
  usernameSelector?: string;
  passwordSelector?: string;
  submitSelector?: string;
  loginUrl?: string;
}

export interface ScrapingStep {
  action: 'goto' | 'click' | 'fill' | 'wait' | 'waitForSelector' | 'extract';
  selector?: string;
  value?: string;
  timeout?: number;
}

export interface ScrapingConfig {
  steps?: ScrapingStep[];
  valueSelector?: string;
  valueRegex?: string;
  additionalSelectors?: {
    voltage?: string;
    current?: string;
    power?: string;
    powerFactor?: string;
  };
}

export interface ScrapeOptions {
  screenshotOnError?: boolean;
}

export interface ScrapeResult {
  success: boolean;
  value: number | null;
  error?: string;
  screenshot?: string;
  rawHtml?: string;
  additionalData?: {
    voltage?: number;
    current?: number;
    power?: number;
    powerFactor?: number;
  };
}

/**
 * Perform web scraping using the core browserService
 */
export async function scrape(
  browserService: BrowserService,
  url: string,
  authType: 'none' | 'basic' | 'form',
  authConfig: AuthConfig | null,
  scrapingConfig: ScrapingConfig | null,
  options: ScrapeOptions,
  logger: Logger
): Promise<ScrapeResult> {
  let session: BrowserSession | null = null;
  let page: Page | null = null;

  try {
    // Create browser session
    session = await browserService.createSession({ headless: true });
    const newPage = await session.newPage();
    page = newPage;

    logger.info(`[Scraper] Navigating to ${url}`);

    // Handle basic auth by encoding in URL
    if (authType === 'basic' && authConfig?.username && authConfig?.password) {
      const urlObj = new URL(url);
      urlObj.username = authConfig.username;
      urlObj.password = authConfig.password;
      await newPage.goto(urlObj.toString(), { waitUntil: 'networkidle' });
    } else {
      await newPage.goto(url, { waitUntil: 'networkidle' });
    }

    // Handle form-based authentication
    if (authType === 'form' && authConfig) {
      await handleFormAuth(newPage, authConfig, logger);
    }

    // Execute custom scraping steps if provided
    if (scrapingConfig?.steps && scrapingConfig.steps.length > 0) {
      await executeScrapingSteps(newPage, scrapingConfig.steps, logger);
    }

    // Extract the main consumption value
    let value: number | null = null;
    if (scrapingConfig?.valueSelector) {
      value = await extractNumericValue(newPage, scrapingConfig.valueSelector, scrapingConfig.valueRegex, logger);
    }

    // Extract additional metrics if configured
    const additionalData: ScrapeResult['additionalData'] = {};
    if (scrapingConfig?.additionalSelectors) {
      const { voltage, current, power, powerFactor } = scrapingConfig.additionalSelectors;

      if (voltage) {
        additionalData.voltage = await extractNumericValue(newPage, voltage, undefined, logger) ?? undefined;
      }
      if (current) {
        additionalData.current = await extractNumericValue(newPage, current, undefined, logger) ?? undefined;
      }
      if (power) {
        additionalData.power = await extractNumericValue(newPage, power, undefined, logger) ?? undefined;
      }
      if (powerFactor) {
        additionalData.powerFactor = await extractNumericValue(newPage, powerFactor, undefined, logger) ?? undefined;
      }
    }

    // Capture raw HTML for debugging
    const rawHtml = await newPage.content();

    logger.info(`[Scraper] Successfully scraped value: ${value}`);

    return {
      success: true,
      value,
      rawHtml,
      additionalData: Object.keys(additionalData).length > 0 ? additionalData : undefined,
    };
  } catch (error: any) {
    logger.error(`[Scraper] Scraping failed: ${error.message}`);

    let screenshot: string | undefined;
    if (options.screenshotOnError && page) {
      try {
        const buffer = await page.screenshot({ fullPage: true });
        screenshot = buffer.toString('base64');
      } catch (screenshotError) {
        logger.error('[Scraper] Failed to capture error screenshot');
      }
    }

    return {
      success: false,
      value: null,
      error: error.message,
      screenshot,
    };
  } finally {
    // Always close the session
    if (session) {
      try {
        await session.close();
      } catch (closeError) {
        logger.error('[Scraper] Failed to close browser session');
      }
    }
  }
}

/**
 * Handle form-based authentication
 */
async function handleFormAuth(page: Page, authConfig: AuthConfig, logger: Logger): Promise<void> {
  const {
    loginUrl,
    usernameSelector = 'input[name="username"], input[type="text"]',
    passwordSelector = 'input[name="password"], input[type="password"]',
    submitSelector = 'button[type="submit"], input[type="submit"]',
    username,
    password,
  } = authConfig;

  // Navigate to login page if specified
  if (loginUrl) {
    logger.info(`[Scraper] Navigating to login page: ${loginUrl}`);
    await page.goto(loginUrl, { waitUntil: 'networkidle' });
  }

  if (!username || !password) {
    throw new Error('Username and password required for form authentication');
  }

  logger.info('[Scraper] Performing form authentication');

  // Fill credentials
  await page.fill(usernameSelector, username);
  await page.fill(passwordSelector, password);

  // Submit form
  await page.click(submitSelector);

  // Wait for navigation after login
  await page.waitForLoadState('networkidle');

  logger.info('[Scraper] Form authentication completed');
}

/**
 * Execute custom scraping steps
 */
async function executeScrapingSteps(page: Page, steps: ScrapingStep[], logger: Logger): Promise<void> {
  for (const step of steps) {
    const timeout = step.timeout || 30000;

    switch (step.action) {
      case 'goto':
        if (step.value) {
          logger.info(`[Scraper] Step: Navigate to ${step.value}`);
          await page.goto(step.value, { waitUntil: 'networkidle', timeout });
        }
        break;

      case 'click':
        if (step.selector) {
          logger.info(`[Scraper] Step: Click ${step.selector}`);
          await page.click(step.selector, { timeout });
        }
        break;

      case 'fill':
        if (step.selector && step.value !== undefined) {
          logger.info(`[Scraper] Step: Fill ${step.selector}`);
          await page.fill(step.selector, step.value, { timeout });
        }
        break;

      case 'wait':
        const waitTime = parseInt(step.value || '1000', 10);
        logger.info(`[Scraper] Step: Wait ${waitTime}ms`);
        await page.waitForTimeout(waitTime);
        break;

      case 'waitForSelector':
        if (step.selector) {
          logger.info(`[Scraper] Step: Wait for ${step.selector}`);
          await page.waitForSelector(step.selector, { timeout });
        }
        break;

      case 'extract':
        // Extract is handled separately by the main scrape function
        break;

      default:
        logger.warn(`[Scraper] Unknown step action: ${step.action}`);
    }
  }
}

/**
 * Extract a numeric value from an element
 */
async function extractNumericValue(
  page: Page,
  selector: string,
  regex?: string,
  logger?: Logger
): Promise<number | null> {
  try {
    const element = await page.$(selector);
    if (!element) {
      logger?.warn(`[Scraper] Element not found: ${selector}`);
      return null;
    }

    const text = await element.textContent();
    if (!text) {
      logger?.warn(`[Scraper] No text content in element: ${selector}`);
      return null;
    }

    let valueStr = text.trim();

    // Apply regex extraction if provided
    if (regex) {
      const match = valueStr.match(new RegExp(regex));
      if (match && match[1]) {
        valueStr = match[1];
      } else if (match && match[0]) {
        valueStr = match[0];
      }
    }

    // Extract numeric value (handle comma as decimal separator)
    const cleanedStr = valueStr.replace(/[^\d.,\-]/g, '').replace(',', '.');
    const value = parseFloat(cleanedStr);

    if (isNaN(value)) {
      logger?.warn(`[Scraper] Failed to parse numeric value from: ${text}`);
      return null;
    }

    return value;
  } catch (error: any) {
    logger?.error(`[Scraper] Failed to extract value from ${selector}: ${error.message}`);
    return null;
  }
}
