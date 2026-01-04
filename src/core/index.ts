/**
 * Core module exports
 * Framework-agnostic Ad SDK functionality
 */

// Client
export { AdClient } from './AdClient';

// Types
export type {
  AdConfig,
  AdResponse,
  AdApiResponse,
  FetchAdOptions,
  TrackImpressionOptions,
} from './types';

// Error handling
export { AdError, AdErrorCode } from './types';
