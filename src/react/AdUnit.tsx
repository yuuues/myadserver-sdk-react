import React, {
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { useAd } from './useAd';
import { useAdClient } from './AdContext';
import type { UseAdOptions } from './useAd';

/**
 * Props for the AdUnit component
 */
export interface AdUnitProps {
  /** The zone slug to fetch an ad for */
  readonly zone: string;
  /** Optional CSS class name */
  readonly className?: string;
  /** Optional inline styles */
  readonly style?: CSSProperties;
  /** Fallback content to show when no ad is available */
  readonly fallback?: ReactNode;
  /** Loading skeleton to show while fetching */
  readonly skeleton?: ReactNode;
  /** Whether to lazy load the image */
  readonly lazy?: boolean;
  /** Viewport threshold for counting impression (0-1, default: 0.5) */
  readonly impressionThreshold?: number;
  /** Callback when ad is clicked */
  readonly onClick?: () => void;
  /** Additional options for the useAd hook */
  readonly options?: UseAdOptions;
  /** Custom render function for the ad */
  readonly children?: (props: AdRenderProps) => ReactNode;
}

/**
 * Props passed to the custom render function
 */
export interface AdRenderProps {
  /** The image URL */
  readonly imageUrl: string;
  /** The destination URL */
  readonly destinationUrl: string;
  /** Alt text for the image */
  readonly altText: string;
  /** Width of the ad */
  readonly width?: number;
  /** Height of the ad */
  readonly height?: number;
  /** Whether the ad has been viewed */
  readonly isViewed: boolean;
  /** Ad type (always 'image' in render props, since script ads return early) */
  readonly type: 'image' | 'script';
}

/**
 * Default skeleton component with pulse animation
 */
function DefaultSkeleton({ className, style }: { className?: string; style?: CSSProperties }): JSX.Element {
  return (
    <div
      className={className}
      style={{
        ...style,
        backgroundColor: '#e5e7eb',
        animation: 'ad-sdk-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        minHeight: '100px',
        width: '100%',
      }}
      role="progressbar"
      aria-label="Loading advertisement"
    >
      <style>
        {`
          @keyframes ad-sdk-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </div>
  );
}

/**
 * Parses HTML string and injects scripts into a container element.
 * Using innerHTML alone won't execute <script> tags, so we parse them
 * and create proper script elements. Handles nested scripts recursively.
 */
function injectScripts(container: HTMLElement, html: string): void {
  const temp = document.createElement('div');
  temp.innerHTML = html;

  function processNode(source: Node, target: HTMLElement): void {
    const children = Array.from(source.childNodes);
    for (const child of children) {
      if (child instanceof HTMLScriptElement) {
        const script = document.createElement('script');
        for (const attr of Array.from(child.attributes)) {
          script.setAttribute(attr.name, attr.value);
        }
        if (child.textContent) {
          script.textContent = child.textContent;
        }
        target.appendChild(script);
      } else if (child instanceof HTMLElement) {
        const clone = child.cloneNode(false) as HTMLElement;
        target.appendChild(clone);
        processNode(child, clone);
      } else {
        target.appendChild(child.cloneNode(true));
      }
    }
  }

  processNode(temp, container);
}

/**
 * AdUnit component - Displays an ad with automatic impression tracking
 *
 * @example
 * ```tsx
 * // Basic usage
 * <AdUnit zone="homepage-banner" />
 *
 * // With fallback and custom class
 * <AdUnit
 *   zone="sidebar-ad"
 *   className="my-ad-class"
 *   fallback={<div>No ad available</div>}
 * />
 *
 * // Custom render function
 * <AdUnit zone="custom-ad">
 *   {({ imageUrl, destinationUrl, altText }) => (
 *     <a href={destinationUrl}>
 *       <img src={imageUrl} alt={altText} />
 *     </a>
 *   )}
 * </AdUnit>
 * ```
 */
export function AdUnit({
  zone,
  className,
  style,
  fallback = null,
  skeleton,
  lazy = true,
  impressionThreshold = 0.5,
  onClick,
  options,
  children,
}: AdUnitProps): JSX.Element | null {
  const client = useAdClient();
  const { data, loading, error, hasAd } = useAd(zone, options);

  // Ref for the container element (for IntersectionObserver)
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptContainerRef = useRef<HTMLDivElement>(null);

  // Track whether impression has been counted
  const impressionTrackedRef = useRef(false);

  // Track the ad ID that was tracked to handle data changes
  const trackedAdIdRef = useRef<number | null>(null);

  // Reset impression tracking when ad data changes
  useEffect(() => {
    if (data?.id !== trackedAdIdRef.current) {
      impressionTrackedRef.current = false;
      trackedAdIdRef.current = null;
    }
  }, [data?.id]);

  // Set up IntersectionObserver for impression tracking
  useEffect(() => {
    if (!data || !containerRef.current) {
      return;
    }

    const element = containerRef.current;

    // Check if IntersectionObserver is available
    if (typeof IntersectionObserver === 'undefined') {
      // Fallback: track impression immediately if observer not available
      if (!impressionTrackedRef.current && data.type !== 'script') {
        impressionTrackedRef.current = true;
        trackedAdIdRef.current = data.id;
        void client.trackImpression(data.id);
      }
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        // Check if ad is visible enough and hasn't been tracked yet
        if (
          entry.isIntersecting &&
          entry.intersectionRatio >= impressionThreshold &&
          !impressionTrackedRef.current &&
          data.type !== 'script'
        ) {
          impressionTrackedRef.current = true;
          trackedAdIdRef.current = data.id;

          void client.trackImpression(data.id, {
            viewportPercentage: Math.round(entry.intersectionRatio * 100),
          });
        }
      },
      {
        threshold: [impressionThreshold],
        rootMargin: '0px',
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [data, client, impressionThreshold]);

  // Inject scripts for script-type ads
  useEffect(() => {
    if (data?.type !== 'script' || !data.scriptContent || !scriptContainerRef.current) {
      return;
    }

    const container = scriptContainerRef.current;
    injectScripts(container, data.scriptContent);

    return () => {
      container.innerHTML = '';
    };
  }, [data?.id, data?.type, data?.scriptContent]);

  /**
   * Handle ad click
   */
  const handleClick = useCallback(() => {
    if (data && data.type !== 'script') {
      void client.trackClick(data.id);
    }
    onClick?.();
  }, [data, client, onClick]);

  // Show skeleton while loading
  if (loading) {
    return skeleton ? (
      <>{skeleton}</>
    ) : (
      <DefaultSkeleton className={className} style={style} />
    );
  }

  // Show fallback if error or no ad
  if (error || !hasAd || !data) {
    return fallback ? <>{fallback}</> : null;
  }

  // Render script-type ads
  if (data.type === 'script') {
    return (
      <div
        ref={(el) => {
          (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          (scriptContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }}
        className={className}
        style={{
          ...style,
          width: data.width ? `${data.width}px` : undefined,
          height: data.height ? `${data.height}px` : undefined,
        }}
        data-ad-id={data.id}
        data-ad-zone={zone}
        data-ad-type="script"
      />
    );
  }

  // Prepare render props
  const renderProps: AdRenderProps = {
    imageUrl: data.imageUrl ?? '',
    destinationUrl: data.destinationUrl ?? '',
    altText: data.altText ?? 'Advertisement',
    width: data.width,
    height: data.height,
    isViewed: impressionTrackedRef.current,
    type: data.type ?? 'image',
  };

  // Use custom render function if provided
  if (children) {
    return (
      <div ref={containerRef} className={className} style={style}>
        {children(renderProps)}
      </div>
    );
  }

  // Default render
  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
      data-ad-id={data.id}
      data-ad-zone={zone}
      data-ad-type="image"
    >
      <a
        href={data.destinationUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={handleClick}
        style={{ display: 'block', lineHeight: 0 }}
      >
        <img
          src={data.imageUrl}
          alt={data.altText ?? 'Advertisement'}
          loading={lazy ? 'lazy' : 'eager'}
          width={data.width}
          height={data.height}
          style={{
            maxWidth: '100%',
            height: 'auto',
            display: 'block',
          }}
        />
      </a>
    </div>
  );
}

/**
 * Display name for React DevTools
 */
AdUnit.displayName = 'AdUnit';
