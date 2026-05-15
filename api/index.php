<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-Football-Data-Token');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

const DB_PATH = __DIR__ . '/../data/polla.sqlite';

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    if (!is_dir(dirname(DB_PATH))) {
        mkdir(dirname(DB_PATH), 0775, true);
    }

    $pdo = new PDO('sqlite:' . DB_PATH);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA foreign_keys = ON');
    migrate($pdo);
    seedDefaults($pdo);

    return $pdo;
}

function migrate(PDO $pdo): void
{
    $pdo->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS matches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phase TEXT NOT NULL,
            home_team TEXT NOT NULL,
            away_team TEXT NOT NULL,
            starts_at TEXT NOT NULL,
            home_score INTEGER DEFAULT NULL,
            away_score INTEGER DEFAULT NULL,
            is_final INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS bets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id INTEGER NOT NULL,
            participant_name TEXT NOT NULL,
            participant_email TEXT NOT NULL,
            home_score INTEGER NOT NULL,
            away_score INTEGER NOT NULL,
            points INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(match_id, participant_email),
            FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE CASCADE
        );
    SQL);
}

function seedDefaults(PDO $pdo): void
{
    $defaults = [
        'lock_minutes_before' => '10',
        'exact_score_points' => '3',
        'result_points' => '1',
        'pool_name' => 'Polla Mundial 2026 - Oficina',
        'mail_from' => 'polla@oficina.local',
        'mail_enabled' => '0',
    ];

    $stmt = $pdo->prepare('INSERT OR IGNORE INTO settings(key, value) VALUES(:key, :value)');
    foreach ($defaults as $key => $value) {
        $stmt->execute([':key' => $key, ':value' => $value]);
    }
}

function jsonInput(): array
{
    $raw = file_get_contents('php://input');
    $data = $raw ? json_decode($raw, true) : [];
    if (!is_array($data)) {
        fail('JSON inválido', 400);
    }
    return $data;
}

function ok(array $payload = []): void
{
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function fail(string $message, int $status = 400): void
{
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function settings(): array
{
    $rows = db()->query('SELECT key, value FROM settings')->fetchAll(PDO::FETCH_KEY_PAIR);
    return [
        'lock_minutes_before' => (int)($rows['lock_minutes_before'] ?? 10),
        'exact_score_points' => (int)($rows['exact_score_points'] ?? 3),
        'result_points' => (int)($rows['result_points'] ?? 1),
        'pool_name' => $rows['pool_name'] ?? 'Polla Mundial 2026 - Oficina',
        'mail_from' => $rows['mail_from'] ?? 'polla@oficina.local',
        'mail_enabled' => ($rows['mail_enabled'] ?? '0') === '1',
    ];
}


function validateApiDate(?string $value, string $field): ?string
{
    if ($value === null || trim($value) === '') {
        return null;
    }

    $value = trim($value);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
        fail("{$field} debe tener formato YYYY-MM-DD");
    }

    return $value;
}

function competitionCodes(?string $value): array
{
    if ($value === null || trim($value) === '') {
        return [];
    }

    $codes = array_map(
        fn(string $code): string => strtoupper(trim($code)),
        explode(',', $value)
    );
    $codes = array_values(array_filter($codes, fn(string $code): bool => $code !== ''));

    return array_values(array_unique($codes));
}

function footballDataToken(): ?string
{
    $serverToken = getenv('FOOTBALL_DATA_TOKEN');
    if (is_string($serverToken) && trim($serverToken) !== '') {
        return trim($serverToken);
    }

    $headerToken = $_SERVER['HTTP_X_FOOTBALL_DATA_TOKEN'] ?? '';
    return trim((string)$headerToken) !== '' ? trim((string)$headerToken) : null;
}

function normalizeScheduledMatch(array $match): array
{
    return [
        'id' => $match['id'] ?? null,
        'utcDate' => $match['utcDate'] ?? '',
        'status' => $match['status'] ?? '',
        'competition' => $match['competition']['name'] ?? 'Competición sin nombre',
        'competitionCode' => $match['competition']['code'] ?? '',
        'homeTeam' => $match['homeTeam']['name'] ?? 'Local por definir',
        'awayTeam' => $match['awayTeam']['name'] ?? 'Visitante por definir',
        'matchday' => $match['matchday'] ?? null,
        'stage' => $match['stage'] ?? '',
    ];
}

function scheduledMatches(): void
{
    $token = footballDataToken();
    if ($token === null) {
        fail('Falta el token de football-data.org. Configura FOOTBALL_DATA_TOKEN o envía X-Football-Data-Token.');
    }

    $query = ['status' => 'SCHEDULED'];
    $dateFrom = validateApiDate($_GET['dateFrom'] ?? null, 'dateFrom');
    $dateTo = validateApiDate($_GET['dateTo'] ?? null, 'dateTo');
    if ($dateFrom !== null) {
        $query['dateFrom'] = $dateFrom;
    }
    if ($dateTo !== null) {
        $query['dateTo'] = $dateTo;
    }

    $competitions = competitionCodes($_GET['competitions'] ?? null);
    if ($competitions !== []) {
        $query['competitions'] = implode(',', $competitions);
    }

    $url = 'https://api.football-data.org/v4/matches?' . http_build_query($query);
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => "X-Auth-Token: {$token}\r\nAccept: application/json\r\n",
            'ignore_errors' => true,
            'timeout' => 15,
        ],
    ]);

    $raw = file_get_contents($url, false, $context);
    $statusCode = 502;
    foreach (($http_response_header ?? []) as $header) {
        if (preg_match('/^HTTP\/\S+\s+(\d+)/', $header, $matches)) {
            $statusCode = (int)$matches[1];
            break;
        }
    }

    if ($raw === false) {
        fail('No se pudo consultar football-data.org', 502);
    }

    $payload = json_decode($raw, true);
    if (!is_array($payload)) {
        fail('football-data.org devolvió una respuesta inválida', 502);
    }

    if ($statusCode < 200 || $statusCode >= 300) {
        fail((string)($payload['message'] ?? 'No se pudo consultar football-data.org'), $statusCode);
    }

    $matches = array_map('normalizeScheduledMatch', $payload['matches'] ?? []);
    ok([
        'source' => 'football-data.org',
        'count' => $payload['count'] ?? count($matches),
        'filters' => $payload['filters'] ?? [],
        'matches' => $matches,
    ]);
}

