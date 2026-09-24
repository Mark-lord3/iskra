/**
 * Everything that is venue-specific and not stored in the database.
 * Fill the social URLs in and the footer will link them automatically;
 * leave one empty and it is simply not rendered, so there are no dead links.
 */
export const SITE = {
  address: 'Montréal, Québec',
  hours:   'Dates announced event by event',
  email:   'doors@iskra.orvadora.com',
  social: {
    'Project ISKRA Instagram': 'https://www.instagram.com/_project_iskra/',
    'Ukrainian Wave Montréal': 'https://t.me/ukrwavemontreal'
  }
};

export function datingUrl() {
  const explicit = String(import.meta.env.VITE_DATING_URL || '').trim();
  if (explicit) return explicit;

  const host = typeof window === 'undefined' ? '' : window.location.hostname.toLowerCase();
  if (host === 'project-iskra.com' || host === 'www.project-iskra.com') {
    return 'https://dating.project-iskra.com';
  }
  if (host === 'iskra.orvadora.com') {
    return 'https://dating.orvadora.com';
  }

  return 'https://dating.orvadora.com';
}
