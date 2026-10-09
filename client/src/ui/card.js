import { getChallenge, attempt as submitAttempt, getHint, unlockHint } from '../api/ctfd.js';
import { NetError } from '../net.js';
import { store, noteAttempts, afterSolve, regionOf, tierOf, refreshChallenges, refreshTeam } from '../data.js';
import { openPanel, currentPanel } from './panel.js';
import { esc, renderText } from '../lib/text.js';
import { tierBadge } from '../lib/tiers.js';
import { portrait } from './portraits.js';
import { pick, speakerName, PRESENTER, regionById } from '../lib/dialogue.js';
import { audio } from '../audio/audio.js';
import { toast } from './toast.js';
import { emit } from '../lib/bus.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function openChallenge(id) {
  const summary = store.get().challenges.find((c) => c.id === id);
  const p = openPanel({ title: esc(summary?.name ?? 'Challenge'), cls: 'card', html: '<p class="dim">Doombot is fetching the task&hellip;</p>' });
  let res;
  try { res = await getChallenge(id); } catch {
    p.body.innerHTML = '<p class="result bad">Could not reach the server. Check your connection.</p><button class="btn" data-retry data-autofocus>Retry</button>';
    p.body.querySelector('[data-retry]').addEventListener('click', () => openChallenge(id));
    return;
  }
  if (currentPanel() !== p) return;
  if (res.locked) {
    p.body.innerHTML = `<div class="npc"><div class="face">${portrait('doombot')}</div><div><div class="who">Doombot</div>ACCESS DENIED. This task is sealed${res.until != null ? ` until the Incursion clock reads ${Math.floor(res.until)} hour${Math.floor(res.until) === 1 ? '' : 's'}` : ''}.</div></div>`;
    return;
  }
  render(p, res.challenge, summary);
}

