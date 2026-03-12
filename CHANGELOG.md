# Changelog

All notable changes to `@yuuues/myadserver-sdk-react` will be documented in this file.

## [2.0.0] - 2026-03-12

### Added

- **Script ad support**: `AdUnit` now renders third-party script-based ads (ad network tags) automatically. The ad server decides the type; no client-side configuration needed.
- `type` field (`'image' | 'script'`) on `AdResponse` — indicates the ad format.
- `scriptContent` field on `AdResponse` — raw HTML/script block for script ads.
- `type` field on `AdRenderProps` for custom render functions.
- `data-ad-type` attribute on rendered ad containers (`"image"` or `"script"`).
- Support for flat API response format (`{ id, type, ... }`) alongside the wrapped format (`{ success, data }`).
- `width` and `height` fields now included in API responses for both ad types.

### Changed

- **BREAKING**: `AdResponse.imageUrl` changed from `string` to `string | undefined`.
- **BREAKING**: `AdResponse.destinationUrl` changed from `string` to `string | undefined`.
- `AdApiResponse` now supports both flat and wrapped response formats.
- `isValidApiResponse` no longer requires `image_url` and `destination_url` — script ads don't have them.

### Fixed

- Fixed query parameter name: SDK now sends `zone_slug` (matching the backend) instead of `zone`.

## [1.0.0] - 2026-01-05

### Added

- `AdClient` — framework-agnostic HTTP client for the Ad Server API.
- `AdProvider` / `useAdClient` / `useAdContext` — React context for configuration.
- `useAd` hook — fetch and manage ad data with loading/error states.
- `usePrefetchAd` hook — warm cache without rendering.
- `AdUnit` component — display ads with automatic impression and click tracking.
- IntersectionObserver-based impression tracking.
- `sendBeacon` with fetch fallback for reliable tracking.
- Support for uploaded images and external image URLs.
- Separate `@yuuues/myadserver-sdk-react/core` entry point for non-React usage.
- ESM and CommonJS builds with TypeScript declarations.
