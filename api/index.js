const DEFAULT_SETTINGS = {
  lock_minutes_before: 10,
  exact_score_points: 3,
  result_points: 1,
  pool_name: 'Polla Mundial 2026 - Oficina',
  mail_from: 'polla@oficina.local',
  mail_enabled: false,
};

const PHASE_ORDER = new Map([
  ['Fase de grupos', 1],
  ['Dieciseisavos', 2],
  ['Octavos', 3],
  ['Cuartos', 4],
  ['Semifinales', 5],
  ['Tercer lugar', 6],
  ['Final', 7],
]);

let memoryState;

function freshState() {
  return {
    settings: { ...DEFAULT_SETTINGS },
    matches: [],
    bets: [],
    nextMatchId: 1,
    nextBetId: 1,
  };
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload, null, 2));
}

function fail(status, message) {
  const error = new Error(message);
  error.statusCode = status;
  throw error;
}

function kvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kv(command, ...args) {
  const response = await fetch(`${process.env.KV_REST_API_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([[command, ...args]]),
  });

  if (!response.ok) {
    throw new Error(`Vercel KV respondió ${response.status}`);
  }

  const [result] = await response.json();
  if (result.error) {
    throw new Error(result.error);
  }
  return result.result;
}

async function loadState() {
  if (kvConfigured()) {
    const raw = await kv('GET', 'bet255:state');
    if (raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return normalizeState(parsed);
    }
  }

  if (!memoryState) {
    memoryState = freshState();
  }
  return normalizeState(memoryState);
}

async function saveState(state) {
  const normalized = normalizeState(state);
  if (kvConfigured()) {
    await kv('SET', 'bet255:state', JSON.stringify(normalized));
  }
  memoryState = normalized;
}

function normalizeState(state) {
  return {
    settings: { ...DEFAULT_SETTINGS, ...(state?.settings || {}) },
    matches: Array.isArray(state?.matches) ? state.matches : [],
    bets: Array.isArray(state?.bets) ? state.bets : [],
    nextMatchId: Number.isInteger(state?.nextMatchId) ? state.nextMatchId : nextId(state?.matches),
    nextBetId: Number.isInteger(state?.nextBetId) ? state.nextBetId : nextId(state?.bets),
  };
}

function nextId(rows = []) {
  return rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1;
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};

  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      fail(400, 'JSON inválido');
    }
    return data;
  } catch {
    fail(400, 'JSON inválido');
  }
}

function requestUrl(req) {
  return new URL(req.url || '/api', `https://${req.headers.host || 'localhost'}`);
}

function routeFrom(req) {
  const url = requestUrl(req);
  const queryRoute = url.searchParams.get('route');
  if (queryRoute) return queryRoute;

  const path = url.pathname.replace(/^\/api\/?/, '').replace(/^index\.js\/?/, '');
  return path || 'health';
}

function validateScore(score, label) {
  const numeric = Number(score);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 99) {
    fail(400, `El marcador ${label} debe estar entre 0 y 99`);
  }
  return numeric;
}

function normalizeEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    fail(400, 'Correo electrónico inválido');
  }
  return normalized;
}

function normalizeDateTime(value) {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) {
    fail(400, 'Fecha y hora inválida');
  }
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function phaseOrder(phase) {
  return PHASE_ORDER.get(phase) || 99;
}

function decorateMatch(match, settings) {
  const start = new Date(String(match.starts_at).replace(' ', 'T'));
  const lockAt = new Date(start.getTime() - Number(settings.lock_minutes_before) * 60 * 1000);
  return {
    ...match,
    id: Number(match.id),
    home_score: match.home_score ?? null,
    away_score: match.away_score ?? null,
    is_final: Boolean(match.is_final),
    lock_at: lockAt.toISOString(),
    is_locked: Date.now() >= lockAt.getTime(),
  };
}

function outcome(home, away) {
  return home === away ? 'draw' : home > away ? 'home' : 'away';
}

function calculatePoints(betHome, betAway, realHome, realAway, settings) {
  if (betHome === realHome && betAway === realAway) {
    return Number(settings.exact_score_points);
  }
  if (outcome(betHome, betAway) === outcome(realHome, realAway)) {
    return Number(settings.result_points);
  }
  return 0;
}

