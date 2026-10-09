import { request } from '../net.js';
import { config } from '../config.js';

const data = (r) => r.json?.data;

export async function listChallenges() {
  const r = await request('/api/v1/challenges');
  if (!r.ok) throw new Error('challenges ' + r.status);
  return data(r) ?? [];
}

/** Returns { challenge } or { locked: true, until } when the server says it is not open. */
export async function getChallenge(id) {
  const r = await request(`/api/v1/challenges/${id}`);
  if (r.status === 403) return { locked: true, until: r.json?.locked_until ?? null };
  if (!r.ok) throw new Error('challenge ' + r.status);
  return { challenge: data(r) };
}

/**
 * Submit a flag. Never retried automatically here: the caller decides, after checking
 * whether the first attempt reached the server. Returns { status, message }.
 */
export async function attempt(challengeId, submission) {
  const r = await request('/api/v1/challenges/attempt', { method: 'POST', body: { challenge_id: challengeId, submission } });
  if (r.status === 429) return { status: 'ratelimited', message: r.json?.data?.message || 'Too many submissions. Wait a moment.' };
  if (r.status === 403 && r.json?.locked_until !== undefined) return { status: 'locked', message: 'This challenge is not open yet.' };
  const d = r.json?.data;
  if (!d) throw new Error('attempt ' + r.status);
  return { status: d.status, message: d.message || '' };
}

export async function getHint(id) {
  const r = await request(`/api/v1/hints/${id}`);
  if (!r.ok) throw new Error('hint ' + r.status);
  return data(r);
}

export async function unlockHint(id) {
  const r = await request('/api/v1/unlocks', { method: 'POST', body: { target: id, type: 'hints' } });
  if (!r.ok) {
    const errs = r.json?.errors;
    return { ok: false, message: (errs && Object.values(errs)[0]) || 'Boris cannot help you with that right now.' };
  }
  return { ok: true };
}

export async function me() {
  const r = await request(config.teamsMode ? '/api/v1/teams/me' : '/api/v1/users/me');
  if (!r.ok) return null;
  return data(r);
}
