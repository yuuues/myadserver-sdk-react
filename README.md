# @yuuues/ad-sdk-react

SDK para consumir el Ad Server con soporte para React.

## Instalación

```bash
# Desde GitHub
npm install github:yuuues/myadserver-sdk-react

# Desde npm (si está publicado)
npm install @yuuues/ad-sdk-react
```

## Uso con React

### 1. Configurar el Provider

Envuelve tu aplicación con `AdProvider`:

```tsx
import { AdProvider } from '@yuuues/ad-sdk-react';

function App() {
  return (
    <AdProvider
      config={{
        apiUrl: 'https://tu-adserver.com',
        apiKey: 'tu-api-key',
        timeout: 5000 // opcional, default 5000ms
      }}
    >
      <MiAplicacion />
    </AdProvider>
  );
}
```

### 2. Mostrar anuncios con AdUnit

```tsx
import { AdUnit } from '@yuuues/ad-sdk-react';

function MiPagina() {
  return (
    <div>
      <h1>Mi Página</h1>

      {/* Uso básico */}
      <AdUnit zone="header-banner" />

      {/* Con estilos y fallback */}
      <AdUnit
        zone="sidebar-ad"
        className="mi-clase-css"
        fallback={<div>Sin publicidad disponible</div>}
      />

      {/* Con skeleton personalizado */}
      <AdUnit
        zone="footer-banner"
        skeleton={<div className="mi-skeleton">Cargando...</div>}
      />
    </div>
  );
}
```

### 3. Uso avanzado con el hook useAd

```tsx
import { useAd } from '@yuuues/ad-sdk-react';

function MiComponentePersonalizado() {
  const { data, loading, error, refetch } = useAd('mi-zona', {
    enabled: true, // opcional, default true
    onSuccess: (ad) => console.log('Ad cargado:', ad),
    onError: (err) => console.error('Error:', err),
    onEmpty: () => console.log('No hay anuncio disponible'),
  });

  if (loading) return <p>Cargando...</p>;
  if (error) return <p>Error: {error.message}</p>;
  if (!data) return null;

  return (
    <div>
      <a href={data.destinationUrl} target="_blank" rel="noopener">
        <img src={data.imageUrl} alt={data.altText} />
      </a>
      <button onClick={refetch}>Recargar anuncio</button>
    </div>
  );
}
```

### 4. Acceso directo al cliente

```tsx
import { useAdClient } from '@yuuues/ad-sdk-react';

function MiComponente() {
  const client = useAdClient();

  const cargarAnuncio = async () => {
    const ad = await client.fetchAd('mi-zona');
    if (ad) {
      console.log(ad);
      client.trackImpression(ad.id);
    }
  };

  return <button onClick={cargarAnuncio}>Cargar</button>;
}
```

## Uso sin React (Core)

Para usar el SDK sin React (vanilla JS/TS):

```typescript
import { AdClient } from '@yuuues/ad-sdk/core';

const client = new AdClient({
  apiUrl: 'https://tu-adserver.com',
  apiKey: 'tu-api-key',
});

// Obtener un anuncio
const ad = await client.fetchAd('homepage-banner');

if (ad) {
  console.log('Imagen:', ad.imageUrl);
  console.log('Destino:', ad.destinationUrl);

  // Registrar impresión
  client.trackImpression(ad.id);

  // Registrar click
  client.trackClick(ad.id);
}
```

## API Reference

### AdProvider Props

| Prop | Tipo | Requerido | Descripción |
|------|------|-----------|-------------|
| `config.apiUrl` | `string` | Sí | URL base del Ad Server |
| `config.apiKey` | `string` | Sí | API Key para autenticación |
| `config.timeout` | `number` | No | Timeout en ms (default: 5000) |

### AdUnit Props

| Prop | Tipo | Requerido | Descripción |
|------|------|-----------|-------------|
| `zone` | `string` | Sí | Slug de la zona publicitaria |
| `className` | `string` | No | Clase CSS para el contenedor |
| `style` | `CSSProperties` | No | Estilos inline |
| `fallback` | `ReactNode` | No | Contenido si no hay anuncio |
| `skeleton` | `ReactNode` | No | Contenido mientras carga |
| `lazy` | `boolean` | No | Lazy loading de imagen (default: true) |
| `impressionThreshold` | `number` | No | % visible para contar impresión (default: 0.5) |
| `onClick` | `() => void` | No | Callback al hacer click |

### useAd Hook

```typescript
const {
  data,      // AdResponse | null
  loading,   // boolean
  error,     // AdError | null
  hasAd,     // boolean
  refetch,   // () => Promise<void>
  reset,     // () => void
} = useAd(zone: string, options?: UseAdOptions);
```

### AdResponse

```typescript
interface AdResponse {
  id: number;
  imageUrl: string;
  destinationUrl: string;
  trackingUrl?: string;
  altText?: string;
  width?: number;
  height?: number;
}
```

### AdError

```typescript
import { AdError, AdErrorCode } from '@yuuues/ad-sdk-react';

// Códigos de error disponibles:
AdErrorCode.NETWORK_ERROR    // Error de red
AdErrorCode.SERVER_ERROR     // Error del servidor
AdErrorCode.UNAUTHORIZED     // API key inválida
AdErrorCode.TIMEOUT          // Timeout
AdErrorCode.INVALID_CONFIG   // Configuración inválida
AdErrorCode.NO_AD_AVAILABLE  // No hay anuncio disponible
AdErrorCode.INVALID_RESPONSE // Respuesta inválida
AdErrorCode.UNKNOWN          // Error desconocido
```

## Tracking

El SDK maneja automáticamente:

- **Impresiones**: Se registran cuando el anuncio es visible al 50% en el viewport (configurable con `impressionThreshold`)
- **Clicks**: Se registran automáticamente al hacer click en el anuncio

El tracking usa `navigator.sendBeacon` para garantizar que se envíe incluso si el usuario navega fuera de la página.

## Endpoints del Ad Server

El SDK consume los siguientes endpoints:

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/decision?zone={slug}` | Obtener anuncio para una zona |
| POST | `/api/v1/track/impression` | Registrar impresión |
| POST | `/api/v1/track/click` | Registrar click |

### Headers requeridos

```
X-APP-KEY: {apiKey}
Content-Type: application/json
```

## Licencia

MIT