function recalculateMatch(state, matchId) {
  const match = state.matches.find((item) => item.id === matchId);
  if (!match?.is_final || match.home_score === null || match.away_score === null) return;

  for (const bet of state.bets.filter((item) => item.match_id === matchId)) {
    bet.points = calculatePoints(bet.home_score, bet.away_score, match.home_score, match.away_score, state.settings);
  }
}

function listMatches(state) {
  const matches = [...state.matches].sort((a, b) => {
    const orderDiff = phaseOrder(a.phase) - phaseOrder(b.phase);
    return orderDiff || String(a.starts_at).localeCompare(String(b.starts_at)) || a.id - b.id;
  });
  return { matches: matches.map((match) => decorateMatch(match, state.settings)) };
}

async function saveMatch(state, req) {
  const data = await readBody(req);
  for (const field of ['phase', 'home_team', 'away_team', 'starts_at']) {
    if (!String(data[field] || '').trim()) fail(400, `Falta el campo ${field}`);
  }

  const payload = {
    phase: String(data.phase).trim(),
    home_team: String(data.home_team).trim(),
    away_team: String(data.away_team).trim(),
    starts_at: normalizeDateTime(data.starts_at),
  };

  if (data.id) {
    const id = Number(data.id);
    const match = state.matches.find((item) => item.id === id);
    if (!match) fail(404, 'Partido no encontrado');
    Object.assign(match, payload);
    await saveState(state);
    return { message: 'Partido actualizado' };
  }

  const match = {
    id: state.nextMatchId++,
    ...payload,
    home_score: null,
    away_score: null,
    is_final: false,
    created_at: new Date().toISOString(),
  };
  state.matches.push(match);
  await saveState(state);
  return { message: 'Partido creado', id: match.id };
}

async function importMatches(state, req) {
  const data = await readBody(req);
  const matches = data.matches;
  if (!Array.isArray(matches) || matches.length === 0) fail(400, 'No hay partidos para importar');

  let count = 0;
  for (const match of matches) {
    if (!match?.phase || !match?.home_team || !match?.away_team || !match?.starts_at) continue;
    state.matches.push({
      id: state.nextMatchId++,
      phase: String(match.phase).trim(),
      home_team: String(match.home_team).trim(),
      away_team: String(match.away_team).trim(),
      starts_at: normalizeDateTime(match.starts_at),
      home_score: null,
      away_score: null,
      is_final: false,
      created_at: new Date().toISOString(),
    });
    count++;
  }
  await saveState(state);
  return { message: `${count} partidos importados` };
}

async function saveBet(state, req) {
  const data = await readBody(req);
  const match = state.matches.find((item) => item.id === Number(data.match_id));
  if (!match) fail(404, 'Partido no encontrado');

  const decorated = decorateMatch(match, state.settings);
  if (decorated.is_locked) fail(423, 'La apuesta ya está cerrada para este partido');

  const participantName = String(data.participant_name || '').trim();
  if (!participantName) fail(400, 'Nombre requerido');

  const participantEmail = normalizeEmail(data.participant_email);
  const existing = state.bets.find((bet) => bet.match_id === match.id && bet.participant_email === participantEmail);
  const payload = {
    match_id: match.id,
    participant_name: participantName,
    participant_email: participantEmail,
    home_score: validateScore(data.home_score, 'local'),
    away_score: validateScore(data.away_score, 'visitante'),
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    Object.assign(existing, payload);
  } else {
    state.bets.push({
      id: state.nextBetId++,
      ...payload,
      points: 0,
      created_at: new Date().toISOString(),
    });
  }

  await saveState(state);
  return { message: 'Apuesta guardada y confirmación procesada' };
}

async function saveResult(state, req) {
  const data = await readBody(req);
  const match = state.matches.find((item) => item.id === Number(data.match_id));
  if (!match) fail(404, 'Partido no encontrado');

  match.home_score = validateScore(data.home_score, 'local');
  match.away_score = validateScore(data.away_score, 'visitante');
  match.is_final = true;
  recalculateMatch(state, match.id);
  await saveState(state);
  return { message: 'Resultado guardado y puntuaciones recalculadas' };
}

