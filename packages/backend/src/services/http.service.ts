/**
 * HTTP Service
 * Provides HTTP client with retry logic and timeout handling
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { logger } from '../config/logger.js';
import { TIMEOUTS, HTTP_RETRY, HTTP_STATUS } from '../config/constants.js';
import type {
  HttpService as IHttpService,
  HttpRequestOptions,
  HttpResponse,
} from '../types/job.types.js';

export class HttpService implements IHttpService {
  private client: AxiosInstance;
  private defaultTimeout = TIMEOUTS.HTTP_REQUEST;
  private defaultRetries = HTTP_RETRY.DEFAULT_RETRIES;

  constructor() {
    this.client = axios.create({
      timeout: this.defaultTimeout,
      headers: {
        'User-Agent': 'NxForge/1.0',
      },
    });

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('HTTP request successful', {
          method: response.config.method?.toUpperCase(),
          url: response.config.url,
          status: response.status,
        });
        return response;
      },
      (error) => {
        logger.debug('HTTP request failed', {
          method: error.config?.method?.toUpperCase(),
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Perform GET request
   */
  async get<T = any>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    return this.request<T>('GET', url, undefined, options);
  }

  /**
   * Perform POST request
   */
  async post<T = any>(
    url: string,
    data?: any,
    options: HttpRequestOptions = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>('POST', url, data, options);
  }

  /**
   * Perform PUT request
   */
  async put<T = any>(
    url: string,
    data?: any,
    options: HttpRequestOptions = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>('PUT', url, data, options);
  }

  /**
   * Perform DELETE request
   */
  async delete<T = any>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    return this.request<T>('DELETE', url, undefined, options);
  }

  /**
   * Perform PATCH request
   */
  async patch<T = any>(
    url: string,
    data?: any,
    options: HttpRequestOptions = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>('PATCH', url, data, options);
  }

  /**
   * Generic request method with retry logic
   */
  private async request<T = any>(
    method: string,
    url: string,
    data?: any,
    options: HttpRequestOptions = {}
  ): Promise<HttpResponse<T>> {
    const {
      headers = {},
      timeout = this.defaultTimeout,
      retries = this.defaultRetries,
    } = options;

    const config: AxiosRequestConfig = {
      method,
      url,
      data,
      headers,
      timeout,
    };

    let lastError: any;
    let attempt = 0;

    while (attempt <= retries) {
      try {
        const response = await this.client.request<T>(config);

        return {
          data: response.data,
          status: response.status,
          headers: response.headers as Record<string, string>,
        };
      } catch (error: any) {
        lastError = error;
        attempt++;

        // Don't retry on client errors (4xx) except 429 (rate limit)
        if (
          error.response?.status &&
          error.response.status >= HTTP_STATUS.BAD_REQUEST &&
          error.response.status < HTTP_STATUS.INTERNAL_SERVER_ERROR &&
          error.response.status !== HTTP_STATUS.TOO_MANY_REQUESTS
        ) {
          break;
        }

        // Don't retry if no more attempts left
        if (attempt > retries) {
          break;
        }

        // Calculate exponential backoff delay
        const delay = Math.min(HTTP_RETRY.INITIAL_BACKOFF * Math.pow(2, attempt - 1), HTTP_RETRY.MAX_BACKOFF);

        logger.warn(`HTTP request failed, retrying in ${delay}ms (attempt ${attempt}/${retries})`, {
          method,
          url,
          status: error.response?.status,
          message: error.message,
        });

        await this.sleep(delay);
      }
    }

    // All retries failed
    const errorMessage = lastError.response
      ? `HTTP ${method} ${url} failed with status ${lastError.response.status}: ${lastError.response.statusText}`
      : `HTTP ${method} ${url} failed: ${lastError.message}`;

    logger.error(errorMessage, {
      method,
      url,
      attempts: attempt,
      error: lastError.message,
    });

    throw new Error(errorMessage);
  }

  /**
   * Download file from URL
   */
  async downloadFile(url: string, options: HttpRequestOptions = {}): Promise<Buffer> {
    const { headers = {}, timeout = HTTP_RETRY.DOWNLOAD_TIMEOUT } = options;

    try {
      const response = await this.client.get(url, {
        headers,
        timeout,
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (error: any) {
      const errorMessage = error.response
        ? `File download failed with status ${error.response.status}`
        : `File download failed: ${error.message}`;

      logger.error(errorMessage, { url, error: error.message });
      throw new Error(errorMessage);
    }
  }

  /**
   * Check if URL is accessible
   */
  async checkUrl(url: string, timeout = HTTP_RETRY.URL_CHECK_TIMEOUT): Promise<boolean> {
    try {
      const response = await this.client.head(url, { timeout });
      return response.status >= HTTP_STATUS.OK && response.status < HTTP_STATUS.BAD_REQUEST;
    } catch (error) {
      return false;
    }
  }

  /**
   * Perform multiple requests in parallel
   */
  async parallel<T = any>(
    requests: Array<{
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      url: string;
      data?: any;
      options?: HttpRequestOptions;
    }>
  ): Promise<HttpResponse<T>[]> {
    const promises = requests.map((req) =>
      this.request<T>(req.method, req.url, req.data, req.options)
    );

    return Promise.all(promises);
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      defaultTimeout: this.defaultTimeout,
      defaultRetries: this.defaultRetries,
    };
  }

  /**
   * Sleep helper for retry delay
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const httpService = new HttpService();
