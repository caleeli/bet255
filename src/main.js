import { createApp, computed, onMounted, reactive, ref } from 'vue';
import './styles.css';

const API_BASE = import.meta.env.VITE_API_BASE || '/api/index.php';
const phases = ['Fase de grupos', 'Dieciseisavos', 'Octavos', 'Cuartos', 'Semifinales', 'Tercer lugar', 'Final'];

async function api(route, options = {}) {
  const response = await fetch(`${API_BASE}?route=${route}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Error inesperado');
  }
  return payload;
}

createApp({
  setup() {
    const activeTab = ref('bets');
    const loading = ref(false);
    const toast = reactive({ type: 'info', message: '' });
    const settings = reactive({
      lock_minutes_before: 10,
      exact_score_points: 3,
      result_points: 1,
      pool_name: 'Polla Mundial 2026 - Oficina',
      mail_from: 'polla@oficina.local',
      mail_enabled: false,
    });
    const matches = ref([]);
    const leaderboard = ref([]);
    const selectedMatchId = ref(null);
    const betForm = reactive({ participant_name: '', participant_email: '', home_score: 0, away_score: 0 });
    const matchForm = reactive({ id: null, phase: phases[0], home_team: '', away_team: '', starts_at: '' });
    const importText = ref('');
    const resultForms = reactive({});

    const selectedMatch = computed(() => matches.value.find((match) => match.id === selectedMatchId.value));
    const groupedMatches = computed(() => {
      return phases.reduce((groups, phase) => {
        const phaseMatches = matches.value.filter((match) => match.phase === phase);
        if (phaseMatches.length) groups[phase] = phaseMatches;
        return groups;
      }, {});
    });

    const openMatches = computed(() => matches.value.filter((match) => !match.is_final));

    function showToast(message, type = 'success') {
      toast.message = message;
      toast.type = type;
      window.setTimeout(() => {
        if (toast.message === message) toast.message = '';
      }, 4500);
    }

    function dateForInput(value) {
      if (!value) return '';
      const date = new Date(value.replace(' ', 'T'));
      return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16);
    }

    function formatDate(value) {
      return new Intl.DateTimeFormat('es', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value.replace(' ', 'T')));
    }

    function lockText(match) {
      return match.is_locked ? 'Cerrada' : `Cierra ${formatDate(match.lock_at)}`;
    }

    async function loadAll() {
      loading.value = true;
      try {
        const [settingsResponse, matchesResponse, leaderboardResponse] = await Promise.all([
          api('settings'),
          api('matches'),
          api('leaderboard'),
        ]);
        Object.assign(settings, settingsResponse.settings);
        matches.value = matchesResponse.matches;
        leaderboard.value = leaderboardResponse.leaderboard;
        if (!selectedMatchId.value && openMatches.value.length) {
          selectedMatchId.value = openMatches.value[0].id;
        }
        matches.value.forEach((match) => {
          resultForms[match.id] = {
            home_score: match.home_score ?? 0,
            away_score: match.away_score ?? 0,
          };
        });
      } catch (error) {
        showToast(error.message, 'error');
      } finally {
        loading.value = false;
      }
    }

    async function submitBet() {
      if (!selectedMatch.value) return;
      try {
        const payload = { ...betForm, match_id: selectedMatch.value.id };
        const response = await api('bets', { method: 'POST', body: JSON.stringify(payload) });
        showToast(response.message);
        await loadAll();
      } catch (error) {
        showToast(error.message, 'error');
      }
    }

    async function saveSettings() {
      try {
        const response = await api('settings', { method: 'POST', body: JSON.stringify(settings) });
        Object.assign(settings, response.settings);
        showToast(response.message);
        await loadAll();
      } catch (error) {
        showToast(error.message, 'error');
      }
    }

    async function saveMatch() {
      try {
        const payload = { ...matchForm, starts_at: matchForm.starts_at };
        const response = await api('matches', { method: 'POST', body: JSON.stringify(payload) });
        showToast(response.message);
        Object.assign(matchForm, { id: null, phase: phases[0], home_team: '', away_team: '', starts_at: '' });
        await loadAll();
      } catch (error) {
        showToast(error.message, 'error');
      }
    }

    function editMatch(match) {
      activeTab.value = 'matches';
      Object.assign(matchForm, {
        id: match.id,
        phase: match.phase,
        home_team: match.home_team,
        away_team: match.away_team,
        starts_at: dateForInput(match.starts_at),
      });
    }

    async function importMatches() {
      try {
        const matchesToImport = JSON.parse(importText.value);
        const response = await api('matches/import', {
          method: 'POST',
          body: JSON.stringify({ matches: matchesToImport }),
        });
        showToast(response.message);
        importText.value = '';
        await loadAll();
      } catch (error) {
        showToast(error.message.includes('JSON') ? 'El JSON de importación no es válido' : error.message, 'error');
      }
    }

    async function saveResult(match) {
      try {
        const response = await api('results', {
          method: 'POST',
          body: JSON.stringify({ match_id: match.id, ...resultForms[match.id] }),
        });
        showToast(response.message);
        await loadAll();
      } catch (error) {
        showToast(error.message, 'error');
      }
    }

    function sampleImport() {
      importText.value = JSON.stringify([
        { phase: 'Fase de grupos', home_team: 'Equipo A', away_team: 'Equipo B', starts_at: '2026-06-11T19:00' },
        { phase: 'Octavos', home_team: '1A', away_team: '2B', starts_at: '2026-07-04T20:00' },
        { phase: 'Final', home_team: 'Ganador SF1', away_team: 'Ganador SF2', starts_at: '2026-07-19T19:00' },
      ], null, 2);
    }

    onMounted(loadAll);

    return {
      activeTab,
      betForm,
      editMatch,
      formatDate,
      groupedMatches,
      importMatches,
      importText,
      leaderboard,
      loading,
      lockText,
      matchForm,
      matches,
      openMatches,
      phases,
      resultForms,
      sampleImport,
      saveMatch,
      saveResult,
      saveSettings,
      selectedMatch,
      selectedMatchId,
      settings,
      submitBet,
      toast,
    };
  },
  template: `
    <main class="app-shell">
      <section class="hero">
        <div>
          <p class="eyebrow">Mundial FIFA 2026 · Oficina</p>
          <h1>{{ settings.pool_name }}</h1>
          <p class="hero-copy">Organiza pronósticos por fase, bloquea apuestas antes del inicio, confirma por correo y calcula puntos automáticamente por marcador exacto o resultado.</p>
        </div>
        <div class="score-card">
          <span>Reglas activas</span>
          <strong>{{ settings.exact_score_points }} pts</strong>
          <small>marcador exacto</small>
          <strong>{{ settings.result_points }} pt</strong>
          <small>resultado acertado</small>
        </div>
      </section>

      <nav class="tabs" aria-label="Navegación principal">
        <button :class="{ active: activeTab === 'bets' }" @click="activeTab = 'bets'">Apostar</button>
        <button :class="{ active: activeTab === 'leaderboard' }" @click="activeTab = 'leaderboard'">Tabla</button>
        <button :class="{ active: activeTab === 'matches' }" @click="activeTab = 'matches'">Partidos</button>
        <button :class="{ active: activeTab === 'settings' }" @click="activeTab = 'settings'">Configuración</button>
      </nav>

      <p v-if="toast.message" class="toast" :class="toast.type">{{ toast.message }}</p>
      <p v-if="loading" class="loading">Cargando datos...</p>

      <section v-if="activeTab === 'bets'" class="grid two-columns">
        <article class="panel">
          <h2>Registrar apuesta</h2>
          <label>Partido</label>
          <select v-model.number="selectedMatchId">
            <option v-for="match in openMatches" :key="match.id" :value="match.id">
              {{ match.phase }} · {{ match.home_team }} vs {{ match.away_team }} · {{ formatDate(match.starts_at) }}
            </option>
          </select>

          <div v-if="selectedMatch" class="match-highlight">
            <span :class="['badge', selectedMatch.is_locked ? 'danger' : 'success']">{{ lockText(selectedMatch) }}</span>
            <h3>{{ selectedMatch.home_team }} vs {{ selectedMatch.away_team }}</h3>
            <p>{{ selectedMatch.phase }} · Inicio {{ formatDate(selectedMatch.starts_at) }}</p>
          </div>

          <form @submit.prevent="submitBet" class="form-grid">
            <label>Nombre<input v-model="betForm.participant_name" required placeholder="Tu nombre" /></label>
            <label>Correo<input v-model="betForm.participant_email" type="email" required placeholder="tu@oficina.com" /></label>
            <label>Goles local<input v-model.number="betForm.home_score" type="number" min="0" required /></label>
            <label>Goles visitante<input v-model.number="betForm.away_score" type="number" min="0" required /></label>
            <button class="primary" :disabled="!selectedMatch || selectedMatch.is_locked">Guardar apuesta</button>
          </form>
        </article>

        <article class="panel">
          <h2>Calendario por fases</h2>
          <div v-if="!matches.length" class="empty">Carga partidos desde la sección Partidos para comenzar.</div>
          <div v-for="(items, phase) in groupedMatches" :key="phase" class="phase-block">
            <h3>{{ phase }}</h3>
            <button v-for="match in items" :key="match.id" class="match-row" @click="selectedMatchId = match.id">
              <span>{{ match.home_team }} vs {{ match.away_team }}</span>
              <small>{{ formatDate(match.starts_at) }} · {{ lockText(match) }}</small>
            </button>
          </div>
        </article>
      </section>

      <section v-if="activeTab === 'leaderboard'" class="panel">
        <h2>Tabla de posiciones</h2>
        <div v-if="!leaderboard.length" class="empty">Aún no hay apuestas puntuadas.</div>
        <table v-else>
          <thead><tr><th>#</th><th>Participante</th><th>Apuestas</th><th>Puntos</th></tr></thead>
          <tbody>
            <tr v-for="(row, index) in leaderboard" :key="row.participant_email">
              <td>{{ index + 1 }}</td>
              <td><strong>{{ row.participant_name }}</strong><br /><small>{{ row.participant_email }}</small></td>
              <td>{{ row.bets }}</td>
              <td><span class="points">{{ row.points }}</span></td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="activeTab === 'matches'" class="grid two-columns">
        <article class="panel">
          <h2>Cargar partidos</h2>
          <form @submit.prevent="saveMatch" class="form-grid">
            <label>Fase<select v-model="matchForm.phase"><option v-for="phase in phases" :key="phase">{{ phase }}</option></select></label>
            <label>Equipo local<input v-model="matchForm.home_team" required placeholder="México" /></label>
            <label>Equipo visitante<input v-model="matchForm.away_team" required placeholder="Canadá" /></label>
            <label>Fecha y hora<input v-model="matchForm.starts_at" type="datetime-local" required /></label>
            <button class="primary">{{ matchForm.id ? 'Actualizar partido' : 'Crear partido' }}</button>
          </form>

          <div class="import-box">
            <div class="row-between"><h3>Importación masiva JSON</h3><button @click="sampleImport">Ejemplo</button></div>
            <textarea v-model="importText" placeholder='[{"phase":"Fase de grupos","home_team":"Equipo A","away_team":"Equipo B","starts_at":"2026-06-11T19:00"}]'></textarea>
            <button @click="importMatches">Importar partidos</button>
          </div>
        </article>

        <article class="panel">
          <h2>Resultados y playoffs</h2>
          <div v-for="match in matches" :key="match.id" class="admin-match">
            <div>
              <strong>{{ match.home_team }} vs {{ match.away_team }}</strong>
              <p>{{ match.phase }} · {{ formatDate(match.starts_at) }}</p>
              <button @click="editMatch(match)">Editar</button>
            </div>
            <form @submit.prevent="saveResult(match)" class="result-form">
              <input v-model.number="resultForms[match.id].home_score" type="number" min="0" />
              <span>-</span>
              <input v-model.number="resultForms[match.id].away_score" type="number" min="0" />
              <button>Finalizar</button>
            </form>
          </div>
        </article>
      </section>

      <section v-if="activeTab === 'settings'" class="panel narrow">
        <h2>Configuración</h2>
        <form @submit.prevent="saveSettings" class="form-grid">
          <label>Nombre de la polla<input v-model="settings.pool_name" required /></label>
          <label>Minutos de cierre antes del partido<input v-model.number="settings.lock_minutes_before" type="number" min="0" required /></label>
          <label>Puntos por marcador exacto<input v-model.number="settings.exact_score_points" type="number" min="0" required /></label>
          <label>Puntos por resultado<input v-model.number="settings.result_points" type="number" min="0" required /></label>
          <label>Correo remitente<input v-model="settings.mail_from" type="email" required /></label>
          <label class="check"><input v-model="settings.mail_enabled" type="checkbox" /> Enviar correos reales con mail() de PHP</label>
          <button class="primary">Guardar configuración</button>
        </form>
      </section>
    </main>
  `,
}).mount('#app');
