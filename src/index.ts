/**
 * @my-org/ad-sdk
 *
 * Ad Server SDK with React adapter
 *
 * @example
 * ```tsx
 * import { AdProvider, AdUnit } from '@my-org/ad-sdk';
 *
 * function App() {
 *   return (
 *     <AdProvider config={{ apiUrl: 'https://ads.example.com', apiKey: 'your-key' }}>
 *       <AdUnit zone="homepage-banner" />
 *     </AdProvider>
 *   );
 * }
 * ```
 */

// ============================================
// Core exports (Framework-agnostic)
// ============================================

export { AdClient } from './core/AdClient';

export type {
  AdConfig,
  AdResponse,
  AdApiResponse,
  FetchAdOptions,
  TrackImpressionOptions,
} from './core/types';

export { AdError, AdErrorCode } from './core/types';

// ============================================
// React adapter exports
// ============================================

// Context and Provider
export { AdProvider, useAdClient, useAdContext, AdContext } from './react/AdContext';
export type { AdProviderProps } from './react/AdContext';

// Hooks
export { useAd, usePrefetchAd } from './react/useAd';
export type { UseAdState, UseAdActions, UseAdOptions, UseAdResult } from './react/useAd';

// Components
export { AdUnit } from './react/AdUnit';
export type { AdUnitProps, AdRenderProps } from './react/AdUnit';