function leaderboard(state) {
  const rows = new Map();
  for (const bet of state.bets) {
    const row = rows.get(bet.participant_email) || {
      participant_name: bet.participant_name,
      participant_email: bet.participant_email,
      points: 0,
      bets: 0,
    };
    row.participant_name = bet.participant_name;
    row.points += Number(bet.points) || 0;
    row.bets += 1;
    rows.set(bet.participant_email, row);
  }

  return {
    leaderboard: [...rows.values()].sort((a, b) => b.points - a.points || a.participant_name.localeCompare(b.participant_name)),
  };
}

async function saveSettings(state, req) {
  const data = await readBody(req);
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (Object.hasOwn(data, key)) {
      state.settings[key] = key === 'mail_enabled' ? Boolean(data[key]) : data[key];
    }
  }
  for (const match of state.matches) {
    if (match.is_final) recalculateMatch(state, match.id);
  }
  await saveState(state);
  return { message: 'Configuración guardada', settings: state.settings };
}

function validateApiDate(value, field) {
  if (!value) return null;
  const normalized = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) fail(400, `${field} debe tener formato YYYY-MM-DD`);
  return normalized;
}

function competitionCodes(value) {
  if (!value) return [];
  return [...new Set(String(value).split(',').map((code) => code.trim().toUpperCase()).filter(Boolean))];
}

function normalizeScheduledMatch(match) {
  return {
    id: match.id ?? null,
    utcDate: match.utcDate ?? '',
    status: match.status ?? '',
    competition: match.competition?.name ?? 'Competición sin nombre',
    competitionCode: match.competition?.code ?? '',
    homeTeam: match.homeTeam?.name ?? 'Local por definir',
    awayTeam: match.awayTeam?.name ?? 'Visitante por definir',
    matchday: match.matchday ?? null,
    stage: match.stage ?? '',
  };
}

async function scheduledMatches(req) {
  const url = requestUrl(req);
  const token = process.env.FOOTBALL_DATA_TOKEN || req.headers['x-football-data-token'];
  if (!token) fail(400, 'Falta el token de football-data.org. Configura FOOTBALL_DATA_TOKEN o envía X-Football-Data-Token.');

  const params = new URLSearchParams({ status: 'SCHEDULED' });
  const dateFrom = validateApiDate(url.searchParams.get('dateFrom'), 'dateFrom');
  const dateTo = validateApiDate(url.searchParams.get('dateTo'), 'dateTo');
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  const competitions = competitionCodes(url.searchParams.get('competitions'));
  if (competitions.length) params.set('competitions', competitions.join(','));

  const response = await fetch(`https://api.football-data.org/v4/matches?${params}`, {
    headers: { 'X-Auth-Token': token, Accept: 'application/json' },
  });
  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== 'object') fail(502, 'football-data.org devolvió una respuesta inválida');
  if (!response.ok) fail(response.status, String(payload.message || 'No se pudo consultar football-data.org'));

  const matches = Array.isArray(payload.matches) ? payload.matches.map(normalizeScheduledMatch) : [];
  return {
    source: 'football-data.org',
    count: payload.count ?? matches.length,
    filters: payload.filters ?? {},
    matches,
  };
}

async function handle(req) {
  const method = req.method || 'GET';
  const route = routeFrom(req);

  if (route === 'health') return { status: 'ok', storage: kvConfigured() ? 'vercel-kv' : 'memory' };
  if (route === 'scheduled-matches' && method === 'GET') return scheduledMatches(req);

  const state = await loadState();

  if (route === 'settings' && method === 'GET') return { settings: state.settings };
  if (route === 'settings' && method === 'POST') return saveSettings(state, req);
  if (route === 'matches' && method === 'GET') return listMatches(state);
  if (route === 'matches' && method === 'POST') return saveMatch(state, req);
  if (route === 'matches/import' && method === 'POST') return importMatches(state, req);
  if (route === 'bets' && method === 'GET') {
    const matchId = Number(requestUrl(req).searchParams.get('match_id'));
    return { bets: state.bets.filter((bet) => bet.match_id === matchId).sort((a, b) => a.participant_name.localeCompare(b.participant_name)) };
  }
  if (route === 'bets' && method === 'POST') return saveBet(state, req);
  if (route === 'results' && method === 'POST') return saveResult(state, req);
  if (route === 'leaderboard' && method === 'GET') return leaderboard(state);

  fail(404, 'Ruta no encontrada');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Football-Data-Token');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    json(res, 200, await handle(req));
  } catch (error) {
    json(res, error.statusCode || 500, { error: error.message || 'Error inesperado' });
  }
}
