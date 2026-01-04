import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { AdClient } from '../core/AdClient';
import type { AdConfig } from '../core/types';

/**
 * Context value containing the AdClient instance
 */
interface AdContextValue {
  /** The AdClient instance */
  readonly client: AdClient;
  /** The configuration used to create the client */
  readonly config: Readonly<AdConfig>;
}

/**
 * React Context for the Ad SDK
 */
const AdContext = createContext<AdContextValue | null>(null);

/**
 * Display name for React DevTools
 */
AdContext.displayName = 'AdContext';

/**
 * Props for the AdProvider component
 */
export interface AdProviderProps {
  /** Configuration for the Ad Client */
  readonly config: AdConfig;
  /** Child components that will have access to the Ad Client */
  readonly children: ReactNode;
}

/**
 * Provider component that creates and shares an AdClient instance
 * @example
 * ```tsx
 * <AdProvider config={{ apiUrl: 'https://ads.example.com', apiKey: 'your-key' }}>
 *   <App />
 * </AdProvider>
 * ```
 */
export function AdProvider({ config, children }: AdProviderProps): JSX.Element {
  // Memoize the client to prevent recreation on every render
  // Only recreate if config values actually change
  const contextValue = useMemo<AdContextValue>(() => {
    const client = new AdClient(config);
    return {
      client,
      config: client.getConfig(),
    };
  }, [config.apiUrl, config.apiKey, config.timeout]);

  return (
    <AdContext.Provider value={contextValue}>
      {children}
    </AdContext.Provider>
  );
}

/**
 * Hook to access the AdClient from context
 * @throws Error if used outside of an AdProvider
 * @returns The AdClient instance
 */
export function useAdClient(): AdClient {
  const context = useContext(AdContext);

  if (context === null) {
    throw new Error(
      'useAdClient must be used within an AdProvider. ' +
      'Make sure to wrap your component tree with <AdProvider config={...}>.'
    );
  }

  return context.client;
}

/**
 * Hook to access the Ad SDK context
 * @throws Error if used outside of an AdProvider
 * @returns The full context value including client and config
 */
export function useAdContext(): AdContextValue {
  const context = useContext(AdContext);

  if (context === null) {
    throw new Error(
      'useAdContext must be used within an AdProvider. ' +
      'Make sure to wrap your component tree with <AdProvider config={...}>.'
    );
  }

  return context;
}

export { AdContext };
