import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderStatusBadge } from '../../frontend/statusBadge.js';

describe('renderStatusBadge', () => {
  it('renders an active badge with accessible state', () => {
    assert.equal(
      renderStatusBadge({ label: 'Mercado', active: true }),
      '<span class="status-badge status-badge--active" aria-label="Mercado: active">Mercado</span>',
    );
  });

  it('renders an inactive badge with accessible state', () => {
    assert.match(
      renderStatusBadge({ label: 'Mercado', active: false }),
      /status-badge--inactive.*Mercado: inactive/,
    );
  });
});
