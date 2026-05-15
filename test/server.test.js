import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../server.js';

test('GET /api/matches requires a football-data token', async () => {
  const app = buildServer({ fetchImpl: async () => assert.fail('fetch should not be called') });
  test.after(async () => app.close());

  const response = await app.inject('/api/matches?dateFrom=2026-05-15&dateTo=2026-05-22');
  const payload = response.json();

  assert.equal(response.statusCode, 400);
  assert.match(payload.error, /Falta el token/);
});

test('GET /api/matches validates date format before proxying', async () => {
  const app = buildServer({ fetchImpl: async () => assert.fail('fetch should not be called') });
  test.after(async () => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/api/matches?dateFrom=15-05-2026',
    headers: { 'x-football-data-token': 'demo-token' },
  });
  const payload = response.json();

  assert.equal(response.statusCode, 400);
  assert.match(payload.error, /YYYY-MM-DD/);
});

test('GET /api/matches proxies scheduled matches and normalizes the response', async () => {
  let requestedUrl;
  const app = buildServer({
    fetchImpl: async (url) => {
      requestedUrl = url;
      return Response.json({
        count: 1,
        filters: { status: 'SCHEDULED' },
        matches: [
          {
            id: 7,
            utcDate: '2026-05-20T20:00:00Z',
            status: 'SCHEDULED',
            competition: { name: 'UEFA Champions League', code: 'CL' },
            homeTeam: { name: 'Equipo A' },
            awayTeam: { name: 'Equipo B' },
          },
        ],
      });
    },
  });
  test.after(async () => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/api/matches?dateFrom=2026-05-15&dateTo=2026-05-22&competitions=cl',
    headers: { 'x-football-data-token': 'demo-token' },
  });
  const payload = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(requestedUrl.searchParams.get('status'), 'SCHEDULED');
  assert.equal(requestedUrl.searchParams.get('competitions'), 'CL');
  assert.equal(payload.matches[0].competition, 'UEFA Champions League');
});
