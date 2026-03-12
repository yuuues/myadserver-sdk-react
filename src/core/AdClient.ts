import {
  AdConfig,
  AdResponse,
  AdApiResponse,
  AdError,
  AdErrorCode,
  FetchAdOptions,
  TrackImpressionOptions,
} from './types';

/**
 * Core Ad Client - Framework agnostic
 * Handles all HTTP communication with the Ad Server
 */
export class AdClient {
  private readonly config: Required<Pick<AdConfig, 'apiUrl' | 'apiKey'>> &
    Pick<AdConfig, 'timeout'>;
  private readonly defaultTimeout: number;

  constructor(config: AdConfig) {
    this.validateConfig(config);

    this.config = {
      apiUrl: this.normalizeUrl(config.apiUrl),
      apiKey: config.apiKey,
      timeout: config.timeout,
    };
    this.defaultTimeout = config.timeout ?? 5000;
  }

  /**
   * Validates the provided configuration
   */
  private validateConfig(config: AdConfig): void {
    if (!config.apiUrl || typeof config.apiUrl !== 'string') {
      throw new AdError(
        'Invalid configuration: apiUrl is required and must be a string',
        AdErrorCode.INVALID_CONFIG
      );
    }

    if (!config.apiKey || typeof config.apiKey !== 'string') {
      throw new AdError(
        'Invalid configuration: apiKey is required and must be a string',
        AdErrorCode.INVALID_CONFIG
      );
    }

    if (config.timeout !== undefined && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
      throw new AdError(
        'Invalid configuration: timeout must be a positive number',
        AdErrorCode.INVALID_CONFIG
      );
    }
  }

  /**
   * Normalizes the API URL by removing trailing slashes
   */
  private normalizeUrl(url: string): string {
    return url.replace(/\/+$/, '');
  }

