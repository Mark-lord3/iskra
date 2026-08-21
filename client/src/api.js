// All calls go through the Vite dev proxy in development and hit the same
// origin in production, so no API base URL needs to be configured.
const BASE = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  const res = await fetch(BASE + '/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  events:      ()               => request('/events'),
  banners:     ()               => request('/admin/banners'),
  signup:      (body)           => request('/players',  { method:'POST', body }),
  playerStatus:(id)             => request(`/players/${id}`),
  leaderboard: (playerId)       => request('/leaderboard?limit=10' + (playerId ? `&playerId=${playerId}` : '')),
  submitScore: (body)           => request('/scores',   { method:'POST', body }),
  validateCode:(code)           => request('/promo/validate', { method:'POST', body:{ code } }),
  subscribe:   (email, path = location.pathname) => request('/subscribe',{ method:'POST', body:{ email, path } }),
  order:       (body)           => request('/orders',   { method:'POST', body }),
  contact:     (body)           => request('/contact',  { method:'POST', body }),
  track:       (body)           => request('/analytics',{ method:'POST', body }),
  adminSummary:(key)            => request('/admin/summary', { headers:{ 'Content-Type':'application/json', 'x-admin-key':key } }),
  adminEvent:  (key, body)      => request('/admin/events', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-admin-key':key }, body }),
  adminDeleteEvent:(key, slug)  => fetch(BASE + '/api/admin/events/' + encodeURIComponent(slug), {
    method:'DELETE',
    headers:{ 'x-admin-key':key }
  }).then(async res => {
    const data = await res.json().catch(() => ({}));
    if(!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }),
  adminBanner: (key, body)      => request('/admin/banners', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-admin-key':key }, body }),
  adminMessage:(key, id, status='read') => request(`/admin/messages/${id}`, { method:'PATCH', headers:{ 'Content-Type':'application/json', 'x-admin-key':key }, body:{status} })
};

const PKEY = 'iskra_player_v2';
export const savedPlayer  = () => { try { return JSON.parse(localStorage.getItem(PKEY)); } catch { return null; } };
export const savePlayer   = (p) => { try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch {} };
export const clearPlayer  = () => { try { localStorage.removeItem(PKEY); } catch {} };
