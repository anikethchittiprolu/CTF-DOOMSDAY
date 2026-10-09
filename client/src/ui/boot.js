import { audio } from '../audio/audio.js';
import { esc } from '../lib/text.js';
import { prefersReducedMotion } from '../lib/prefs.js';
import { N } from '../lib/dialogue.js';

/**
 * Terminal boot. Assigns the applicant number. Skippable at any time; the first click or key
 * also starts audio (browsers only allow sound after a gesture).
 */
export function runBoot(layer, { teamName, teamId, full }) {
  return new Promise((resolve) => {
    const el = document.createElement('div'); el.id = 'boot'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Terminal start-up');
    const num = N.player.applicant_prefix + String(teamId ?? 0).padStart(4, '0');
    const script = full
      ? ['LATVERIAN STATE TERMINAL  v7.1', '', '> verifying applicant ........ ok', `> assigning designation ..... ${num}`, `> house .................... ${teamName ?? 'unregistered'}`,
        '> incursion clock ......... synchronised', '> codex of Doom ........... sealed', '', 'Doom is watching.']
      : ['LATVERIAN STATE TERMINAL  v7.1', `> ${num} reconnected`, '> incursion clock ......... synchronised'];
    el.innerHTML = '<pre aria-live="polite"></pre><button class="btn skip" data-autofocus>Skip</button><div class="sr-only">Press any key to continue.</div>';
    layer.appendChild(el);
    const pre = el.querySelector('pre');
    let done = false, li = 0, ci = 0, timer;
    const finish = () => { if (done) return; done = true; clearTimeout(timer); document.removeEventListener('keydown', onKey, true); el.remove(); resolve(); };
    const onKey = (e) => { audio.init(); if (e.key === 'Tab') return; e.preventDefault(); finish(); };
    document.addEventListener('keydown', onKey, true);
    el.addEventListener('pointerdown', () => { audio.init(); });
    el.querySelector('.skip').addEventListener('click', () => { audio.init(); finish(); });
    const fast = prefersReducedMotion();
    const step = () => {
      if (done) return;
      if (li >= script.length) { pre.innerHTML = esc(script.join('\n')) + '\n\n<span class="dim">[ press any key ]</span> <span class="cursor"></span>'; timer = setTimeout(finish, 3500); return; }
      const line = script[li];
      if (fast) { li++; pre.textContent = script.slice(0, li).join('\n'); timer = setTimeout(step, 30); return; }
      ci++;
      pre.innerHTML = esc(script.slice(0, li).concat(line.slice(0, ci)).join('\n')) + '<span class="cursor"></span>';
      if (ci >= line.length) { li++; ci = 0; timer = setTimeout(step, 140); } else timer = setTimeout(step, 14);
    };
    step();
  });
}
