# Bet255 Match Search

Página web para buscar partidos programados de fútbol usando la API de football-data.org.

## API elegida

Se eligió [football-data.org](https://www.football-data.org/documentation/api) porque ofrece un endpoint REST `/v4/matches`, filtros por fecha y competición, y un plan gratuito/freemium adecuado para prototipos.

## Configuración

1. Crea una cuenta y token en football-data.org.
2. Instala dependencias:

   ```bash
   npm install
   ```

3. Inicia el servidor con el token como variable de entorno:

   ```bash
   FOOTBALL_DATA_TOKEN=tu_token npm start
   ```

   También puedes dejar la variable vacía y pegar el token en el formulario de la página.

4. Abre <http://localhost:3000>.

## Búsqueda de partidos

El formulario permite seleccionar fecha inicial, fecha final y códigos de competición opcionales separados por coma, por ejemplo `PL,CL,PD`. El backend consulta `/api/matches`, agrega el estado `SCHEDULED` y normaliza la respuesta para la interfaz.

## Scripts

- `npm start`: ejecuta el servidor web.
- `npm test`: ejecuta las pruebas unitarias.
