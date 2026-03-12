# Script Ads Support Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the AdServer to serve third-party script-based ads alongside image ads, with the SDK rendering them transparently.

**Architecture:** Add `type` and `scriptContent` fields to the `Ad` entity. The `/decision` endpoint returns different payloads per type. The SDK's `AdUnit` component detects the type and either renders an image (existing) or injects scripts into the DOM.

**Tech Stack:** Symfony 8 / PHP 8.4 / Doctrine / PostgreSQL (backend), React / TypeScript / tsup (SDK)

**Note on API format:** The backend returns a flat JSON response (e.g., `{ "id": 1, "type": "image", "imageUrl": "..." }`) using camelCase keys. The `AdDecisionController` calls `$response->toArray()` directly — there is no `{ success, data }` wrapper. The SDK supports both flat and wrapped formats for forward compatibility but the flat format is what the current backend produces. All field names use camelCase consistently (e.g., `scriptContent`, not `script_content`).

---

## File Structure

### Backend (`D:\laragon-www\www\myadserver`)

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/Entity/Ad.php` | Add `type` and `scriptContent` fields, conditional validation |
| Create | `migrations/Version*.php` | Database migration (auto-generated) |
| Modify | `src/DTO/AdDecisionResponse.php` | Include `type`, `scriptContent`, `width`, `height` in response |
| Modify | `src/Service/AdDecisionManager.php` | Skip click URL generation for script ads |
| Modify | `src/Controller/Admin/AdCrudController.php` | Add type selector and script textarea to admin |

### SDK (`D:\laragon-www\www\myadserver-sdk-react`)

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/core/types.ts` | Add `type` and `scriptContent` to interfaces |
| Modify | `src/core/AdClient.ts` | Update response validation and transformation |
| Modify | `src/react/AdUnit.tsx` | Render script ads via DOM script injection |

**No changes needed:** `src/Controller/Api/V1/AdDecisionController.php` — it already calls `$response->toArray()` and returns the result. The DTO changes handle the type branching.

---

## Chunk 1: Backend

### Task 1: Update `Ad` entity

**Files:**
- Modify: `src/Entity/Ad.php`

- [ ] **Step 1: Add constants and `type` field**

In `src/Entity/Ad.php`, add after the `GLOBAL_COUNTRY` constant:

```php
public const TYPE_IMAGE = 'image';
public const TYPE_SCRIPT = 'script';
```

Add after the `$imagePath` property:

```php
#[ORM\Column(type: 'string', length: 20, options: ['default' => 'image'])]
#[Assert\NotBlank]
#[Assert\Choice(choices: [self::TYPE_IMAGE, self::TYPE_SCRIPT])]
private string $type = self::TYPE_IMAGE;
```

- [ ] **Step 2: Add `scriptContent` field**

Add after the new `$type` property:

```php
#[ORM\Column(type: 'text', nullable: true)]
private ?string $scriptContent = null;
```

- [ ] **Step 3: Make `destinationUrl` nullable**

Change the `$destinationUrl` property from:

```php
#[ORM\Column(type: 'string', length: 2000)]
#[Assert\NotBlank]
#[Assert\Url]
private string $destinationUrl = '';
```

To:

```php
#[ORM\Column(type: 'string', length: 2000, nullable: true)]
#[Assert\Url]
private ?string $destinationUrl = null;
```

Update the getter and setter:

```php
public function getDestinationUrl(): ?string
{
    return $this->destinationUrl;
}

public function setDestinationUrl(?string $destinationUrl): static
{
    $this->destinationUrl = $destinationUrl;
    return $this;
}
```

- [ ] **Step 4: Add conditional validation callback**

Add this import at the top of the file:

```php
use Symfony\Component\Validator\Context\ExecutionContextInterface;
```

Add this method to the `Ad` class:

```php
#[Assert\Callback]
public function validateByType(ExecutionContextInterface $context): void
{
    if ($this->type === self::TYPE_IMAGE && empty($this->destinationUrl)) {
        $context->buildViolation('Destination URL is required for image ads.')
            ->atPath('destinationUrl')
            ->addViolation();
    }

    if ($this->type === self::TYPE_SCRIPT && empty($this->scriptContent)) {
        $context->buildViolation('Script content is required for script ads.')
            ->atPath('scriptContent')
            ->addViolation();
    }
}
```

