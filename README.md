# Polla Mundial 2026 Oficina

Webapp simple y moderna para organizar apuestas de marcadores del Mundial FIFA 2026 en una oficina. El frontend está construido con Vue y el backend con PHP + SQLite.

## Características

- Registro de apuestas por partido con nombre, correo y marcador.
- Bloqueo automático configurable antes del inicio de cada partido.
- Confirmación por correo para participantes usando `mail()` de PHP cuando se habilita en configuración.
- Puntuación configurable: marcador exacto y resultado acertado (local, empate o visitante).
- Página separada de configuración.
- Carga manual o importación masiva JSON de partidos por fase, incluyendo playoffs.
- Registro de resultados finales y recalculo automático de la tabla de posiciones.

## Requisitos

- Node.js 20+ recomendado.
- PHP 8.1+ con extensión PDO SQLite habilitada.

## Desarrollo

```bash
npm install
npm run dev
php -S 127.0.0.1:8080 -t .
```

Por defecto, la app espera el API en `/api/index.php`. Si usas Vite en otro puerto, define `VITE_API_BASE=http://127.0.0.1:8080/api/index.php`.

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