function validateScore(mixed $score, string $label): int
{
    if (!is_numeric($score) || (int)$score < 0 || (int)$score > 99) {
        fail("El marcador {$label} debe estar entre 0 y 99");
    }
    return (int)$score;
}

function normalizeEmail(string $email): string
{
    $email = strtolower(trim($email));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        fail('Correo electrónico inválido');
    }
    return $email;
}

function phaseOrder(string $phase): int
{
    $order = [
        'Fase de grupos' => 1,
        'Dieciseisavos' => 2,
        'Octavos' => 3,
        'Cuartos' => 4,
        'Semifinales' => 5,
        'Tercer lugar' => 6,
        'Final' => 7,
    ];
    return $order[$phase] ?? 99;
}

function decorateMatch(array $match, array $config): array
{
    $start = strtotime($match['starts_at']);
    $lockAt = $start - ($config['lock_minutes_before'] * 60);
    $match['id'] = (int)$match['id'];
    $match['home_score'] = $match['home_score'] === null ? null : (int)$match['home_score'];
    $match['away_score'] = $match['away_score'] === null ? null : (int)$match['away_score'];
    $match['is_final'] = (bool)$match['is_final'];
    $match['lock_at'] = gmdate('Y-m-d\TH:i:s\Z', $lockAt);
    $match['is_locked'] = time() >= $lockAt;
    return $match;
}

function outcome(int $home, int $away): string
{
    return $home === $away ? 'draw' : ($home > $away ? 'home' : 'away');
}

function calculatePoints(int $betHome, int $betAway, int $realHome, int $realAway, array $config): int
{
    if ($betHome === $realHome && $betAway === $realAway) {
        return $config['exact_score_points'];
    }
    if (outcome($betHome, $betAway) === outcome($realHome, $realAway)) {
        return $config['result_points'];
    }
    return 0;
}

function recalculateMatch(PDO $pdo, int $matchId): void
{
    $match = $pdo->prepare('SELECT * FROM matches WHERE id = :id');
    $match->execute([':id' => $matchId]);
    $row = $match->fetch(PDO::FETCH_ASSOC);
    if (!$row || !$row['is_final'] || $row['home_score'] === null || $row['away_score'] === null) {
        return;
    }

    $config = settings();
    $bets = $pdo->prepare('SELECT * FROM bets WHERE match_id = :match_id');
    $bets->execute([':match_id' => $matchId]);
    $update = $pdo->prepare('UPDATE bets SET points = :points WHERE id = :id');
    foreach ($bets->fetchAll(PDO::FETCH_ASSOC) as $bet) {
        $points = calculatePoints((int)$bet['home_score'], (int)$bet['away_score'], (int)$row['home_score'], (int)$row['away_score'], $config);
        $update->execute([':points' => $points, ':id' => $bet['id']]);
    }
}

