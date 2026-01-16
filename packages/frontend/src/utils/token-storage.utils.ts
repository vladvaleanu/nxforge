/**
 * Token storage utilities with in-memory caching
 * Caches localStorage access to avoid repeated DOM operations
 */

class TokenStorage {
  private accessTokenCache: string | null = null;
  private refreshTokenCache: string | null = null;
  private isInitialized = false;

  /**
   * Initialize cache from localStorage
   */
  private init() {
    if (!this.isInitialized) {
      this.accessTokenCache = localStorage.getItem('accessToken');
      this.refreshTokenCache = localStorage.getItem('refreshToken');
      this.isInitialized = true;
    }
  }

  /**
   * Get access token (from cache or localStorage)
   */
  getAccessToken(): string | null {
    this.init();
    return this.accessTokenCache;
  }

  /**
   * Get refresh token (from cache or localStorage)
   */
  getRefreshToken(): string | null {
    this.init();
    return this.refreshTokenCache;
  }

  /**
   * Set access token (updates both cache and localStorage)
   */
  setAccessToken(token: string): void {
    this.accessTokenCache = token;
    localStorage.setItem('accessToken', token);
  }

  /**
   * Set refresh token (updates both cache and localStorage)
   */
  setRefreshToken(token: string): void {
    this.refreshTokenCache = token;
    localStorage.setItem('refreshToken', token);
  }

  /**
   * Clear all tokens (from both cache and localStorage)
   */
  clearTokens(): void {
    this.accessTokenCache = null;
    this.refreshTokenCache = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  /**
   * Clear cache and re-read from localStorage
   * Useful if localStorage was modified externally
   */
  refresh(): void {
    this.isInitialized = false;
    this.init();
  }
}

// Export singleton instance
export const tokenStorage = new TokenStorage();
