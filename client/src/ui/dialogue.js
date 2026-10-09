import { portrait } from './portraits.js';
import { speakerName } from '../lib/dialogue.js';
import { audio } from '../audio/audio.js';

let el, face, who, say, timer;
export function initDialogue(root) {
  el = root.querySelector('#dialogue'); face = root.querySelector('#dlg-face'); who = root.querySelector('#dlg-who'); say = root.querySelector('#dlg-say');
}
/** Speech bubble in a corner. Non-modal and purely presentational. */
export function speak(line, ms = 6500) {
  if (!el || !line) return;
  face.innerHTML = portrait(line.speaker); who.textContent = speakerName(line.speaker); say.textContent = line.text;
  el.classList.add('show'); audio.sfx(line.speaker === 'doombot' ? 'servo' : 'talk');
  clearTimeout(timer); timer = setTimeout(() => el.classList.remove('show'), ms);
}
export const hideSpeech = () => { clearTimeout(timer); el?.classList.remove('show'); };