function sendBetEmail(array $match, array $bet, array $config): void
{
    if (!$config['mail_enabled']) {
        return;
    }

    $subject = sprintf('Tu apuesta: %s vs %s', $match['home_team'], $match['away_team']);
    $body = sprintf(
        "Hola %s,\n\nRegistramos tu apuesta para %s vs %s (%s):\nMarcador: %d - %d\nCierre de apuestas: %s\n\n¡Suerte!",
        $bet['participant_name'],
        $match['home_team'],
        $match['away_team'],
        $match['phase'],
        $bet['home_score'],
        $bet['away_score'],
        $match['lock_at'] ?? 'configurado antes del partido'
    );
    $headers = 'From: ' . $config['mail_from'];
    @mail($bet['participant_email'], $subject, $body, $headers);
}

function listMatches(): void
{
    $config = settings();
    $rows = db()->query('SELECT * FROM matches ORDER BY starts_at ASC, id ASC')->fetchAll(PDO::FETCH_ASSOC);
    usort($rows, fn($a, $b) => [phaseOrder($a['phase']), $a['starts_at']] <=> [phaseOrder($b['phase']), $b['starts_at']]);
    ok(['matches' => array_map(fn($match) => decorateMatch($match, $config), $rows)]);
}

function saveMatch(): void
{
    $data = jsonInput();
    foreach (['phase', 'home_team', 'away_team', 'starts_at'] as $field) {
        if (empty(trim((string)($data[$field] ?? '')))) {
            fail("Falta el campo {$field}");
        }
    }

    $startsAt = date('Y-m-d H:i:s', strtotime((string)$data['starts_at']));
    $pdo = db();
    if (!empty($data['id'])) {
        $stmt = $pdo->prepare('UPDATE matches SET phase = :phase, home_team = :home, away_team = :away, starts_at = :starts WHERE id = :id');
        $stmt->execute([':phase' => trim($data['phase']), ':home' => trim($data['home_team']), ':away' => trim($data['away_team']), ':starts' => $startsAt, ':id' => (int)$data['id']]);
        ok(['message' => 'Partido actualizado']);
    }

    $stmt = $pdo->prepare('INSERT INTO matches(phase, home_team, away_team, starts_at) VALUES(:phase, :home, :away, :starts)');
    $stmt->execute([':phase' => trim($data['phase']), ':home' => trim($data['home_team']), ':away' => trim($data['away_team']), ':starts' => $startsAt]);
    ok(['message' => 'Partido creado', 'id' => (int)$pdo->lastInsertId()]);
}

function importMatches(): void
{
    $data = jsonInput();
    $matches = $data['matches'] ?? [];
    if (!is_array($matches) || count($matches) === 0) {
        fail('No hay partidos para importar');
    }

    $pdo = db();
    $stmt = $pdo->prepare('INSERT INTO matches(phase, home_team, away_team, starts_at) VALUES(:phase, :home, :away, :starts)');
    $count = 0;
    foreach ($matches as $match) {
        if (empty($match['phase']) || empty($match['home_team']) || empty($match['away_team']) || empty($match['starts_at'])) {
            continue;
        }
        $stmt->execute([
            ':phase' => trim((string)$match['phase']),
            ':home' => trim((string)$match['home_team']),
            ':away' => trim((string)$match['away_team']),
            ':starts' => date('Y-m-d H:i:s', strtotime((string)$match['starts_at'])),
        ]);
        $count++;
    }
    ok(['message' => "{$count} partidos importados"]);
}

