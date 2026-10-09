// Dialogue content ships with the client (it carries no answers). Challenge names and
// codex text never do: those only ever arrive from the server, once released or unlocked.
import names from '../../../content/names.json';
import regionsJson from '../../../content/regions.json';

const files = import.meta.glob('../../../content/dialogue/*.json', { eager: true, import: 'default' });
export const lines = Object.values(files).flatMap((f) => f.dialogue);
export const regions = regionsJson.regions;
export const regionById = Object.fromEntries(regions.map((r) => [r.id, r]));
export const regionByCategory = Object.fromEntries(regions.map((r) => [r.category, r]));
export const N = names;

export const PRESENTER = { doomstadt: 'doombot', embassy: 'doombot', foundry: 'doombot', archives: 'boris', haasenstadt: 'shuri',
  monastery: 'strange', wundagore: 'strange', baxter: 'reed', timeplatform: 'strange', citadel: 'loki' };

export const speakerName = (id) => ({ doom: N.characters.doom_short, boris: N.characters.boris, doombot: N.characters.doombot, shuri: N.characters.shuri,
  reed: N.characters.reed, strange: N.characters.strange, banner: N.characters.banner, loki: N.characters.loki, tva: N.characters.tva }[id] || id);

const lastByTrigger = {};
/** Pick a random line for a trigger, avoiding an immediate repeat. */
export function pick(trigger, where = {}) {
  const pool = lines.filter((l) => l.trigger === trigger && Object.entries(where).every(([k, v]) => l[k] === undefined || l[k] === v));
  if (!pool.length) return null;
  let l = pool[Math.floor(Math.random() * pool.length)];
  if (pool.length > 1 && l.id === lastByTrigger[trigger]) l = pool[(pool.indexOf(l) + 1) % pool.length];
  lastByTrigger[trigger] = l.id;
  return l;
}
export const byId = (id) => lines.find((l) => l.id === id) || null;
