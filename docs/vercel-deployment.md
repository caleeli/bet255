# Vercel deployment

La app se despliega completa en Vercel desde la raíz del repositorio.

## Qué cambió

Antes `vercel.json` entraba a `frontend/`, compilaba esa carpeta y por eso se publicaba la pantalla genérica `Frontend ready for Vercel deployments`. Ahora Vercel compila la app real de la raíz (`src/main.js`) y publica `dist/`.

El backend PHP fue reemplazado por una Vercel Function en `api/index.js`, por lo que no se necesita servidor PHP, Apache/Nginx ni SQLite en disco para producción.

## Configuración del proyecto en Vercel

En **Vercel → Project → Settings → General**:

- **Framework Preset:** Vite.
- **Root Directory:** raíz del repositorio, no `frontend/`.
- **Build Command:** `npm run build`.
- **Output Directory:** `dist`.
- **Install Command:** `npm install` o vacío para usar el default de Vercel.

`vercel.json` ya define esos comandos y los rewrites necesarios:

- `/api` y `/api/*` → `api/index.js`.
- cualquier otra ruta → `index.html`.

## Variables de entorno recomendadas

### Persistencia con Vercel KV

Configura Vercel KV y agrega:

```text
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

Sin esas variables, la API funciona con memoria del proceso. Eso es útil para validar el deploy, pero no es persistente.

### Búsqueda de partidos

Para la pestaña **Buscar FIFA/API** configura:

```text
FOOTBALL_DATA_TOKEN=...
```

Si no la configuras, el formulario permite enviar temporalmente el token desde el navegador en el header `X-Football-Data-Token`.

## Verificación rápida

Después de desplegar, revisa:

```bash
curl https://TU-DOMINIO.vercel.app/api?route=health
```

La respuesta debe incluir `status: "ok"` y `storage: "vercel-kv"` cuando KV esté configurado, o `storage: "memory"` en fallback.

Luego abre `https://TU-DOMINIO.vercel.app/` y deberías ver la UI de **Polla Mundial 2026 Oficina**, no la pantalla genérica de frontend.
