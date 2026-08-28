export function safePublicHref(value, fallback = '/') {
  const href=String(value||'').trim().slice(0,500);
  if(/^\/(?!\/)[^\s]*$/.test(href)||/^#[a-z0-9_-]+$/i.test(href))return href;
  try{
    const parsed=new URL(href);
    if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password)return parsed.toString();
  }catch{}
  return fallback;
}

export function safeImageUrl(value, fallback = '') {
  const url=String(value||'').trim().slice(0,1000);
  if(/^\/(?!\/)[^\s]*$/.test(url))return url;
  try{
    const parsed=new URL(url);
    if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password)return parsed.toString();
  }catch{}
  return fallback;
}

export const boundedText=(value,max)=>String(value||'').trim().slice(0,max);
