# Bet255 · Polla Mundial 2026 Oficina

Webapp para organizar apuestas de marcadores del Mundial FIFA 2026 en una oficina. La app quedó unificada para desplegarse desde la plataforma de Vercel: Vite/Vue sirve el frontend desde `dist/` y el backend corre como Vercel Function en `api/index.js`.

## Características

- Registro de apuestas por partido con nombre, correo y marcador.
- Bloqueo automático configurable antes del inicio de cada partido.
- Puntuación configurable: marcador exacto y resultado acertado (local, empate o visitante).
- Carga manual o importación masiva JSON de partidos por fase, incluyendo playoffs.
- Búsqueda de partidos programados en football-data.org para copiar encuentros al calendario interno.
- Registro de resultados finales y recálculo automático de la tabla de posiciones.
- API serverless compatible con Vercel, sin PHP ni servidor externo.

## Requisitos

- Node.js 20+.
- Un proyecto de Vercel apuntando a la raíz del repositorio.
- Opcional: Vercel KV con `KV_REST_API_URL` y `KV_REST_API_TOKEN` para persistir datos entre invocaciones serverless.
- Opcional: token gratuito/freemium de [football-data.org](https://www.football-data.org/documentation/api) para la búsqueda de partidos programados.

## Desarrollo local

```bash
npm install
npm run dev
```

Vite sirve el frontend. Para probar la API de Vercel localmente usa Vercel CLI:

```bash
npx vercel dev
```

El frontend llama al backend en `/api` por defecto. Si necesitas apuntar a otra URL, define `VITE_API_BASE`.

## Backend en Vercel

El backend vive en `api/index.js` y acepta las mismas rutas con el parámetro `route` que usa el frontend, por ejemplo:

- `/api?route=health`
- `/api?route=settings`
- `/api?route=matches`
- `/api?route=bets`
- `/api?route=leaderboard`

### Persistencia

Si configuras Vercel KV, la función guarda todo el estado de la polla bajo la llave `bet255:state`. Configura estas variables en **Vercel → Project → Settings → Environment Variables**:

```text
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

Si esas variables no existen, la API usa memoria del proceso como fallback para desarrollo y previews. Ese fallback no debe usarse como almacenamiento definitivo porque Vercel puede reiniciar o escalar las funciones.

### football-data.org

Para evitar compartir tokens en el navegador, configura esta variable en Vercel:

```text
FOOTBALL_DATA_TOKEN=tu_token
```

También puedes pegar un token temporal desde la pestaña **Buscar FIFA/API**; el frontend lo enviará como header `X-Football-Data-Token`.

## Importación masiva de partidos

Formato esperado:

```json
[
  {
    "phase": "Fase de grupos",
    "home_team": "Equipo A",
    "away_team": "Equipo B",
    "starts_at": "2026-06-11T19:00"
  },
  {
    "phase": "Final",
    "home_team": "Ganador SF1",
    "away_team": "Ganador SF2",
    "starts_at": "2026-07-19T19:00"
  }
]
```

## Deploy en Vercel

La configuración está en `vercel.json`:

- instala dependencias desde la raíz;
- ejecuta `npm run build`;
- publica `dist/`;
- enruta `/api` a `api/index.js`;
- enruta el resto a `index.html` para el SPA.

No configures el proyecto de Vercel con `frontend/` como root directory; la app de producción vive en la raíz del repositorio.

## Scripts útiles

```bash
npm run build
npm test
```

## SQLite migrations legacy

El repositorio conserva `scripts/migrate.py` y `migrations/` como utilidades legacy para SQLite, pero el deploy de Vercel ya no usa PHP ni SQLite.