  /**
   * Creates the headers for API requests
   */
  private createHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-APP-KEY': this.config.apiKey,
    };
  }

  /**
   * Transforms the API response to the internal AdResponse format
   */
  private transformResponse(apiResponse: AdApiResponse): AdResponse | null {
    // Handle wrapped format: { success, data: {...} }
    if (apiResponse.success !== undefined) {
      if (!apiResponse.success || !apiResponse.data) {
        return null;
      }
      const { data } = apiResponse;
      return {
        id: data.id,
        type: (data.type as 'image' | 'script') ?? 'image',
        imageUrl: data.image_url,
        destinationUrl: data.destination_url,
        trackingUrl: data.tracking_url,
        altText: data.alt_text,
        scriptContent: data.script_content,
        width: data.width,
        height: data.height,
      };
    }

    // Handle flat format: { id, type, imageUrl, ... }
    if (apiResponse.id !== undefined) {
      return {
        id: apiResponse.id,
        type: (apiResponse.type as 'image' | 'script') ?? 'image',
        imageUrl: apiResponse.imageUrl,
        destinationUrl: apiResponse.destinationUrl ?? apiResponse.clickUrl,
        scriptContent: apiResponse.scriptContent,
        width: apiResponse.width,
        height: apiResponse.height,
      };
    }

    return null;
  }

  /**
   * Fetches an ad for the specified zone
   * @param zoneSlug - The zone identifier to fetch an ad for
   * @param options - Optional configuration for the request
   * @returns The ad response or null if no ad is available
   */
  public async fetchAd(
    zoneSlug: string,
    options?: FetchAdOptions
  ): Promise<AdResponse | null> {
    if (!zoneSlug || typeof zoneSlug !== 'string') {
      throw new AdError(
        'Zone slug is required and must be a non-empty string',
        AdErrorCode.INVALID_CONFIG
      );
    }

    const timeout = options?.timeout ?? this.defaultTimeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Combine external signal with timeout signal
    if (options?.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    try {
      // Build URL - supports both absolute and relative URLs
      const baseUrl = this.config.apiUrl.startsWith('http')
        ? this.config.apiUrl
        : `${typeof window !== 'undefined' ? window.location.origin : ''}${this.config.apiUrl}`;

      const url = new URL(`${baseUrl}/decision`);
      url.searchParams.set('zone_slug', zoneSlug);

      // Add context parameters if provided
      if (options?.context) {
        Object.entries(options.context).forEach(([key, value]) => {
          url.searchParams.set(`ctx_${key}`, String(value));
        });
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: this.createHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new AdError(
            'Unauthorized: Invalid API key',
            AdErrorCode.UNAUTHORIZED,
            { statusCode: response.status }
          );
        }

        if (response.status === 404) {
          // No ad available for this zone
          return null;
        }

        throw new AdError(
          `Server error: ${response.status} ${response.statusText}`,
          AdErrorCode.SERVER_ERROR,
          { statusCode: response.status }
        );
      }

      const data: unknown = await response.json();

      if (!this.isValidApiResponse(data)) {
        throw new AdError(
          'Invalid response format from server',
          AdErrorCode.INVALID_RESPONSE
        );
      }

      return this.transformResponse(data);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof AdError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new AdError(
            'Request timed out',
            AdErrorCode.TIMEOUT,
            { cause: error }
          );
        }

        throw new AdError(
          `Network error: ${error.message}`,
          AdErrorCode.NETWORK_ERROR,
          { cause: error }
        );
      }

      throw new AdError(
        'An unknown error occurred',
        AdErrorCode.UNKNOWN
      );
    }
  }

  /**
   * Type guard to validate API response structure
   */
  private isValidApiResponse(data: unknown): data is AdApiResponse {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const response = data as Record<string, unknown>;

    // Wrapped format: { success, data: { id, ... } }
    if (typeof response['success'] === 'boolean') {
      if (response['data'] !== undefined) {
        const adData = response['data'] as Record<string, unknown>;
        return typeof adData['id'] === 'number';
      }
      return true;
    }

    // Flat format: { id, type, ... }
    if (typeof response['id'] === 'number') {
      return true;
    }

    return false;
  }

  /**
   * Tracks an ad impression
   * @param adId - The ID of the ad to track
   * @param options - Optional tracking configuration
   */
  public async trackImpression(
    adId: number,
    options?: TrackImpressionOptions
  ): Promise<void> {
    if (typeof adId !== 'number' || adId <= 0) {
      console.warn('[AdSDK] Invalid ad ID for tracking:', adId);
      return;
    }

    // Log for development/debugging
    console.debug(`[AdSDK] Tracking impression for ad ID: ${adId}`, options);

    try {
      const url = `${this.config.apiUrl}/track/impression`;

      const body: Record<string, unknown> = {
        ad_id: adId,
        timestamp: Date.now(),
      };

      if (options?.viewportPercentage !== undefined) {
        body['viewport_percentage'] = options.viewportPercentage;
      }

      if (options?.visibleDuration !== undefined) {
        body['visible_duration'] = options.visibleDuration;
      }

      // Use sendBeacon for reliable tracking (doesn't block navigation)
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(body)], {
          type: 'application/json',
        });

        const beaconSent = navigator.sendBeacon(url, blob);

        if (!beaconSent) {
          // Fallback to fetch if sendBeacon fails
          await this.sendTrackingFetch(url, body);
        }
      } else {
        // Fallback for environments without sendBeacon
        await this.sendTrackingFetch(url, body);
      }
    } catch (error) {
      // Tracking errors should not break the user experience
      console.warn('[AdSDK] Failed to track impression:', error);
    }
  }

  /**
   * Fallback tracking via fetch
   */
  private async sendTrackingFetch(
    url: string,
    body: Record<string, unknown>
  ): Promise<void> {
    await fetch(url, {
      method: 'POST',
      headers: this.createHeaders(),
      body: JSON.stringify(body),
      keepalive: true, // Allows the request to complete even if page is unloading
    });
  }

  /**
   * Tracks an ad click
   * @param adId - The ID of the ad that was clicked
   */
  public async trackClick(adId: number): Promise<void> {
    if (typeof adId !== 'number' || adId <= 0) {
      console.warn('[AdSDK] Invalid ad ID for click tracking:', adId);
      return;
    }

    console.debug(`[AdSDK] Tracking click for ad ID: ${adId}`);

    try {
      const url = `${this.config.apiUrl}/track/click`;

      const body = {
        ad_id: adId,
        timestamp: Date.now(),
      };

      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(body)], {
          type: 'application/json',
        });
        navigator.sendBeacon(url, blob);
      } else {
        await this.sendTrackingFetch(url, body);
      }
    } catch (error) {
      console.warn('[AdSDK] Failed to track click:', error);
    }
  }

  /**
   * Gets the current configuration (read-only)
   */
  public getConfig(): Readonly<AdConfig> {
    return { ...this.config };
  }
}
