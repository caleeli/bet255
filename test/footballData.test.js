import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFootballDataUrl, normalizeMatches } from '../src/footballData.js';

test('buildFootballDataUrl creates a scheduled matches URL with date and competition filters', () => {
  const url = buildFootballDataUrl({
    dateFrom: '2026-05-15',
    dateTo: '2026-05-22',
    competitions: 'pl, CL,pl',
  });

  assert.equal(url.origin + url.pathname, 'https://api.football-data.org/v4/matches');
  assert.equal(url.searchParams.get('dateFrom'), '2026-05-15');
  assert.equal(url.searchParams.get('dateTo'), '2026-05-22');
  assert.equal(url.searchParams.get('status'), 'SCHEDULED');
  assert.equal(url.searchParams.get('competitions'), 'PL,CL');
});

test('buildFootballDataUrl rejects invalid date formats', () => {
  assert.throws(() => buildFootballDataUrl({ dateFrom: '15-05-2026' }), /YYYY-MM-DD/);
});

test('normalizeMatches returns stable fields for the UI', () => {
  const [match] = normalizeMatches([
    {
      id: 100,
      utcDate: '2026-05-15T19:00:00Z',
      status: 'SCHEDULED',
      competition: { name: 'Premier League', code: 'PL' },
      homeTeam: { name: 'Arsenal FC' },
      awayTeam: { name: 'Chelsea FC' },
      matchday: 12,
      stage: 'REGULAR_SEASON',
    },
  ]);

  assert.deepEqual(match, {
    id: 100,
    utcDate: '2026-05-15T19:00:00Z',
    status: 'SCHEDULED',
    competition: 'Premier League',
    competitionCode: 'PL',
    homeTeam: 'Arsenal FC',
    awayTeam: 'Chelsea FC',
    matchday: 12,
    stage: 'REGULAR_SEASON',
  });
});
