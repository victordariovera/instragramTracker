# Método de Scraping de Instagram - Implementación Válida

## Versión: 2025-12-26

Este documento describe el método de scraping de Instagram que funciona correctamente y **NO DEBE SER MODIFICADO** sin revisión exhaustiva.

## Método Principal de Extracción

El método de scraping utiliza múltiples estrategias en cascada para extraer datos de Instagram:

### 1. Extracción desde `og:description` (Método Principal)

```javascript
// Usar cheerio para extraer og:description
const metaTags = $('meta[property="og:description"]');
const metaContent = metaTags.first().attr('content');

// Extraer números usando regex
const fMatch = metaContent.match(/([\d,]+)\s+Followers?/i);
const folMatch = metaContent.match(/([\d,]+)\s+Following/i);
const pMatch = metaContent.match(/([\d,]+)\s+Posts?/i);
```

### 2. Búsqueda Exhaustiva en Script Tags (Fallback)

Si el método principal falla, se busca en TODOS los script tags:

```javascript
const allScripts = html.match(/<script[^>]*>(.*?)<\/script>/gs);
for (let i = 0; i < allScripts.length; i++) {
  // Buscar patrones JSON: "edge_followed_by": {"count": \d+
  const followerMatch = scriptContent.match(/"edge_followed_by":\s*\{[^}]*"count":\s*(\d+)/);
  const followingMatch = scriptContent.match(/"edge_follow":\s*\{[^}]*"count":\s*(\d+)/);
  
  // También intentar parsear como JSON
  if (scriptContent.trim().startsWith('{')) {
    const data = JSON.parse(scriptContent);
    const user = data?.entry_data?.ProfilePage?.[0]?.graphql?.user;
    // Extraer datos del usuario
  }
}
```

### 3. Búsqueda Directa en HTML (Último Recurso)

```javascript
const followerMatch = html.match(/"edge_followed_by":\s*\{[^}]*"count":\s*(\d+)/);
const followingMatch = html.match(/"edge_follow":\s*\{[^}]*"count":\s*(\d+)/);
```

## Extracción de Imagen de Perfil

```javascript
// PRIORIDAD: Extraer desde og:image (siempre disponible)
const ogImage = $('meta[property="og:image"]').attr('content');
if (ogImage && ogImage.includes('instagram.com') && !ogImage.includes('rsrc.php')) {
  profilePhoto = ogImage;
}
```

## Headers Utilizados

```javascript
headers: {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}
```

**NOTA**: Headers mínimos son más efectivos para evitar detección.

## Configuración de Rate Limiting

- Delay entre requests: 2000ms (2 segundos)
- Delay entre cuentas: 3000ms (3 segundos)
- Timeout: 20000ms (20 segundos)

## Archivos Clave

- `backend/src/services/instagramService.js`: Implementación principal del scraping
- `backend/src/services/schedulerService.js`: Orquestación del scraping programado

## Estado de Funcionamiento

✅ **FUNCIONANDO CORRECTAMENTE** - Diciembre 2025

- Extrae correctamente: seguidores, siguiendo, posts
- Extrae correctamente: imagen de perfil, nombre de display, descripción
- Funciona para cuentas públicas y privadas
- Maneja correctamente errores y rate limiting

## ⚠️ ADVERTENCIA

**NO MODIFICAR ESTE MÉTODO SIN PRUEBAS EXHAUSTIVAS**

Este método ha sido probado y funciona correctamente. Cualquier modificación debe:
1. Ser probada con múltiples cuentas
2. Mantener compatibilidad con el método actual
3. Ser documentada en este archivo
4. Ser aprobada antes de implementar

