import crypto from 'node:crypto';

const developmentSecrets = new Map();
const production = () => process.env.NODE_ENV === 'production';

const randomDevelopmentSecret = name => {
  if (!developmentSecrets.has(name)) developmentSecrets.set(name, crypto.randomBytes(48).toString('base64url'));
  return developmentSecrets.get(name);
};

export function secretValue(name, { minLength = 32 } = {}) {
  const value = String(process.env[name] || '');
  if (value.length >= minLength) return value;
  if (production()) throw new Error(`${name} must be set to at least ${minLength} random characters in production.`);
  return randomDevelopmentSecret(name);
}

export const scannerSigningSecret = () => secretValue('SCANNER_SECRET', { minLength:32 });
export const visitorSigningSecret = () => secretValue('VISITOR_SIGNING_SECRET', { minLength:32 });

export function configuredOrigins() {
  return String(process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map(origin => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function exactWebOrigin(value) {
  try {
    const parsed = new URL(value);
    if (!['http:','https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash)
      return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function originAllowed(origin) {
  if (!origin) return !production();
  const normalized = exactWebOrigin(String(origin));
  if (!normalized) return false;
  if (configuredOrigins().map(exactWebOrigin).includes(normalized)) return true;
  return !production() && /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(normalized);
}

export function assertSecurityConfiguration() {
  if (!production()) return;
  secretValue('JWT_SECRET', { minLength:32 });
  scannerSigningSecret();
  visitorSigningSecret();

  const passcode = String(process.env.SCANNER_PASSCODE || '');
  if (passcode && passcode.length < 8)
    throw new Error('SCANNER_PASSCODE must contain at least 8 characters in production.');

  const bootstrapPassword = String(process.env.ADMIN_PASSWORD || '');
  if (bootstrapPassword && bootstrapPassword.length < 14)
    throw new Error('ADMIN_PASSWORD must contain at least 14 characters in production.');

  const origins = configuredOrigins();
  if (!origins.length || origins.some(origin => !exactWebOrigin(origin)?.startsWith('https://') || origin.includes('*')))
    throw new Error('CLIENT_ORIGIN must contain explicit HTTPS origins without wildcards in production.');
}
