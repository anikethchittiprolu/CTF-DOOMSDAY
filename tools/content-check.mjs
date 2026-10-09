#!/usr/bin/env node
// Validates content/ against the rules in docs/PLAN.md sections 5.1 and 8.2.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'content');
const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;
const SUPPORTED = new Set(['teams', 'total_solves', 'region_solves', 'top_team', 'first_blood', 'incursion_hours_left']);
const TARGETED = new Set(['region_solves', 'first_blood']);

export function doomVoiceProblems(text, { intimate = false } = {}) {
  const out = [];
  if (/n['’]t\b/i.test(text)) out.push('contraction (n\'t)');
  if (/['’](ll|re|ve|d|m)\b/i.test(text)) out.push('contraction');
  if (/\b(it|that|he|she|there|what|who|here|let|where|how)['’]s\b/i.test(text)) out.push('contraction (is/us)');
  if (/\b(please|sorry|apologi[sz]e|apologies|pardon me|i beg)\b/i.test(text)) out.push('apology or begging');
  if (!intimate && /\bI\b/.test(text)) out.push('first person outside an intimate line');
  if (/\bReed\b/.test(text)) out.push('Doom must say "Richards", never "Reed"');
  return out;
}

function checkTokens(where, text, regionIds, keys) {
  for (const m of text.matchAll(/\{([a-z_]+)(?::([A-Za-z0-9_-]+))?\}/g)) {
    const [, name, arg] = m;
    if (!SUPPORTED.has(name)) fail(where, `unsupported placeholder {${name}}`);
    else if (TARGETED.has(name) && !arg) fail(where, `{${name}} needs an argument`);
    else if (!TARGETED.has(name) && arg) fail(where, `{${name}} takes no argument`);
    else if (name === 'region_solves' && !regionIds.has(arg)) fail(where, `unknown region ${arg}`);
    else if (name === 'first_blood' && !keys.has(arg)) fail(where, `unknown challenge ${arg}`);
  }
  const stripped = text.replace(/\{[^}]*\}/g, '');
  if (/[{}]/.test(stripped)) fail(where, 'stray brace');
}

function looksLikeFlag(text) {
  return /\b(flag|mvsr|doom|ctf|htb|thm)\{[^}]*\}/i.test(text) || /\b[A-Z]{3,10}\{[^}]+\}/.test(text);
}

function main() {
  const regions = read('regions.json').regions;
  const regionIds = new Set(regions.map((r) => r.id));
  read('names.json');
  const keys = new Set(), names = new Set(), challenges = [];
  for (const f of fs.readdirSync(path.join(root, 'challenges'))) {
    const d = read(`challenges/${f}`);
    if (d.bonus) {
      for (const b of d.bonus) { challenges.push({ ...b, region: b.region, bonus: true }); }
      continue;
    }
    if (!regionIds.has(d.region)) fail(f, `unknown region ${d.region}`);
    const reg = regions.find((r) => r.id === d.region);
    if (reg && reg.category !== d.category) fail(f, `category ${d.category} does not match regions.json`);
    for (const c of d.challenges) challenges.push({ ...c, region: d.region });
  }
  for (const c of challenges) {
    if (keys.has(c.key)) fail('challenges', `duplicate key ${c.key}`);
    if (names.has(c.name)) fail('challenges', `duplicate name ${c.name}`);
    keys.add(c.key); names.add(c.name);
    if (!regionIds.has(c.region)) fail(c.key, `unknown region ${c.region}`);
  }
  for (const r of regions) {
    const n = challenges.filter((c) => c.region === r.id && !c.bonus).length;
    if (n === 0) fail(r.id, 'region has no challenges');
    if (n > r.slots) fail(r.id, `${n} challenges exceed ${r.slots} slots`);
    if (!challenges.some((c) => c.region === r.id && c.round === 1)) fail(r.id, 'nothing in round 1');
  }

  // codex
  const codexDir = path.join(root, 'codex');
  const seen = new Set();
  for (const f of fs.readdirSync(codexDir)) {
    const raw = fs.readFileSync(path.join(codexDir, f), 'utf8');
    const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!m) { fail(`codex/${f}`, 'missing frontmatter'); continue; }
    const meta = Object.fromEntries(m[1].split('\n').map((l) => l.split(/:\s*/, 2)));
    const body = m[2];
    if (`${meta.challenge}.md` !== f) fail(`codex/${f}`, 'frontmatter challenge does not match filename');
    if (!keys.has(meta.challenge)) fail(`codex/${f}`, 'no such challenge');
    const n = words(body);
    if (n < 60 || n > 120) fail(`codex/${f}`, `${n} words (need 60 to 120)`);
    if (looksLikeFlag(body)) fail(`codex/${f}`, 'contains a flag-like string');
    seen.add(meta.challenge);
  }
  for (const k of keys) if (!seen.has(k)) fail(`codex/${k}.md`, 'missing');

  // phases
  const phases = read('phases.json');
  for (const [k, n] of Object.entries(phases.assignments)) {
    if (!keys.has(k)) fail('phases.json', `unknown challenge ${k}`);
    if (n < 1 || n > phases.rounds) fail('phases.json', `${k} in round ${n}`);
  }

  // dialogue (all of it; Doom lines get the voice rules)
  const dialogue = [];
  for (const f of fs.readdirSync(path.join(root, 'dialogue'))) dialogue.push(...read(`dialogue/${f}`).dialogue);
  const ids = new Set();
  for (const d of dialogue) {
    if (ids.has(d.id)) fail(`dialogue ${d.id}`, 'duplicate id');
    ids.add(d.id);
    checkTokens(`dialogue ${d.id}`, d.text, regionIds, keys);
    if (looksLikeFlag(d.text)) fail(`dialogue ${d.id}`, 'flag-like string');
    if (d.speaker === 'doom') for (const p of doomVoiceProblems(d.text, { intimate: !!d.intimate })) fail(`dialogue ${d.id}`, p);
  }
  for (const r of regions) if (!ids.has(r.entry)) fail(r.id, `missing entry line ${r.entry}`);
  const doomLines = dialogue.filter((d) => d.speaker === 'doom').length;
  const borisLines = dialogue.filter((d) => d.speaker === 'boris').length;
  if (dialogue.length < 70) fail('dialogue', `only ${dialogue.length} lines`);

  // broadcasts
  const b = read('broadcasts.json');
  const hours = b.broadcasts.map((x) => x.hour).join(',');
  if (hours !== '0,3,6,9,12,15,18,21,24') fail('broadcasts.json', `hours are ${hours}`);
  for (const x of b.broadcasts) {
    for (const v of ['low', 'mid', 'high']) {
      const t = x.variants[v];
      if (!t) { fail(`broadcast ${x.key}`, `missing ${v} variant`); continue; }
      const n = words(t.replace(/\{[^}]*\}/g, 'x'));
      if (n < 40 || n > 90) fail(`broadcast ${x.key}/${v}`, `${n} words (need 40 to 90)`);
      checkTokens(`broadcast ${x.key}/${v}`, t, regionIds, keys);
      for (const p of doomVoiceProblems(t)) fail(`broadcast ${x.key}/${v}`, p);
    }
    const sn = words(x.subtitle.replace(/\{[^}]*\}/g, 'x'));
    if (sn < 20 || sn > 40) fail(`broadcast ${x.key} subtitle`, `${sn} words (need 20 to 40)`);
    checkTokens(`broadcast ${x.key} subtitle`, x.subtitle, regionIds, keys);
    for (const p of doomVoiceProblems(x.subtitle)) fail(`broadcast ${x.key} subtitle`, p);
  }

  // messages
  const mids = new Set();
  for (const m of read('messages.json').messages) {
    if (mids.has(m.id)) fail(`message ${m.id}`, 'duplicate id'); mids.add(m.id);
    const n = words(m.text);
    if (n < 15 || n > 80) fail(`message ${m.id}`, `${n} words`);
    if (m.requires_challenge && !keys.has(m.requires_challenge)) fail(`message ${m.id}`, 'unknown requires_challenge');
    if (m.trigger.type === 'challenge' && !keys.has(m.trigger.challenge)) fail(`message ${m.id}`, 'unknown trigger challenge');
    if (looksLikeFlag(m.text)) fail(`message ${m.id}`, 'flag-like string');
    if (m.from === 'doom') for (const p of doomVoiceProblems(m.text)) fail(`message ${m.id}`, p);
  }

  // anywhere else in content: nothing flag shaped
  for (const f of ['regions.json', 'names.json']) if (looksLikeFlag(fs.readFileSync(path.join(root, f), 'utf8'))) fail(f, 'flag-like string');

  if (errors.length) {
    console.error(`content-check: ${errors.length} problem(s)`);
    for (const e of errors) console.error('  - ' + e);
    process.exit(1);
  }
  console.log(`content-check ok: ${regions.length} regions, ${challenges.length} challenges, ${seen.size} codex entries, ` +
    `${dialogue.length} dialogue lines (${doomLines} Doom, ${borisLines} Boris), ${b.broadcasts.length} broadcasts`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
