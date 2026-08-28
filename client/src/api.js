// All calls go through the Vite dev proxy in development and hit the same
// origin in production, so no API base URL needs to be configured.
const BASE = import.meta.env.VITE_API_URL || '';
const inFlightGets = new Map();

export class ApiError extends Error {
  constructor(message,{status=0,code='NETWORK_ERROR',requestId=null,retryAfter=0,field=null,outcome=null,ticket=null}={}){
    super(message);
    this.name='ApiError';
    this.status=status;
    this.code=code;
    this.requestId=requestId;
    this.retryAfter=retryAfter;
    this.field=field;   // which form input the error belongs to, when the API says
    // The door API answers with a meaningful outcome on 4xx (already_used,
    // cancelled, expired...). Those must survive the throw, not collapse into
    // a generic failure.
    this.outcome=outcome;
    this.ticket=ticket;
  }
}

async function performRequest(path,options){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),Number(options.timeoutMs)||15000);
  const {timeoutMs:_,...fetchOptions}=options;
  try{
    const res=await fetch(BASE+'/api'+path,{
      ...fetchOptions,
      credentials:'include',
      headers:{'Content-Type':'application/json',...options.headers},
      credentials:'include',   // carries the httpOnly admin session cookie
      signal:options.signal || controller.signal,
      body:options.body ? JSON.stringify(options.body) : undefined
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok){
      const retryAfter=Number(data.retryAfter || res.headers.get('retry-after')) || 0;
      const message=data.error || (res.status === 429
        ? `Too many requests. Try again${retryAfter ? ` in ${retryAfter} seconds` : ' shortly'}.`
        : `Request failed (${res.status}).`);
      throw new ApiError(message,{
        status:res.status,code:data.code || 'REQUEST_FAILED',
        requestId:data.requestId || res.headers.get('x-request-id'),retryAfter,field:data.field || null,
        outcome:data.outcome || null, ticket:data.ticket || null
      });
    }
    return data;
  }catch(error){
    if(error instanceof ApiError) throw error;
    if(error.name === 'AbortError') throw new ApiError('The server took too long to respond. Please try again.',{code:'TIMEOUT'});
    throw new ApiError('Could not reach the server. Check your connection and try again.',{code:'NETWORK_ERROR'});
  }finally{ clearTimeout(timeout); }
}

function request(path,options={}){
  const method=options.method || 'GET';
  if(method !== 'GET') return performRequest(path,options);
  if(inFlightGets.has(path)) return inFlightGets.get(path);
  const pending=performRequest(path,options).finally(()=>inFlightGets.delete(path));
  inFlightGets.set(path,pending);
  return pending;
}