- [ ] **Step 5: Add getters and setters for new fields**

Add after the `setImagePath` method:

```php
public function getType(): string
{
    return $this->type;
}

public function setType(string $type): static
{
    $this->type = $type;
    return $this;
}

public function isScript(): bool
{
    return $this->type === self::TYPE_SCRIPT;
}

public function getScriptContent(): ?string
{
    return $this->scriptContent;
}

public function setScriptContent(?string $scriptContent): static
{
    $this->scriptContent = $scriptContent;
    return $this;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/Entity/Ad.php
git commit -m "feat: add type and scriptContent fields to Ad entity"
```

---

### Task 2: Create database migration

**Files:**
- Create: `migrations/Version*.php` (auto-generated)

- [ ] **Step 1: Generate migration**

```bash
php bin/console doctrine:migrations:diff
```

Expected: Creates a new migration file in `migrations/`.

- [ ] **Step 2: Review the generated migration**

Verify it contains statements equivalent to:
- `ALTER TABLE ads ADD type VARCHAR(20) DEFAULT 'image' NOT NULL`
- `ALTER TABLE ads ADD script_content TEXT DEFAULT NULL`
- `ALTER TABLE ads ALTER COLUMN destination_url DROP NOT NULL`

(Exact syntax varies by PostgreSQL version and Doctrine output.)

- [ ] **Step 3: Run migration**

```bash
php bin/console doctrine:migrations:migrate --no-interaction
```

Expected: Migration applied successfully.

- [ ] **Step 4: Commit**

```bash
git add migrations/
git commit -m "feat: add migration for script ads support"
```

---

### Task 3: Update `AdDecisionResponse` DTO

**Files:**
- Modify: `src/DTO/AdDecisionResponse.php`

- [ ] **Step 1: Replace the entire DTO**

```php
<?php

declare(strict_types=1);

namespace App\DTO;

use App\Entity\Ad;

final readonly class AdDecisionResponse
{
    public function __construct(
        public int $id,
        public string $type,
        public ?string $imageUrl = null,
        public ?string $destinationUrl = null,
        public ?string $clickUrl = null,
        public ?string $scriptContent = null,
        public ?int $width = null,
        public ?int $height = null,
    ) {
    }

    public static function fromAd(Ad $ad, string $clickUrl, string $baseUrl = ''): self
    {
        // Get first size dimensions if available
        $width = null;
        $height = null;
        foreach ($ad->getSizes() as $size) {
            if ($size->getWidth() !== null && $size->getHeight() !== null) {
                $width = $size->getWidth();
                $height = $size->getHeight();
                break;
            }
        }

        if ($ad->isScript()) {
            return new self(
                id: $ad->getId(),
                type: Ad::TYPE_SCRIPT,
                scriptContent: $ad->getScriptContent(),
                width: $width,
                height: $height,
            );
        }

        return new self(
            id: $ad->getId(),
            type: Ad::TYPE_IMAGE,
            imageUrl: $ad->getEffectiveImageUrl($baseUrl) ?? '',
            destinationUrl: $ad->getDestinationUrl() ?? '',
            clickUrl: $clickUrl,
            width: $width,
            height: $height,
        );
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        if ($this->type === Ad::TYPE_SCRIPT) {
            return [
                'id' => $this->id,
                'type' => $this->type,
                'scriptContent' => $this->scriptContent,
                'width' => $this->width,
                'height' => $this->height,
            ];
        }

        return [
            'id' => $this->id,
            'type' => $this->type,
            'imageUrl' => $this->imageUrl,
            'destinationUrl' => $this->destinationUrl,
            'clickUrl' => $this->clickUrl,
            'width' => $this->width,
            'height' => $this->height,
        ];
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/DTO/AdDecisionResponse.php
git commit -m "feat: update AdDecisionResponse DTO for script ads"
```

---

### Task 4: Update `AdDecisionManager`

**Files:**
- Modify: `src/Service/AdDecisionManager.php`

