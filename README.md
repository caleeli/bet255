# bet255

## SQLite migrations

This repository includes a small migration runner to initialize and update a SQLite database.

### Initialize the database

```bash
python scripts/migrate.py init --db data/app.db
```

The command creates the SQLite file if needed, ensures the internal `schema_migrations` table exists, and applies every pending SQL file from `migrations/` in filename order.

### Check migration status

```bash
python scripts/migrate.py status --db data/app.db
```

### Add a migration

Create a new SQL file in `migrations/` using the format `<version>_<name>.sql`, for example:

```text
002_create_accounts.sql
```

Then run:

```bash
python scripts/migrate.py up --db data/app.db
```
# Polla Mundial 2026 Oficina

Webapp simple y moderna para organizar apuestas de marcadores del Mundial FIFA 2026 en una oficina. El frontend está construido con Vue y el backend con PHP + SQLite.

## Características

- Registro de apuestas por partido con nombre, correo y marcador.
- Bloqueo automático configurable antes del inicio de cada partido.
- Confirmación por correo para participantes usando `mail()` de PHP cuando se habilita en configuración.
- Puntuación configurable: marcador exacto y resultado acertado (local, empate o visitante).
- Página separada de configuración.
- Carga manual o importación masiva JSON de partidos por fase, incluyendo playoffs.
- Búsqueda de partidos programados en football-data.org para copiar encuentros al calendario interno.
- Registro de resultados finales y recalculo automático de la tabla de posiciones.

## Requisitos

- Node.js 20+ recomendado.
- PHP 8.1+ con extensión PDO SQLite habilitada.
- Token gratuito/freemium de [football-data.org](https://www.football-data.org/documentation/api) para la búsqueda de partidos programados.

## Desarrollo

```bash
npm install
npm run dev
php -S 127.0.0.1:8080 -t .
```

Por defecto, la app espera el API en `/api/index.php`. Si usas Vite en otro puerto, define `VITE_API_BASE=http://127.0.0.1:8080/api/index.php`.

Para evitar compartir tokens en el navegador, inicia PHP con `FOOTBALL_DATA_TOKEN` configurado en el entorno. También puedes pegar un token temporal desde la pestaña **Buscar FIFA/API**.

```bash
FOOTBALL_DATA_TOKEN=tu_token php -S 127.0.0.1:8080 -t .
```

## Buscar partidos programados

La pestaña **Buscar FIFA/API** consulta `route=scheduled-matches` en el backend PHP. El backend valida las fechas (`YYYY-MM-DD`), deduplica códigos de competición, agrega `status=SCHEDULED`, consulta `https://api.football-data.org/v4/matches` y normaliza la respuesta para que puedas copiar un partido al formulario de calendario.

Ejemplos de códigos de competición: `WC`, `CL`, `PL`, `PD`, `SA`.

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

## Producción

```bash
npm run build
php -S 0.0.0.0:8080 -t .
```

Sirve los archivos de `dist/` desde tu servidor web y publica el endpoint PHP `api/index.php` con permisos de escritura sobre `data/`.
