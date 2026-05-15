export function renderStatusBadge({ label, active }) {
  const state = active ? 'active' : 'inactive';

  return `<span class="status-badge status-badge--${state}" aria-label="${label}: ${state}">${label}</span>`;
}