function render(p, ch, summary) {
  const tier = tierOf({ value: ch.value });
  const region = regionById[regionOf({ category: ch.category })] ?? null;
  const presenter = PRESENTER[region?.id] ?? 'doombot';
  const max = Number(ch.max_attempts) || 0;
  let used = ch.attempts ?? store.get().attempts[ch.id] ?? 0;
  let solved = !!ch.solved_by_me || !!summary?.solved_by_me;
  let pending = false;
  noteAttempts(ch.id, used);

  const hintsHtml = (ch.hints ?? []).map((h, i) => `<div class="hint" data-hint="${h.id}"><div>Hint ${i + 1} <span class="cost">${h.cost ? `&minus;${h.cost} pts` : 'free'}</span></div><div class="hint-body"><button class="btn small" data-buy="${h.id}">Ask Boris</button></div></div>`).join('');
  const open = pick('challenge_open');
  p.body.innerHTML = `<div class="card-grid">
    <div>
      <div class="npc"><div class="face">${portrait(presenter)}</div><div><div class="who">${esc(speakerName(open?.speaker ?? presenter))}</div><div id="npc-line">${esc(open?.text ?? '')}</div></div></div>
      <div class="meta"><span>${tierBadge(tier)} ${esc(tier.label)}</span><span>${esc(ch.value)} pts</span><span>${esc(ch.category)}</span>${ch.solves != null ? `<span>${esc(ch.solves)} solves</span>` : ''}</div>
      <div class="desc">${renderText(ch.description ?? '')}</div>
      ${ch.connection_info ? `<div class="conn"><code>${esc(ch.connection_info)}</code><button class="btn small" data-copy>Copy</button></div>` : ''}
      ${ch.files?.length ? `<div class="files">${ch.files.map((f) => `<a href="${esc(f)}" download>${esc(decodeURIComponent(f.split('?')[0].split('/').pop()))}</a>`).join('')}</div>` : ''}
    </div>
    <div>
      <div class="sentry" id="sentry"></div>
      <form id="flagform" autocomplete="off"><div class="flagrow"><input id="flag" name="flag" placeholder="MVSR{...}" aria-label="Flag" spellcheck="false" autocapitalize="off" data-autofocus><button class="btn primary" id="submit" type="submit">Submit</button></div></form>
      <div class="result" id="result" role="status" aria-live="polite"></div>
      <div id="lockdown"></div>
      <h3 class="dim" style="font-size:.78em;letter-spacing:.14em;text-transform:uppercase;margin:16px 0 6px">Boris &middot; hints</h3>
      ${hintsHtml || '<p class="dim" style="font-size:.85em">No hints for this task.</p>'}
    </div></div>`;
  const $ = (s) => p.body.querySelector(s);
  const result = (msg, kind = '') => { const r = $('#result'); r.className = 'result ' + kind; r.textContent = msg; };

  const drawSentry = () => {
    const el = $('#sentry');
    if (!max) { el.innerHTML = 'Sentry: unlimited attempts'; return; }
    const left = Math.max(0, max - used);
    el.innerHTML = `<span>Sentry</span>${Array.from({ length: max }, (_, i) => `<i class="pip ${i < left ? '' : 'spent'}"></i>`).join('')}<span>${left} of ${max}</span>`;
    el.setAttribute('aria-label', `${left} of ${max} attempts left`);
  };
  const lockdown = () => {
    $('#flag').disabled = true; $('#submit').disabled = true;
    const line = pick('lockout');
    $('#lockdown').innerHTML = `<div class="lockdown"><b>SENTRY LOCKDOWN.</b> ${esc(line?.text ?? 'Attempts exhausted.')}<br>You can still read the task and ask Boris. An organiser can restore your attempts.</div>`;
    audio.sfx('lockdown'); p.panel.classList.add('shake');
    setTimeout(() => p.panel.classList.remove('shake'), 500);
  };
  const markSolved = () => { solved = true; $('#flag').disabled = true; $('#submit').disabled = true; };
  drawSentry();
  if (solved) { markSolved(); result('Solved. Doom has recorded it.', 'good'); } else if (max && used >= max) lockdown();

  // hints: look up which ones this team already holds
  (ch.hints ?? []).forEach((h) => getHint(h.id).then((d) => { if (d?.content) showHint(h.id, d.content); }).catch(() => {}));
  function showHint(id, content) { const b = p.body.querySelector(`[data-hint="${id}"] .hint-body`); if (b) b.innerHTML = `<div>${renderText(content)}</div>`; }
  p.body.addEventListener('click', async (e) => {
    const buy = e.target.closest('[data-buy]');
    if (buy) {
      const id = Number(buy.dataset.buy); buy.disabled = true; buy.textContent = 'Boris is thinking…';
      const line = pick('hint_open'); if (line) $('#npc-line').textContent = line.text;
      try {
        const r = await unlockHint(id);
        if (!r.ok) { buy.disabled = false; buy.textContent = 'Ask Boris'; result(r.message, 'bad'); return; }
        const d = await getHint(id); showHint(id, d?.content ?? ''); audio.sfx('talk');
        const bought = pick('hint_bought'); if (bought) $('#npc-line').textContent = bought.text;
        refreshTeam();
      } catch { buy.disabled = false; buy.textContent = 'Ask Boris'; result('No connection. Boris could not be reached. Nothing was charged.', 'wait'); }
    }
    if (e.target.closest('[data-copy]')) { try { await navigator.clipboard.writeText(ch.connection_info); toast('Copied.', { ms: 1500 }); } catch { /* not allowed */ } }
  });

  // flag submission: one at a time, never double-submits, safe to retry after a lost connection
  $('#flagform').addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = $('#flag').value.trim();
    if (pending || solved || !value) return;
    pending = true; $('#submit').disabled = true; $('#flag').readOnly = true; result('Doombot is verifying…', 'wait');
    try {
      let r;
      try { r = await submitAttempt(ch.id, value); } catch (err) {
        if (!(err instanceof NetError)) throw err;
        r = await recover(ch.id, value, used, (m) => result(m, 'wait'));
      }
      await handle(r, value);
    } catch (err) {
      result('Something went wrong talking to the server. Your answer is still in the box. Try again.', 'bad');
    } finally {
      pending = false; $('#flag').readOnly = false; if (!solved && !(max && used >= max)) { $('#submit').disabled = false; $('#flag').focus(); }
    }
  });

  async function handle(r, value) {
    switch (r.status) {
      case 'correct': {
        markSolved(); used += 1; drawSentry(); noteAttempts(ch.id, used);
        result('Correct. ' + (pick('correct_flag')?.text ?? ''), 'good'); audio.sfx('correct'); p.panel.classList.add('celebrate');
        const before = store.get().codex.unlocked.length;
        await afterSolve();
        if (store.get().codex.unlocked.length > before) toast('<b>Codex entry unlocked.</b> Press C to read it.', { kind: 'gem', sound: 'badge' });
        emit('solved', { id: ch.id });
        break;
      }
      case 'incorrect': case 'partial': {
        used = Math.min(max || used + 1, used + 1); noteAttempts(ch.id, used); drawSentry();
        const left = parseTries(r.message);
        if (left !== null && max) { used = max - left; drawSentry(); }
        const l = pick('wrong_flag');
        result(l?.text ?? 'Incorrect.', 'bad'); audio.sfx('wrong'); $('#flag').select();
        p.panel.classList.add('shake'); setTimeout(() => p.panel.classList.remove('shake'), 500);
        if (max && used >= max) lockdown();
        break;
      }
      case 'already_solved': markSolved(); result('You already solved this one.', 'good'); refreshChallenges().catch(() => {}); break;
      case 'ratelimited': result(r.message || 'Too many submissions. The Doombot needs a moment.', 'wait'); $('#submit').disabled = true; await sleep(4000); break;
      case 'locked': result(r.message, 'bad'); break;
      default: result(r.message || 'The server declined that submission.', 'bad');
    }
  }
}

/** The request got no answer. Find out whether it arrived before deciding to send it again. */
async function recover(id, value, usedBefore, say) {
  say('No answer from the server. Checking whether your submission arrived…');
  let check = null;
  for (let i = 0; i < 3 && !check; i++) { try { check = await getChallenge(id); } catch { await sleep(1200 * (i + 1)); } }
  if (!check) throw new NetError('still offline', 'network');
  const ch = check.challenge;
  if (ch?.solved_by_me) return { status: 'correct', message: '' };
  if (ch && ch.attempts != null && ch.attempts > usedBefore) return { status: 'incorrect', message: '' };
  if (ch && ch.attempts == null) throw new NetError('cannot tell whether it arrived', 'unknown');
  say('It did not arrive. Sending it again…');
  return submitAttempt(id, value);
}
const parseTries = (msg) => { const m = /(\d+)\s+tries?\s+remaining/i.exec(msg || ''); return m ? Number(m[1]) : null; };
