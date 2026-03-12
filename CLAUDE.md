# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run build          # Full build: tsup + tsc declarations
npm run build:js       # JS bundles only (tsup)
npm run build:types    # Type declarations only (tsc --emitDeclarationOnly)
npm run dev            # Watch mode (tsup --watch)
npm run typecheck      # Type-check without emitting (tsc --noEmit)
```

No test framework is configured. There are no lint or format scripts.

## Architecture

This is `@yuuues/myadserver-sdk-react` — a TypeScript SDK for consuming an ad server, published as an npm package with two entry points:

- **Main** (`@yuuues/myadserver-sdk-react`) — full SDK including React adapter
- **Core** (`@yuuues/myadserver-sdk-react/core`) — framework-agnostic client only

### Two-layer design

```
src/core/   → Framework-agnostic: AdClient, types, AdError
src/react/  → React adapter: AdProvider, useAd, AdUnit
```

**Core layer** (`src/core/`):
- `AdClient` — HTTP client handling ad fetching, impression/click tracking. Uses `fetch` + `sendBeacon` for tracking. Supports both wrapped (`{ success, data }`) and flat (`{ id, type, ... }`) API response formats.
- `types.ts` — All shared types/interfaces. `AdResponse` supports two ad types: `'image'` (banner) and `'script'` (third-party ad network code).

**React layer** (`src/react/`):
- `AdContext.tsx` — `AdProvider` creates a memoized `AdClient` via React context. `useAdClient`/`useAdContext` hooks consume it.
- `useAd.ts` — Data-fetching hook with loading/error states, race condition handling, mount tracking.
- `AdUnit.tsx` — Renders image ads (with `<a>/<img>`) or script ads (via DOM injection with `injectScripts`). Handles IntersectionObserver-based impression tracking.

### Build output

tsup produces ESM + CJS bundles. Type declarations are generated separately by `tsc`. Two tsup configs in `tsup.config.ts`: one for the main entry, one for the core-only bundle output to `dist/core/`.

### Ad Server API

The SDK communicates with these endpoints (base URL configured via `apiUrl`):
- `GET {apiUrl}/decision?zone_slug={slug}` — fetch ad (uses `X-APP-KEY` header)
- `POST {apiUrl}/track/impression` — track impression
- `POST {apiUrl}/track/click` — track click

### Key conventions

- All interfaces use `readonly` fields
- TypeScript strict mode with all strict checks enabled (`noUncheckedIndexedAccess`, etc.)
- React peer dependency is optional — core can be used without React
- Tracking silently catches errors (never breaks user experience)
- Script ads bypass impression/click tracking (handled by the third-party scripts)
- The codebase and README are in Spanish (comments and docs)