- [ ] **Step 1: Skip click URL for script ads**

In `AdDecisionManager::decide()`, replace the section after impression recording (lines 91-101) with:

```php
// 6. Generate click URL (only for image ads)
$clickUrl = '';
if (!$selectedAd->isScript()) {
    $clickUrl = $this->urlGenerator->generate('api_click', [
        'adId' => $selectedAd->getId(),
        'zone' => $zoneSlug,
    ], UrlGeneratorInterface::ABSOLUTE_URL);
}

// 7. Get base URL for uploaded images
$baseUrl = $this->urlGenerator->generate('home', [], UrlGeneratorInterface::ABSOLUTE_URL);
$baseUrl = rtrim($baseUrl, '/');

return AdDecisionResponse::fromAd($selectedAd, $clickUrl, $baseUrl);
```

- [ ] **Step 2: Commit**

```bash
git add src/Service/AdDecisionManager.php
git commit -m "feat: skip click URL generation for script ads"
```

---

### Task 5: Update Admin Panel

**Files:**
- Modify: `src/Controller/Admin/AdCrudController.php`

- [ ] **Step 1: Add type and scriptContent fields**

Add this import at the top:

```php
use EasyCorp\Bundle\EasyAdminBundle\Field\TextareaField;
```

In `configureFields()`, add after the `yield TextField::new('title')` block:

```php
yield ChoiceField::new('type')
    ->setChoices([
        'Image' => 'image',
        'Script' => 'script',
    ])
    ->setRequired(true)
    ->setHelp('Image: traditional banner ad. Script: third-party ad network code.');
```

Change the `destinationUrl` field from:

```php
yield UrlField::new('destinationUrl')
    ->setLabel('Destination URL')
    ->setRequired(true)
    ->setHelp('Affiliate or destination link when ad is clicked');
```

To:

```php
yield UrlField::new('destinationUrl')
    ->setLabel('Destination URL')
    ->setRequired(false)
    ->setHelp('Affiliate or destination link when ad is clicked (required for image ads)');
```

Add after the `destinationUrl` field:

```php
yield TextareaField::new('scriptContent')
    ->setLabel('Script Content')
    ->setRequired(false)
    ->setHelp('Paste the full HTML/script block from the ad network (required for script ads)')
    ->setNumOfRows(10)
    ->hideOnIndex();
```

- [ ] **Step 2: Commit**

```bash
git add src/Controller/Admin/AdCrudController.php
git commit -m "feat: add type and scriptContent fields to admin panel"
```

---

## Chunk 2: SDK

### Task 6: Update TypeScript types

**Files:**
- Modify: `src/core/types.ts`

- [ ] **Step 1: Add type and scriptContent to AdResponse**

Replace the `AdResponse` interface:

```typescript
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
```

- [ ] **Step 2: Update AdApiResponse to support flat backend format**

Replace the `AdApiResponse` interface. The backend returns a flat JSON object with camelCase keys. The wrapped `{ success, data }` format is supported for forward compatibility.

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add src/core/types.ts
git commit -m "feat: add type and scriptContent to SDK type definitions"
```

---

### Task 7: Update `AdClient` response handling

**Files:**
- Modify: `src/core/AdClient.ts`

- [ ] **Step 1: Update `isValidApiResponse` to handle both ad types and formats**

Replace the `isValidApiResponse` method:

```typescript
/**
 * Type guard to validate API response structure.
 * Supports both flat format ({ id, type, ... }) and wrapped format ({ success, data }).
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
```

- [ ] **Step 2: Update `transformResponse` to handle both formats and script ads**

Replace the `transformResponse` method:

```typescript
/**
 * Transforms the API response to the internal AdResponse format.
 * Handles both flat (current backend) and wrapped (future) response formats.
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
```

- [ ] **Step 3: Commit**

```bash
git add src/core/AdClient.ts
git commit -m "feat: update AdClient to handle script ad responses"
```

---

### Task 8: Update `AdUnit` component for script rendering

**Files:**
- Modify: `src/react/AdUnit.tsx`

- [ ] **Step 1: Add script injection helper function**

In `AdUnit.tsx`, add this helper function before the `AdUnit` component (after `DefaultSkeleton`):

```typescript
/**
 * Parses HTML string and injects scripts into a container element.
 * Using innerHTML alone won't execute <script> tags, so we parse them
 * and create proper script elements. Handles nested scripts recursively.
 */
