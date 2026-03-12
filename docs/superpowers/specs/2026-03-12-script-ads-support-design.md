# Script Ads Support — Design Spec

## Goal

Allow the AdServer to serve third-party script-based ads (e.g., ad network tags) alongside existing image ads. The SDK and backend handle the type transparently — developers just use `<AdUnit zone="..." />`.

## Backend Changes (Symfony)

### Entity: `Ad`

New fields on the existing `Ad` entity:

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `type` | `string` (enum: `image`, `script`) | `image` | Determines rendering behavior |
| `scriptContent` | `text`, nullable | `null` | Raw HTML/script block for script ads |

- When `type = script`: `scriptContent` is required. `imageUrl`, `imagePath`, `destinationUrl` are ignored.
- When `type = image`: existing behavior, `scriptContent` is ignored.
- `weight`, `active`, `countries`, sizes, and categories work the same for both types.

### Migration

Single migration adding `type` (varchar, default `'image'`) and `script_content` (text, nullable) to the `ads` table.

### Endpoint: `GET /api/v1/decision`

Response includes `type` field. The backend returns a flat JSON object with camelCase keys (no `success`/`data` wrapper).

For script ads:

```json
{
  "id": 2,
  "type": "script",
  "scriptContent": "<script>atOptions = {...}</script><script src=\"https://...\"></script>",
  "width": 300,
  "height": 250
}
```

For image ads (backward compatible, adds `type` field):

```json
{
  "id": 1,
  "type": "image",
  "imageUrl": "https://...",
  "destinationUrl": "https://...",
  "clickUrl": "https://...",
  "width": 300,
  "height": 250
}
```

### DTO: `AdDecisionResponse`

Add `type` and `scriptContent` fields. Serialize `scriptContent` as `script_content`.

### Admin Panel: `AdCrudController`

- Add `type` choice field (`image` / `script`).
- Add `scriptContent` textarea field.
- `destinationUrl` becomes optional (not needed for script ads).

### Impressions

No changes. Impressions are already recorded when `/decision` is called, so script ads get impression tracking automatically.

### Clicks

Not tracked for script ads. The third-party script handles its own click behavior inside its iframe.

## SDK Changes (React)

### Types: `AdResponse`

```typescript
interface AdResponse {
  id: number;
  type: 'image' | 'script';
  // Image fields
  imageUrl?: string;
  destinationUrl?: string;
  trackingUrl?: string;
  altText?: string;
  // Script fields
  scriptContent?: string;
  // Common
  width?: number;
  height?: number;
}
```

`AdApiResponse` updated similarly with snake_case equivalents.

### Component: `AdUnit`

When `data.type === 'script'`:

1. Render a container `<div>` with appropriate width/height.
2. Parse `scriptContent` to extract inline scripts and external script tags.
3. Create and append `<script>` elements to the container so the browser executes them.
4. On unmount or ad change, clean up the container (remove scripts, clear innerHTML).

When `data.type === 'image'` (or no type field for backward compatibility): existing behavior unchanged.

### Security

Script content comes from the AdServer (trusted source controlled by the ad operator). It is not arbitrary user input.

## Flow

```
<AdUnit zone="sidebar" />
  → useAd("sidebar") calls client.fetchAd("sidebar")
  → GET /api/v1/decision?zone_slug=sidebar (with X-APP-KEY)
  → AdServer matches ad (image or script), records impression
  → Returns { type, ...fields }
  → AdUnit checks type:
     - "image" → renders <a><img /></a> (existing)
     - "script" → injects scripts into container div
  → Developer doesn't need to know the ad type
```

## Out of Scope

- Click tracking for script ads
- Sandboxing script ads in iframes (scripts already create their own iframes)
- Multiple script formats with structured fields (single textarea is sufficient)
