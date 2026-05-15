const form = document.querySelector('#match-search-form');
const matchesContainer = document.querySelector('#matches');
const statusMessage = document.querySelector('#status-message');
const resultCount = document.querySelector('#result-count');

initializeDefaultDates();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setLoadingState();

  const formData = new FormData(form);
  const query = new URLSearchParams({
    dateFrom: formData.get('dateFrom'),
    dateTo: formData.get('dateTo'),
  });

  const competitions = formData.get('competitions')?.trim();
  if (competitions) query.set('competitions', competitions);

  const headers = {};
  const apiToken = formData.get('apiToken')?.trim();
  if (apiToken) headers['x-football-data-token'] = apiToken;

  try {
    const response = await fetch(`/api/matches?${query.toString()}`, { headers });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.help || payload.error || 'No se pudo completar la búsqueda.');
    }

    renderMatches(payload.matches);
    resultCount.textContent = `${payload.count} partido${payload.count === 1 ? '' : 's'}`;
    statusMessage.textContent = payload.count
      ? `Mostrando partidos programados desde ${formatDateInput(formData.get('dateFrom'))} hasta ${formatDateInput(formData.get('dateTo'))}.`
      : 'No encontramos partidos programados para esos filtros.';
  } catch (error) {
    matchesContainer.innerHTML = '';
    resultCount.textContent = 'Error';
    statusMessage.textContent = error.message;
  }
});

function initializeDefaultDates() {
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  form.elements.dateFrom.value = toDateInputValue(today);
  form.elements.dateTo.value = toDateInputValue(nextWeek);
}

function setLoadingState() {
  resultCount.textContent = 'Buscando…';
  statusMessage.textContent = 'Consultando partidos programados…';
  matchesContainer.innerHTML = '';
}

function renderMatches(matches) {
  matchesContainer.innerHTML = matches
    .map((match) => {
      const kickoff = new Date(match.utcDate);
      return `
        <article class="match-card">
          <div>
            <p class="competition">${escapeHtml(match.competition)} ${match.competitionCode ? `· ${escapeHtml(match.competitionCode)}` : ''}</p>
            <h3>${escapeHtml(match.homeTeam)} <span>vs</span> ${escapeHtml(match.awayTeam)}</h3>
          </div>
          <dl>
            <div><dt>Fecha</dt><dd>${kickoff.toLocaleDateString('es', { dateStyle: 'medium' })}</dd></div>
            <div><dt>Hora</dt><dd>${kickoff.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</dd></div>
            <div><dt>Estado</dt><dd>${escapeHtml(match.status)}</dd></div>
          </dl>
        </article>
      `;
    })
    .join('');
}

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function formatDateInput(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('es', { dateStyle: 'medium' });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
