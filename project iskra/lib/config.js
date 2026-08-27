const path = require('path');
require('dotenv').config();

const rootDir = path.resolve(__dirname, '..');

const parseIntEnv = (name, fallback) => {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return fallback;
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) ? value : fallback;
};

const parseBoolEnv = (name, fallback) => {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase());
};

const parseCsvEnv = (name) => {
    const raw = process.env[name];
    if (!raw) return [];
    return raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
};

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const config = {
    rootDir,
    publicDir: path.join(rootDir, 'public'),
    dataDir: path.join(rootDir, 'data'),
    port: parseIntEnv('PORT', 3000),
    host: process.env.HOST || '127.0.0.1',
    nodeEnv,
    isProduction,
    jwtSecret: process.env.JWT_SECRET,
    adminPassword: process.env.ADMIN_PASSWORD,
    adminEmail: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
    trustProxy: parseBoolEnv('TRUST_PROXY', true),
    secureCookies: parseBoolEnv('SECURE_COOKIES', isProduction),
    bodyLimit: process.env.JSON_BODY_LIMIT || '10kb',
    bcryptRounds: parseIntEnv('BCRYPT_ROUNDS', 12),
    adminMaxFails: parseIntEnv('ADMIN_MAX_FAILS', 6),
    adminLockMs: parseIntEnv('ADMIN_LOCK_MS', 5 * 60 * 1000),
    csrfTrustedOrigins: parseCsvEnv('CSRF_TRUSTED_ORIGINS'),
    allowAdminRegistration: parseBoolEnv('ALLOW_ADMIN_REGISTRATION', false),
    rateLimits: {
        authWindowMs: parseIntEnv('AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
        authMax: parseIntEnv('AUTH_RATE_LIMIT_MAX', 10),
        adminLoginMax: parseIntEnv('ADMIN_LOGIN_RATE_LIMIT_MAX', 8),
        generalWindowMs: parseIntEnv('GENERAL_RATE_LIMIT_WINDOW_MS', 60 * 1000),
        generalMax: parseIntEnv('GENERAL_RATE_LIMIT_MAX', 120),
        verifyWindowMs: parseIntEnv('VERIFY_RATE_LIMIT_WINDOW_MS', 60 * 1000),
        verifyMax: parseIntEnv('VERIFY_RATE_LIMIT_MAX', 180),
        purchaseWindowMs: parseIntEnv('PURCHASE_RATE_LIMIT_WINDOW_MS', 5 * 60 * 1000),
        purchaseMax: parseIntEnv('PURCHASE_RATE_LIMIT_MAX', 5)
    },
    stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY || '',
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || ''
    },
    resendApiKey: process.env.RESEND_API_KEY || '',
    siteUrl: process.env.SITE_URL || 'https://projekt-iskra.com'
};

if (!config.jwtSecret || config.jwtSecret.length < 32) {
    throw new Error('FATAL: JWT_SECRET must be at least 32 characters');
}
if (!config.adminPassword) {
    throw new Error('FATAL: ADMIN_PASSWORD not set in .env');
}
if (!config.adminEmail) {
    throw new Error('FATAL: ADMIN_EMAIL not set in .env');
}

module.exports = config;