export const api = {
  events:      ()               => request('/events'),
  banners:     ()               => request('/admin/banners'),
  signup:      (body)           => request('/players',  { method:'POST', body }),
  playerStatus:(id,token)       => request(`/players/${id}`,{headers:{'x-player-token':token}}),
  leaderboard: (playerId, limit = 10) =>
    request(`/leaderboard?limit=${limit}` + (playerId ? `&playerId=${playerId}` : '')),
  checkName:   (handle)          => request('/players/check-name', { method:'POST', body:{ handle } }),
  /* Public marketing campaigns only. Player reward codes are never listed. */
  promoPublic: ()                => request('/promo/public'),
  campaignConsent:(choice)      => request('/campaigns/consent',{method:'POST',body:{choice}}),
  campaignNext:(locale,consent) => request(`/campaigns/next?locale=${locale}&consent=${consent}`),
  campaignRecord:(id,action,path=location.pathname) => request(`/campaigns/${id}/${action}`,{method:'POST',body:{path}}),
  accountRegister:(body)        => request('/account/register',{method:'POST',body}),
  accountLogin:(body)           => request('/account/login',{method:'POST',body}),
  accountMe:()                  => request('/account/me'),
  accountLogout:(csrfToken)     => request('/account/logout',{method:'POST',headers:{'x-csrf-token':csrfToken}}),
  accountVerify:(token)         => request('/account/verify',{method:'POST',body:{token}}),
  accountForgot:(email)         => request('/account/forgot-password',{method:'POST',body:{email}}),
  accountReset:(token,password) => request('/account/reset-password',{method:'POST',body:{token,password}}),
  accountOverview:()            => request('/account/overview'),
  accountClaimTickets:(csrfToken,tickets) => request('/account/claim-tickets',{method:'POST',headers:{'x-csrf-token':csrfToken},body:{tickets}}),
  accountProfile:(csrfToken,body) => request('/account/profile',{method:'PATCH',headers:{'x-csrf-token':csrfToken},body}),
  accountPreferences:(csrfToken,body) => request('/account/preferences',{method:'PATCH',headers:{'x-csrf-token':csrfToken},body}),
  accountSaveEvent:(csrfToken,slug) => request(`/account/saved-events/${encodeURIComponent(slug)}`,{method:'POST',headers:{'x-csrf-token':csrfToken}}),
  membershipCheckout:(csrfToken) => request('/account/membership/checkout',{method:'POST',headers:{'x-csrf-token':csrfToken}}),
  membershipPortal:(csrfToken) => request('/account/membership/portal',{method:'POST',headers:{'x-csrf-token':csrfToken}}),
  accountDelete:(csrfToken,password) => request('/account',{method:'DELETE',headers:{'x-csrf-token':csrfToken},body:{password}}),
  accountArcade:(csrfToken)          => request('/players/account',{method:'POST',headers:{'x-csrf-token':csrfToken}}),

  /* Administrator sign-in. The session is an httpOnly cookie, so no token is
     ever readable from JavaScript or stored in the browser. */
  login:    (email, password) => request('/auth/login', { method:'POST', body:{ email, password } }),
  logout:   ()                => request('/auth/logout', { method:'POST' }),
  authMe:   ()                => request('/auth/me'),
  changePassword: (currentPassword, password) =>
    request('/auth/password', { method:'POST', body:{ currentPassword, password } }),

  /* Door scanner. These use a scanner session token and can only verify and
     redeem: no admin surface is reachable with it. */
  staffSession: (invite)         => request('/staff/session', { method:'POST', body:{ invite } }),
  staffPasscode:(passcode,label) => request('/staff/passcode',{ method:'POST', body:{ passcode, label } }),
  staffMe:      (token)          => request('/staff/me',      { headers:{ 'x-scanner-token': token } }),
  staffVerify:  (token, code)    => request('/staff/verify',  { method:'POST', headers:{ 'x-scanner-token': token }, body:{ code } }),
  staffRedeem:  (token, code)    => request('/staff/redeem',  { method:'POST', headers:{ 'x-scanner-token': token }, body:{ code } }),
  adminScannerLink:     (body)  => request('/admin/scanner/link',     { method:'POST', body }),
  adminScannerSessions: ()        => request('/admin/scanner/sessions', { headers:{} }),
  adminScannerLog:      (page=1,limit=10) => request(`/admin/scanner/log?page=${page}&limit=${limit}`, { headers:{} }),
  adminScannerRevoke:   (id)    => request(`/admin/scanner/sessions/${id}/revoke`, { method:'POST' }),
  submitScore: (body)           => request('/scores',   { method:'POST', body }),
  validateCode:(code,qty,eventSlug,tierKey) => request('/promo/validate', { method:'POST', body:{code,qty,eventSlug,tierKey} }),
  subscribe:   (email, path = location.pathname) => request('/subscribe',{ method:'POST', body:{ email, path } }),
  /* Authoritative pricing. The offers calculator computes locally for instant
     feedback and then confirms the figure here before showing it as final. */
  ticketQuote:(body)            => request('/tickets/quote', { method:'POST', body }),
  customOrderPreview:(body)     => request('/tickets/custom-order/preview', {method:'POST',body}),
  vipAvailability:(eventSlug)   => request('/tickets/vip-availability?eventSlug=' + encodeURIComponent(eventSlug)),
  checkoutTickets:(body)        => request('/tickets/checkout', { method:'POST', body }),
  completeCheckout:(sessionId)  => request('/tickets/checkout/complete?sessionId=' + encodeURIComponent(sessionId)),
  ticketWallet:(tickets)        => request('/tickets/wallet', { method:'POST', body:{tickets} }),
  gallery:     ()               => request('/gallery'),
  siteStatus:  ()               => request('/site-status'),
  feedback:    (body)           => request('/feedback', {method:'POST',body}),
  contact:     (body)           => request('/contact',  { method:'POST', body }),
  track:       (body)           => request('/analytics',{ method:'POST', body }),
  adminSummary:()            => request('/admin/summary', { headers:{ 'Content-Type':'application/json' } }),
  adminOrders:(page=1,limit=10) => request(`/admin/orders?page=${page}&limit=${limit}`, { headers:{} }),
  adminResendOrderTickets:(id) => request(`/admin/orders/${encodeURIComponent(id)}/resend-tickets`, {method:'POST',timeoutMs:30000}),
  adminResendTicketOrders:(orderIds) => request('/admin/orders/resend-tickets', {method:'POST',body:{scope:'selected',orderIds},timeoutMs:120000}),
  adminResendAllTicketOrders:() => request('/admin/orders/resend-tickets', {method:'POST',body:{scope:'all'},timeoutMs:120000}),
  adminEvent:  (body)      => request('/admin/events', { method:'POST', headers:{ 'Content-Type':'application/json' }, body }),
  adminDeleteEvent:(slug)  => request('/admin/events/' + encodeURIComponent(slug), {method:'DELETE'}),
  adminBanner: (body)      => request('/admin/banners', { method:'POST', headers:{ 'Content-Type':'application/json' }, body }),
  adminMessage:(id, status='read') => request(`/admin/messages/${id}`, { method:'PATCH', headers:{ 'Content-Type':'application/json' }, body:{status} }),
  adminMessageReply:(id, body, subject) => request(`/admin/messages/${id}/reply`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body:{ body, subject } }),
  adminVerifyTicket:(code) => request('/admin/tickets/verify', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:{code} }),
  adminRedeemTicket:(id)   => request(`/admin/tickets/${id}/redeem`, { method:'PATCH', headers:{ 'Content-Type':'application/json' } }),
  adminTicketStatus:(id, status) => request(`/admin/tickets/${id}/status`, { method:'PATCH', headers:{ 'Content-Type':'application/json' }, body:{status} }),
  adminGallery:(body)      => request('/admin/gallery', { method:'POST', headers:{ 'Content-Type':'application/json' }, body }),
  adminDeleteGallery:(id)  => request(`/admin/gallery/${id}`, { method:'DELETE', headers:{ 'Content-Type':'application/json' } }),
  adminSiteStatus:(body)   => request('/admin/site-status', { method:'PUT', headers:{ 'Content-Type':'application/json' }, body }),
  adminDatingApp:(body)    => request('/admin/dating-app', { method:'PUT', headers:{ 'Content-Type':'application/json' }, body }),
  adminSparkRush:(body)    => request('/admin/spark-rush', { method:'PUT', headers:{ 'Content-Type':'application/json' }, body })
  ,adminCustomOrders:(page=1,query='',status='') => request(`/admin/custom-orders?page=${page}&query=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}`)
  ,adminCreateCustomOrder:body => request('/admin/custom-orders',{method:'POST',body})
  ,adminUpdateCustomOrder:(id,body) => request(`/admin/custom-orders/${encodeURIComponent(id)}`,{method:'PATCH',body})
  ,adminDuplicateCustomOrder:id => request(`/admin/custom-orders/${encodeURIComponent(id)}/duplicate`,{method:'POST'})
  ,adminRegenerateCustomOrder:id => request(`/admin/custom-orders/${encodeURIComponent(id)}/regenerate-code`,{method:'POST'})
  ,adminCancelCustomOrder:id => request(`/admin/custom-orders/${encodeURIComponent(id)}/cancel`,{method:'POST'})
  ,pokerTournaments:() => request('/poker/tournaments')
  ,pokerTournament:(id,locale='en') => request(`/poker/tournaments/${encodeURIComponent(id)}?locale=${locale}`)
  ,pokerLobby:id => request(`/poker/tournaments/${encodeURIComponent(id)}/lobby`)
  ,pokerResults:id => request(`/poker/tournaments/${encodeURIComponent(id)}/results`)
  ,pokerRegister:(id,csrfToken,body) => request(`/poker/tournaments/${encodeURIComponent(id)}/register`,{method:'POST',headers:{'x-csrf-token':csrfToken},body})
  ,pokerWithdraw:(id,csrfToken) => request(`/poker/tournaments/${encodeURIComponent(id)}/withdraw`,{method:'POST',headers:{'x-csrf-token':csrfToken}})
  ,pokerCheckIn:(id,csrfToken) => request(`/poker/tournaments/${encodeURIComponent(id)}/check-in`,{method:'POST',headers:{'x-csrf-token':csrfToken}})
  ,pokerMySeat:() => request('/poker/my-seat')
  ,pokerTable:id => request(`/poker/tables/${encodeURIComponent(id)}`)
  ,pokerAction:(id,csrfToken,body) => request(`/poker/tables/${encodeURIComponent(id)}/action`,{method:'POST',headers:{'x-csrf-token':csrfToken},body})
  ,pokerSitOut:(id,csrfToken,sitOut) => request(`/poker/tables/${encodeURIComponent(id)}/sit-out`,{method:'POST',headers:{'x-csrf-token':csrfToken},body:{sitOut}})
  ,pokerDemo:(displayName='GUEST') => request('/poker/demo',{method:'POST',body:{displayName}})
  ,pokerDemoAction:(id,type,amount=0) => request(`/poker/demo/${encodeURIComponent(id)}/action`,{method:'POST',body:{type,amount}})
  ,pokerDemoNext:id => request(`/poker/demo/${encodeURIComponent(id)}/next`,{method:'POST'})
  ,adminPokerTournaments:() => request('/admin/poker/tournaments')
  ,adminPokerTournament:id => request(`/admin/poker/tournaments/${encodeURIComponent(id)}`)
  ,adminPokerSave:body => request('/admin/poker/tournaments',{method:'POST',body})
  ,adminPokerAction:(id,action,body={}) => request(`/admin/poker/tournaments/${encodeURIComponent(id)}/${action}`,{method:'POST',body})
  ,adminPokerPrizes:(id,prizes) => request(`/admin/poker/tournaments/${encodeURIComponent(id)}/prizes`,{method:'PUT',body:{prizes}})
  ,adminPokerRules:(id,body) => request(`/admin/poker/tournaments/${encodeURIComponent(id)}/rules`,{method:'POST',body})
  ,adminPokerLegal:(id,body) => request(`/admin/poker/tournaments/${encodeURIComponent(id)}/legal-review`,{method:'POST',body})
  ,adminPokerReports:() => request('/admin/poker/reports')
  ,adminPokerReport:(id,body) => request(`/admin/poker/reports/${encodeURIComponent(id)}`,{method:'PATCH',body})
};

const PKEY = 'iskra_player_v2';
export const savedPlayer  = () => { try { return JSON.parse(localStorage.getItem(PKEY)); } catch { return null; } };
export const savePlayer   = (p) => { try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch {} };
export const clearPlayer  = () => { try { localStorage.removeItem(PKEY); } catch {} };

const TKEY = 'iskra_ticket_wallet_v1';
export const savedTickets = () => { try { return JSON.parse(localStorage.getItem(TKEY)) || []; } catch { return []; } };
export const saveTickets = tickets => {
  try {
    const existing = savedTickets();
    const merged = [...tickets.map(t=>({reference:t.reference,accessToken:t.accessToken})),...existing]
      .filter((item,index,list)=>list.findIndex(other=>other.reference === item.reference) === index)
      .slice(0,30);
    localStorage.setItem(TKEY,JSON.stringify(merged));
  } catch {}
};
