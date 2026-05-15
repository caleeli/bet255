import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildFootballDataUrl, normalizeMatches } from './src/footballData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function buildServer({ fetchImpl = globalThis.fetch } = {}) {
  const app = Fastify({ logger: true });

  app.register(fastifyStatic, {
    root: join(__dirname, 'public'),
    prefix: '/',
  });

  app.get('/api/matches', async (request, reply) => {
    const apiToken = process.env.FOOTBALL_DATA_TOKEN || request.headers['x-football-data-token'];

    if (!apiToken) {
      return reply.code(400).send({
        error: 'Falta el token de football-data.org.',
        help: 'Configura FOOTBALL_DATA_TOKEN en el servidor o escribe tu token en la página de búsqueda.',
      });
    }

    const { dateFrom, dateTo, competitions } = request.query;
    let endpoint;

    try {
      endpoint = buildFootballDataUrl({ dateFrom, dateTo, competitions });
    } catch (error) {
      return reply.code(400).send({
        error: error.message,
      });
    }

    const response = await fetchImpl(endpoint, {
      headers: {
        'X-Auth-Token': apiToken,
        Accept: 'application/json',
      },
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return reply.code(response.status).send({
        error: payload.message || 'No se pudo consultar football-data.org.',
        statusCode: response.status,
      });
    }

    return {
      source: 'football-data.org',
      count: payload.count ?? payload.matches?.length ?? 0,
      filters: payload.filters ?? {},
      matches: normalizeMatches(payload.matches ?? []),
    };
  });

  return app;
}

if (process.argv[1] === __filename) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';
  const app = buildServer();

  app.listen({ port, host }).catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
}
