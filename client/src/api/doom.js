import { request } from '../net.js';

const get = async (p) => {
  const r = await request(p);
  if (!r.ok) throw new Error(p + ' ' + r.status);
  return r.json;
};

export const state = () => get('/api/doom/v1/state');
export const broadcasts = async () => (await get('/api/doom/v1/broadcasts')).data;
export const codex = async () => (await get('/api/doom/v1/codex')).data;
export const messages = async () => (await get('/api/doom/v1/messages')).data;
export const stats = async () => (await get('/api/doom/v1/stats')).data;
export const readMessage = (id) => request(`/api/doom/v1/messages/${encodeURIComponent(id)}/read`, { method: 'POST', body: {} });