function injectScripts(container: HTMLElement, html: string): void {
  const temp = document.createElement('div');
  temp.innerHTML = html;

  /**
   * Recursively processes a node, re-creating script elements so they execute.
   */
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
        // Recurse into children to find nested scripts
        processNode(child, clone);
      } else {
        target.appendChild(child.cloneNode(true));
      }
    }
  }

  processNode(temp, container);
}
```

- [ ] **Step 2: Add script container ref and injection effect**

In the `AdUnit` component, add a ref after the existing `containerRef`:

```typescript
const scriptContainerRef = useRef<HTMLDivElement>(null);
```

Add a new `useEffect` after the IntersectionObserver effect:

```typescript
// Inject scripts for script-type ads
useEffect(() => {
  if (data?.type !== 'script' || !data.scriptContent || !scriptContainerRef.current) {
    return;
  }

  const container = scriptContainerRef.current;
  injectScripts(container, data.scriptContent);

  return () => {
    // Clean up on unmount or ad change
    container.innerHTML = '';
  };
}, [data?.id, data?.type, data?.scriptContent]);
```

- [ ] **Step 3: Add script ad rendering path (early return)**

After the fallback check (`if (error || !hasAd || !data)`) and **before** the `renderProps` block, add:

```typescript
// Render script-type ads — returns early, before renderProps/children
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
```

Note: Script ads return before the `children` render prop path. Custom rendering via `children` is not supported for script ads — the scripts inject their own DOM content.

- [ ] **Step 4: Add `type` to AdRenderProps (no breaking changes)**

Add `type` and `scriptContent` to the `AdRenderProps` interface. Keep `imageUrl` and `destinationUrl` as required `string` — they are only constructed for image ads (script ads return early above).

```typescript
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
```

Update the `renderProps` construction:

```typescript
const renderProps: AdRenderProps = {
  imageUrl: data.imageUrl ?? '',
  destinationUrl: data.destinationUrl ?? '',
  altText: data.altText ?? 'Advertisement',
  width: data.width,
  height: data.height,
  isViewed: impressionTrackedRef.current,
  type: data.type ?? 'image',
};
```

- [ ] **Step 5: Skip client-side impression/click tracking for script ads**

Server-side impression tracking already happens when `/decision` is called. Client-side IntersectionObserver tracking is only needed for image ads.

In the IntersectionObserver callback, change the condition to:

```typescript
if (
  entry.isIntersecting &&
  entry.intersectionRatio >= impressionThreshold &&
  !impressionTrackedRef.current &&
  data.type !== 'script'  // Server already records impression at /decision time
)
```

In the IntersectionObserver fallback (when observer is unavailable):

```typescript
if (!impressionTrackedRef.current && data.type !== 'script') {
```

In the `handleClick` callback:

```typescript
const handleClick = useCallback(() => {
  if (data && data.type !== 'script') {
    void client.trackClick(data.id);
  }
  onClick?.();
}, [data, client, onClick]);
```

- [ ] **Step 6: Add `data-ad-type` to image ad render path**

In the default render's outer `<div>`, add `data-ad-type="image"` for consistency:

```typescript
<div
  ref={containerRef}
  className={className}
  style={style}
  data-ad-id={data.id}
  data-ad-zone={zone}
  data-ad-type="image"
>
```

- [ ] **Step 7: Commit**

```bash
git add src/react/AdUnit.tsx
git commit -m "feat: add script ad rendering support to AdUnit component"
```

---

### Task 9: Build and verify

**Files:**
- No new files

- [ ] **Step 1: Build the SDK**

```bash
cd D:\laragon-www\www\myadserver-sdk-react
npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 2: Run type checking**

```bash
npm run typecheck
```

Expected: No type errors.

- [ ] **Step 3: Commit build artifacts if needed**

If `dist/` is tracked in git:

```bash
git add dist/
git commit -m "build: rebuild SDK with script ad support"
```
