import { store, regionStatus, challengesIn, markRegionSeen } from '../data.js';
import { regions, regionById, PRESENTER, pick } from '../lib/dialogue.js';
import { esc } from '../lib/text.js';
import { tierOf } from '../data.js';
import { tierBadge } from '../lib/tiers.js';
import { speak } from './dialogue.js';

/** Lite mode: no canvas and no illustration. Same challenges, dialogue and codex. */
export function renderLite(stage, { openChallenge, onEnter }) {
  const wrap = document.createElement('div'); wrap.className = 'lite'; wrap.dataset.screen = 'lite';
  stage.replaceChildren(wrap);
  const draw = () => {
    const { state } = store.get();
    const focusId = document.activeElement?.dataset?.id;
    wrap.innerHTML = `<h1>Latveria &middot; ${state?.configured ? `Round ${state.phase} of ${state.rounds_total}` : 'Waiting for the trial'}</h1>
      <div class="regions">${regions.map((r) => {
    const s = regionStatus(r.id), list = challengesIn(r.id);
    return `<section class="region" aria-labelledby="lr-${r.id}"><h2 id="lr-${r.id}">${esc(r.name)}</h2>
        <div class="dim" style="font-size:.78em">${esc(r.category)} &middot; ${s.released}/${s.total} open &middot; ${s.solved} solved</div>
        <ul>${list.map((c) => { const t = tierOf(c); return `<li><button class="ch ${c.solved_by_me ? 'solved' : ''}" data-id="${c.id}" aria-label="${esc(c.name)}, ${esc(t.label)}, ${c.value} points${c.solved_by_me ? ', solved' : ''}">${tierBadge(t, 14)}<span style="flex:1">${esc(c.name)}</span><span class="dim">${c.value}${c.solved_by_me ? ' ✓' : ''}</span></button></li>`; }).join('')}
        ${s.total > s.released ? `<li class="dim" style="font-size:.78em">${s.total - s.released} sealed</li>` : ''}</ul></section>`;
  }).join('')}</div>`;
    if (focusId) wrap.querySelector(`[data-id="${focusId}"]`)?.focus();
  };
  wrap.addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) openChallenge(Number(b.dataset.id)); });
  draw();
  const unsub = store.subscribe(draw);
  onEnter?.();
  speak(pick('region_enter', { region: 'doomstadt' }), 5000);
  return { dispose() { unsub(); wrap.remove(); }, refresh: draw };
}
