/**
 * Shared types, utilities, and schemas
 * Phase 1: Foundation - Basic structure placeholder
 */

export const PLATFORM_VERSION = '1.0.0';

export interface PlatformConfig {
  version: string;
  environment: 'development' | 'staging' | 'production';
}
