const init = (typeof window !== 'undefined' && window.init) || null;
const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');

export const config = {
  init,
  mock: !init || params.has('mock'),
  root: init?.urlRoot ?? '',
  nonce: init?.csrfNonce ?? '',
  userName: init?.userName ?? 'applicant',
  teamsMode: (init?.userMode ?? 'teams') === 'teams',
  settings: init?.theme_settings ?? {},
  params,
  // Poll intervals. /state every 30 s with backoff and jitter; no WebSocket.
  statePollMs: Number(params.get('poll')) || 30_000,
  statsPollMs: 60_000,
  releaseJitterMs: Number(params.get('jitter') ?? 20_000),
  requestTimeoutMs: 12_000,
};
