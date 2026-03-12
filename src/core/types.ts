/**
 * Configuration for the Ad Client
 */
export interface AdConfig {
  /** Base URL of the Ad Server API */
  readonly apiUrl: string;
  /** API Key for authentication */
  readonly apiKey: string;
  /** Optional timeout in milliseconds (default: 5000) */
  readonly timeout?: number;
}

/**
 * Response from the Ad Server decision endpoint
 */
export interface AdResponse {
  /** Unique identifier for the ad */
  readonly id: number;
  /** Type of ad: image (traditional banner) or script (third-party ad network code) */
  readonly type: 'image' | 'script';
  /** URL of the ad image to display (image ads only) */
  readonly imageUrl?: string;
  /** URL to redirect when ad is clicked (image ads only) */
  readonly destinationUrl?: string;
  /** Optional URL for tracking impressions */
  readonly trackingUrl?: string;
  /** Optional alt text for the image */
  readonly altText?: string;
  /** Raw HTML/script content to inject (script ads only) */
  readonly scriptContent?: string;
  /** Optional width of the ad unit */
  readonly width?: number;
  /** Optional height of the ad unit */
  readonly height?: number;
}

/**
 * Raw API response structure from the Ad Server.
 * Supports both flat format (current backend) and wrapped format (future).
 */
export interface AdApiResponse {
  // --- Wrapped format fields ---
  readonly success?: boolean;
  readonly data?: {
    readonly id: number;
    readonly type?: string;
    readonly image_url?: string;
    readonly destination_url?: string;
    readonly tracking_url?: string;
    readonly alt_text?: string;
    readonly script_content?: string;
    readonly width?: number;
    readonly height?: number;
  };
  // --- Flat format fields (current backend) ---
  readonly id?: number;
  readonly type?: string;
  readonly imageUrl?: string;
  readonly destinationUrl?: string;
  readonly clickUrl?: string;
  readonly scriptContent?: string;
  readonly width?: number;
  readonly height?: number;
  // --- Error ---
  readonly error?: string;
}

/**
 * Custom error class for Ad SDK errors
 */
export class AdError extends Error {
  /** HTTP status code if applicable */
  public readonly statusCode?: number;
  /** Error code for programmatic handling */
  public readonly code: AdErrorCode;
  /** Original error that caused this error */
  public readonly cause?: Error;

  constructor(
    message: string,
    code: AdErrorCode,
    options?: {
      statusCode?: number;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'AdError';
    this.code = code;
    this.statusCode = options?.statusCode;
    this.cause = options?.cause;

    // Maintains proper stack trace for where error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AdError);
    }
  }

  /**
   * Check if error is a network-related error
   */
  public isNetworkError(): boolean {
    return this.code === AdErrorCode.NETWORK_ERROR;
  }

  /**
   * Check if error is an authentication error
   */
  public isAuthError(): boolean {
    return this.code === AdErrorCode.UNAUTHORIZED;
  }
}

/**
 * Error codes for different types of failures
 */
export enum AdErrorCode {
  /** Network request failed */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** Server returned an error response */
  SERVER_ERROR = 'SERVER_ERROR',
  /** Invalid API key or unauthorized */
  UNAUTHORIZED = 'UNAUTHORIZED',
  /** Request timed out */
  TIMEOUT = 'TIMEOUT',
  /** Invalid configuration provided */
  INVALID_CONFIG = 'INVALID_CONFIG',
  /** No ad available for the zone */
  NO_AD_AVAILABLE = 'NO_AD_AVAILABLE',
  /** Invalid response from server */
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  /** Unknown error */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Options for fetching an ad
 */
export interface FetchAdOptions {
  /** Additional context data to send with the request */
  readonly context?: Record<string, string | number | boolean>;
  /** Override the default timeout for this request */
  readonly timeout?: number;
  /** Signal for aborting the request */
  readonly signal?: AbortSignal;
}

/**
 * Options for tracking an impression
 */
export interface TrackImpressionOptions {
  /** Viewport percentage when impression was counted */
  readonly viewportPercentage?: number;
  /** Time in milliseconds the ad was visible */
  readonly visibleDuration?: number;
}
