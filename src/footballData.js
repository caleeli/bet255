const FOOTBALL_DATA_BASE_URL = 'https://api.football-data.org/v4/matches';
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function buildFootballDataUrl({ dateFrom, dateTo, competitions } = {}) {
  const url = new URL(FOOTBALL_DATA_BASE_URL);

  appendDateParam(url, 'dateFrom', dateFrom);
  appendDateParam(url, 'dateTo', dateTo);
  url.searchParams.set('status', 'SCHEDULED');

  const competitionCodes = parseCompetitionCodes(competitions);
  if (competitionCodes.length > 0) {
    url.searchParams.set('competitions', competitionCodes.join(','));
  }

  return url;
}

export function normalizeMatches(matches) {
  return matches.map((match) => ({
    id: match.id,
    utcDate: match.utcDate,
    status: match.status,
    competition: match.competition?.name ?? 'Competición sin nombre',
    competitionCode: match.competition?.code ?? '',
    homeTeam: match.homeTeam?.name ?? 'Local por definir',
    awayTeam: match.awayTeam?.name ?? 'Visitante por definir',
    matchday: match.matchday ?? null,
    stage: match.stage ?? '',
  }));
}

function appendDateParam(url, name, value) {
  if (!value) return;

  if (!ISO_DATE_PATTERN.test(value)) {
    throw new Error(`${name} debe tener formato YYYY-MM-DD.`);
  }

  url.searchParams.set(name, value);
}

function parseCompetitionCodes(value) {
  if (!value || typeof value !== 'string') return [];

  return value
    .split(',')
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean)
    .filter((code, index, list) => list.indexOf(code) === index);
}