function saveBet(): void
{
    $data = jsonInput();
    $pdo = db();
    $matchStmt = $pdo->prepare('SELECT * FROM matches WHERE id = :id');
    $matchStmt->execute([':id' => (int)($data['match_id'] ?? 0)]);
    $match = $matchStmt->fetch(PDO::FETCH_ASSOC);
    if (!$match) {
        fail('Partido no encontrado', 404);
    }

    $config = settings();
    $decorated = decorateMatch($match, $config);
    if ($decorated['is_locked']) {
        fail('La apuesta ya está cerrada para este partido', 423);
    }

    $name = trim((string)($data['participant_name'] ?? ''));
    if ($name === '') {
        fail('Nombre requerido');
    }

    $email = normalizeEmail((string)($data['participant_email'] ?? ''));
    $bet = [
        'match_id' => (int)$match['id'],
        'participant_name' => $name,
        'participant_email' => $email,
        'home_score' => validateScore($data['home_score'] ?? null, 'local'),
        'away_score' => validateScore($data['away_score'] ?? null, 'visitante'),
    ];

    $stmt = $pdo->prepare(<<<'SQL'
        INSERT INTO bets(match_id, participant_name, participant_email, home_score, away_score)
        VALUES(:match_id, :participant_name, :participant_email, :home_score, :away_score)
        ON CONFLICT(match_id, participant_email) DO UPDATE SET
            participant_name = excluded.participant_name,
            home_score = excluded.home_score,
            away_score = excluded.away_score,
            updated_at = CURRENT_TIMESTAMP
    SQL);
    $stmt->execute($bet);
    sendBetEmail($decorated, $bet, $config);
    ok(['message' => 'Apuesta guardada y confirmación procesada']);
}

function listBets(): void
{
    $matchId = (int)($_GET['match_id'] ?? 0);
    $stmt = db()->prepare('SELECT * FROM bets WHERE match_id = :match_id ORDER BY participant_name');
    $stmt->execute([':match_id' => $matchId]);
    ok(['bets' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

function saveResult(): void
{
    $data = jsonInput();
    $home = validateScore($data['home_score'] ?? null, 'local');
    $away = validateScore($data['away_score'] ?? null, 'visitante');
    $matchId = (int)($data['match_id'] ?? 0);
    $pdo = db();
    $stmt = $pdo->prepare('UPDATE matches SET home_score = :home, away_score = :away, is_final = 1 WHERE id = :id');
    $stmt->execute([':home' => $home, ':away' => $away, ':id' => $matchId]);
    recalculateMatch($pdo, $matchId);
    ok(['message' => 'Resultado guardado y puntuaciones recalculadas']);
}

function getLeaderboard(): void
{
    $rows = db()->query(<<<'SQL'
        SELECT participant_name, participant_email, SUM(points) AS points, COUNT(*) AS bets
        FROM bets
        GROUP BY participant_email
        ORDER BY points DESC, participant_name ASC
    SQL)->fetchAll(PDO::FETCH_ASSOC);
    ok(['leaderboard' => $rows]);
}

function saveSettings(): void
{
    $data = jsonInput();
    $allowed = ['lock_minutes_before', 'exact_score_points', 'result_points', 'pool_name', 'mail_from', 'mail_enabled'];
    $stmt = db()->prepare('INSERT INTO settings(key, value) VALUES(:key, :value) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    foreach ($allowed as $key) {
        if (!array_key_exists($key, $data)) {
            continue;
        }
        $value = $key === 'mail_enabled' ? (!empty($data[$key]) ? '1' : '0') : (string)$data[$key];
        $stmt->execute([':key' => $key, ':value' => $value]);
    }
    ok(['message' => 'Configuración guardada', 'settings' => settings()]);
}

try {
    $route = $_GET['route'] ?? 'health';
    $method = $_SERVER['REQUEST_METHOD'];

    if ($route === 'health') {
        ok(['status' => 'ok']);
    } elseif ($route === 'settings' && $method === 'GET') {
        ok(['settings' => settings()]);
    } elseif ($route === 'settings' && $method === 'POST') {
        saveSettings();
    } elseif ($route === 'matches' && $method === 'GET') {
        listMatches();
    } elseif ($route === 'scheduled-matches' && $method === 'GET') {
        scheduledMatches();
    } elseif ($route === 'matches' && $method === 'POST') {
        saveMatch();
    } elseif ($route === 'matches/import' && $method === 'POST') {
        importMatches();
    } elseif ($route === 'bets' && $method === 'GET') {
        listBets();
    } elseif ($route === 'bets' && $method === 'POST') {
        saveBet();
    } elseif ($route === 'results' && $method === 'POST') {
        saveResult();
    } elseif ($route === 'leaderboard' && $method === 'GET') {
        getLeaderboard();
    } else {
        fail('Ruta no encontrada', 404);
    }
} catch (Throwable $exception) {
    fail($exception->getMessage(), 500);
}
