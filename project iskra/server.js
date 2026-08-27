const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const Stripe = require('stripe');
const multer = require('multer');
const config = require('./lib/config');

let stripe = null;
if (config.stripe.secretKey) {
    stripe = new Stripe(config.stripe.secretKey, { apiVersion: '2024-12-18.acacia' });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'public', 'uploads')),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, Date.now() + '-' + crypto.randomUUID().slice(0, 8) + ext);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only images allowed'));
    }
});

let ResendLib = null;
if (config.resendApiKey) {
    try { ResendLib = require('resend'); } catch (_) {}
}
const resend = ResendLib && config.resendApiKey ? new ResendLib.Resend(config.resendApiKey) : null;
const { createStore } = require('./lib/store');
const {
    sanitize,
    validatePassword,
    validateText,
    validateDate,
    normalizeSurveyQuestions,
    sanitizeLogDetails
} = require('./lib/validation');

const app = express();
const SECURITY_LOG = path.join(config.rootDir, 'security.log');
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const store = createStore({
    baseDir: config.dataDir,
    tables: {
        users: { file: 'users.json', defaultValue: [] },
        club: { file: 'club.json', defaultValue: { isOpen: true, message: '', updatedAt: new Date().toISOString() } },
        events: { file: 'events.json', defaultValue: [] },
        tickets: { file: 'tickets.json', defaultValue: [] },
        surveys: { file: 'surveys.json', defaultValue: [] },
        surveyDefs: { file: 'survey_defs.json', defaultValue: [] },
        feedback: { file: 'feedback.json', defaultValue: [] },
        tokenBlacklist: { file: 'token_blacklist.json', defaultValue: [] },
        adminLock: { file: 'admin_lock.json', defaultValue: {} },
        gallery: { file: 'gallery.json', defaultValue: [] }
    }
});

let securityLogQueue = Promise.resolve();

const getUsers = () => store.get('users');
const getEvents = () => store.get('events');
const getTickets = () => store.get('tickets');
const getSurveys = () => store.get('surveys');
const getSurveyDefs = () => store.get('surveyDefs');
const getFeedback = () => store.get('feedback');

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

const realIp = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

const logSecurityEvent = (event, details = {}) => {
    const entry = `[${new Date().toISOString()}] ${event}: ${JSON.stringify(sanitizeLogDetails(details))}\n`;
    securityLogQueue = securityLogQueue
        .then(() => fs.promises.appendFile(SECURITY_LOG, entry, 'utf8'))
        .catch((err) => {
            console.error('Failed to write security log:', err);
        });
};

const blacklistCleanup = async () => {
    const now = Date.now();
    await store.update('tokenBlacklist', (entries) => entries.filter((item) => item.expiresAt > now));
};

const cleanupPendingTickets = async () => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    await store.update('tickets', (tickets) => {
        return tickets.filter((t) => {
            if (t.paymentStatus !== 'pending') return true;
            const created = new Date(t.purchasedAt).getTime();
            if (created < cutoff) {
                console.log('Cleaned up expired pending ticket:', t.id);
                return false;
            }
            return true;
        });
    });
};

const isTokenBlacklisted = (token) => {
    const tokenHash = hashToken(token);
    const now = Date.now();
    const entries = store.get('tokenBlacklist');
    return entries.some((entry) => entry.tokenHash === tokenHash && entry.expiresAt > now);
};

const addToBlacklist = async (token, expiresInMs) => {
    const now = Date.now();
    const tokenHash = hashToken(token);
    await store.update('tokenBlacklist', (entries) => {
        entries.push({ tokenHash, expiresAt: now + expiresInMs, addedAt: now });
    });
};

const getAdminLock = (ip) => {
    const locks = store.get('adminLock');
    const lock = locks[ip] || { fails: 0, lockedUntil: 0, strict: false };
    if (lock.lockedUntil && lock.lockedUntil <= Date.now()) {
        return { fails: 0, lockedUntil: 0, strict: false };
    }
    return lock;
};

const setAdminLock = async (ip, lock) => {
    await store.update('adminLock', (locks) => {
        locks[ip] = lock;
    });
};

const buildCustomSurveyDefinition = (questions, title) => {
    const normalized = normalizeSurveyQuestions(questions);
    if (normalized.length === 0) return null;
    return {
        id: `surv_${crypto.randomUUID().slice(0, 8)}`,
        title: typeof title === 'string' ? sanitize(title).slice(0, 200) : 'Кастомне опитування',
        questions: normalized,
        createdAt: new Date().toISOString()
    };
};

const setAuthCookie = (res, token, maxAgeMs, cookieName = 'auth_token', isSecure) => {
    res.cookie(cookieName, token, {
        httpOnly: true,
        secure: !!isSecure,
        sameSite: 'lax',
        path: '/',
        maxAge: maxAgeMs
    });
};

const clearAuthCookie = (res, cookieName, isSecure) => {
    res.clearCookie(cookieName, {
        httpOnly: true,
        secure: !!isSecure,
        sameSite: 'lax',
        path: '/'
    });
};

const verifyAdminToken = (token) => {
    if (!token || isTokenBlacklisted(token)) return null;
    const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    if (decoded.role !== 'admin') return null;
    if (!decoded.userId) {
        return { id: null, email: config.adminEmail, role: 'admin' };
    }
    const user = getUsers().find((entry) => entry.id === decoded.userId);
    if (!user || user.role !== 'admin') return null;
    return user;
};

const requireAdmin = (req, res, next) => {
    try {
        const token = req.cookies?.admin_token;
        const admin = verifyAdminToken(token);
        if (!admin) {
            console.error('requireAdmin FAIL:', token ? 'token invalid/expired' : 'no cookie', 'path:', req.path);
            return res.status(401).json({ error: 'Необхідна авторизація' });
        }
        req.admin = true;
        req.user = { id: admin.id, email: admin.email, phone: admin.phone, role: 'admin' };
        next();
    } catch (err) {
        console.error('requireAdmin error:', err.message);
        res.status(401).json({ error: 'Необхідна авторизація' });
    }
};

const isTrustedOrigin = (value, req) => {
    if (!value) return true;
    try {
        const origin = new URL(value).origin;
        const allowed = new Set(config.csrfTrustedOrigins);
        allowed.add(`${req.protocol}://${req.get('host')}`);
        return allowed.has(origin);
    } catch {
        return false;
    }
};

const sanitizeProto = (obj) => {
    if (obj && typeof obj === 'object') {
        delete obj.__proto__;
        delete obj.constructor;
        for (const key of Object.keys(obj)) {
            if (key === '__proto__' || key === 'constructor') {
                delete obj[key];
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                sanitizeProto(obj[key]);
            }
        }
    }
};

app.set('trust proxy', config.trustProxy ? 1 : false);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            scriptSrc: ["'self'", 'https://js.stripe.com'],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:', 'https://api.qrserver.com'],
            mediaSrc: ["'self'", 'blob:'],
            connectSrc: ["'self'", 'https://api.stripe.com'],
            baseUri: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            frameSrc: ["'self'", 'https://js.stripe.com', 'https://checkout.stripe.com']
        }
    },
    hsts: config.isProduction ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    } : false,
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'same-origin' }
}));

app.use(cookieParser());

if (stripe) {
    app.post('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
        const sig = req.headers['stripe-signature'];
        if (!sig || !config.stripe.webhookSecret) {
            return res.status(400).json({ error: 'Missing signature' });
        }

        let event;
        try {
            event = stripe.webhooks.constructEvent(req.body, sig, config.stripe.webhookSecret);
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return res.status(400).json({ error: 'Invalid signature' });
        }

        try {
            if (event.type === 'checkout.session.completed') {
                const session = event.data.object;
                const sessionId = session.id;
                const meta = session.metadata || {};

                if (session.payment_status !== 'paid') {
                    console.error('Webhook: session not paid', sessionId, session.payment_status);
                    return res.status(200).json({ received: true, skipped: 'not_paid' });
                }

                if (!meta.eventId) {
                    console.error('Webhook: missing metadata', sessionId);
                    return res.status(200).json({ received: true, skipped: 'missing_metadata' });
                }

                await store.withLock('webhook:checkout:' + sessionId, async () => {
                    const tickets = getTickets();
                    const existing = tickets.find((t) => t.stripeSessionId === sessionId);
                    if (existing) {
                        if (existing.paymentStatus !== 'paid') {
                            existing.paymentStatus = 'paid';
                            existing.stripePaymentIntentId = session.payment_intent || null;
                            existing.paymentMethod = session.payment_method_types?.[0] || null;
                            existing.paidAt = new Date().toISOString();
                            existing.status = 'active';
                            if (!existing.qrCode) {
                                existing.qrCode = `TKT-${crypto.randomUUID().replace(/-/g, '').toUpperCase().slice(0, 16)}`;
                            }
                            await store.replace('tickets', tickets);

                            const evts = getEvents();
                            const evt = evts.find((e) => e.id === existing.eventId);
                            if (resend && evt) {
                                sendTicketEmail(existing, evt).catch(function(err) {
                                    console.error('Webhook update: failed to send email:', err.message);
                                });
                            }
                        }
                        return;
                    }

                    const events = getEvents();
                    const eventDoc = events.find((e) => e.id === meta.eventId);
                    if (!eventDoc) {
                        console.error('Webhook: event not found', meta.eventId);
                        return;
                    }

                    const expectedAmount = Math.round((eventDoc.price || 0) * 100);
                    if (expectedAmount > 0 && session.amount_total !== expectedAmount) {
                        console.error('Webhook: amount mismatch', sessionId, session.amount_total, expectedAmount);
                        return;
                    }

                    const ticket = {
                        id: crypto.randomUUID(),
                        qrCode: `TKT-${crypto.randomUUID().replace(/-/g, '').toUpperCase().slice(0, 16)}`,
                        userId: null,
                        eventId: meta.eventId,
                        eventTitle: eventDoc.title,
                        eventDate: eventDoc.date,
                        eventLocation: eventDoc.location || '',
                        price: eventDoc.price || 0,
                        buyerName: meta.buyerName || 'unknown',
                        buyerEmail: meta.buyerEmail || null,
                        buyerPhone: meta.buyerPhone || null,
                        status: 'active',
                        purchasedAt: new Date().toISOString(),
                        paymentStatus: 'paid',
                        paymentMethod: session.payment_method_types?.[0] || null,
                        stripeSessionId: sessionId,
                        stripePaymentIntentId: session.payment_intent || null,
                        paidAt: new Date().toISOString()
                    };

                    tickets.push(ticket);
                    await store.replace('tickets', tickets);
                    console.log('Ticket created by webhook:', ticket.id, ticket.qrCode);

                    if (resend) {
                        sendTicketEmail(ticket, eventDoc).catch(function(err) {
                            console.error('Webhook: failed to send email:', err.message);
                        });
                    }
                });
            } else if (event.type === 'checkout.session.expired') {
                const session = event.data.object;
                await store.withLock('webhook:checkout:' + session.id, async () => {
                    const tickets = getTickets();
                    const pending = tickets.find((t) => t.stripeSessionId === session.id && t.paymentStatus === 'pending');
                    if (pending) {
                        pending.status = 'cancelled';
                        pending.paymentStatus = 'expired';
                        await store.replace('tickets', tickets);
                        console.log('Pending ticket cancelled (session expired):', pending.id);
                    }
                });
            }

            res.status(200).json({ received: true });
        } catch (err) {
            console.error('Webhook handler error:', err);
            res.status(500).json({ error: 'Handler error' });
        }
    });
}

app.use(express.json({ limit: config.bodyLimit }));

app.use((req, res, next) => {
    if (req.body) sanitizeProto(req.body);
    if (req.query) sanitizeProto(req.query);
    if (req.params) sanitizeProto(req.params);
    next();
});

app.use((req, res, next) => {
    if (!req.path.startsWith('/api/') || !MUTATING_METHODS.has(req.method)) {
        return next();
    }

    if (req.path === '/api/admin/upload') return next();

    const contentType = req.headers['content-type'] || '';
    if (req.method !== 'DELETE' && !contentType.includes('application/json')) {
        return res.status(415).json({ error: 'Invalid content type' });
    }

    const fetchSite = String(req.headers['sec-fetch-site'] || '').toLowerCase();
    if (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite)) {
        return res.status(403).json({ error: 'Cross-site requests are forbidden' });
    }

    const origin = req.headers.origin;
    const referer = req.headers.referer;
    if (origin && !isTrustedOrigin(origin, req)) {
        return res.status(403).json({ error: 'Origin not allowed' });
    }
    if (!origin && referer && !isTrustedOrigin(referer, req)) {
        return res.status(403).json({ error: 'Origin not allowed' });
    }

    next();
});

const SENSITIVE_PATH = /^(\/data\/|\/lib\/|\.env|\/server\.js$|\/export\.js$|\/package(?:-lock)?\.json$|\/security\.log$|\/iskra_export\.db$|\/.*\.db$|\/\.git\/)/;
const ADMIN_STATIC_PATH = /^\/(admin[^\s]*\.html|scan\.html)$/i;
app.use((req, res, next) => {
    if (SENSITIVE_PATH.test(req.path)) {
        return res.status(404).json({ error: 'Not found' });
    }
    if (ADMIN_STATIC_PATH.test(req.path)) {
        const admin = verifyAdminToken(req.cookies?.admin_token);
        if (!admin) return res.status(404).json({ error: 'Not found' });
    }
    next();
});

app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
    }
    next();
});

app.use(express.static(config.publicDir, {
    dotfiles: 'deny',
    index: 'index.html',
    maxAge: config.isProduction ? '1d' : 0,
    setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) {
            res.set('Cache-Control', 'no-cache, must-revalidate');
        }
    }
}));

const authLimiter = rateLimit({
    windowMs: config.rateLimits.authWindowMs,
    max: config.rateLimits.authMax,
    message: { error: 'Too many attempts, try later' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: realIp,
    skipSuccessfulRequests: true
});

const adminLoginLimiter = rateLimit({
    windowMs: config.rateLimits.authWindowMs,
    max: config.rateLimits.adminLoginMax,
    message: { error: 'Too many attempts, try later' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: realIp,
    skipSuccessfulRequests: true
});

const adminPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many password changes, try later' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: realIp
});

const generalLimiter = rateLimit({
    windowMs: config.rateLimits.generalWindowMs,
    max: config.rateLimits.generalMax,
    message: { error: 'Too many requests' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: realIp
});

const verifyLimiter = rateLimit({
    windowMs: config.rateLimits.verifyWindowMs,
    max: config.rateLimits.verifyMax,
    message: { error: 'Too many requests' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: realIp
});

const purchaseLimiter = rateLimit({
    windowMs: config.rateLimits.purchaseWindowMs,
    max: config.rateLimits.purchaseMax,
    message: { error: 'Too many purchase attempts' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req.user ? req.user.id : realIp(req))
});

app.use('/api/', generalLimiter);
app.use('/api/tickets/verify/', verifyLimiter);

app.get('/api/payments/config', (req, res) => {
    res.json({ publishableKey: config.stripe.publishableKey || null });
});

app.get('/api/health', requireAdmin, async (req, res) => {
    const blacklist = store.get('tokenBlacklist');
    const now = Date.now();
    const activeSessions = blacklist.filter((entry) => entry.expiresAt > now).length;
    res.json({
        ok: true,
        environment: config.nodeEnv,
        uptimeSec: Math.round(process.uptime()),
        stats: store.stats(),
        blacklistEntries: activeSessions
    });
});

app.get('/api/club', (req, res) => {
    const club = store.get('club');
    res.json(club || { isOpen: true, message: '' });
});

app.get('/api/events', (req, res) => {
    const tickets = getTickets();
    const events = getEvents()
        .filter((event) => event.active !== false)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((event) => {
            const sold = tickets.filter((t) => t.eventId === event.id && t.status !== 'cancelled' && t.paymentStatus !== 'pending' && t.paymentStatus !== 'expired').length;
            const capacity = event.capacity || null;
            const remaining = capacity !== null ? Math.max(0, capacity - sold) : null;
            return { ...event, sold, remaining };
        });
    res.json({ events });
});

const FEEDBACK_CATEGORIES = ['host', 'dj', 'music', 'photographer', 'barStaff', 'atmosphere', 'people', 'party', 'ticketPrice', 'organization'];

app.get('/api/admin/feedback/:eventId', requireAdmin, (req, res) => {
    try {
        const feedbackList = getFeedback();
        const eventFeedback = feedbackList.filter((f) => f.eventId === req.params.eventId);

        const avgRatings = {};
        for (const cat of FEEDBACK_CATEGORIES) {
            const values = eventFeedback.map((f) => f.ratings[cat]).filter((v) => v != null);
            avgRatings[cat] = values.length > 0 ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : null;
        }

        const comeAgainCounts = { yes: 0, no: 0, maybe: 0 };
        eventFeedback.forEach((f) => { if (f.comeAgain) comeAgainCounts[f.comeAgain]++; });

        res.json({
            total: eventFeedback.length,
            avgRatings,
            comeAgainCounts,
            feedback: eventFeedback
        });
    } catch (err) {
        console.error('Admin feedback error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/tickets/purchase', purchaseLimiter, async (req, res) => {
    const { eventId, name, email } = req.body || {};
    if (!eventId || typeof eventId !== 'string') {
        return res.status(400).json({ error: 'Invalid event ID' });
    }
    const cleanName = sanitize(String(name || '').trim()).slice(0, 100);
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanName || cleanName.length < 1) {
        return res.status(400).json({ error: 'Name required' });
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ error: 'Valid email required' });
    }

    try {
        await store.withLock(`purchase:event:${eventId}`, async () => {
            const events = getEvents();
            const event = events.find((entry) => entry.id === eventId);
            if (!event) throw Object.assign(new Error('Event not found'), { status: 404 });
            if (event.active === false) throw Object.assign(new Error('Event is no longer available'), { status: 400 });
            const evDate = new Date(event.date);
            const now = new Date();
            const evDay = new Date(evDate.getFullYear(), evDate.getMonth(), evDate.getDate());
            const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (evDay < nowDay) throw Object.assign(new Error('Event has already passed'), { status: 400 });

            const tickets = getTickets();
            const existing = tickets.find((entry) => entry.buyerEmail === cleanEmail && entry.eventId === eventId && entry.status !== 'cancelled');
            if (existing) throw Object.assign(new Error('You already have a reservation for this event'), { status: 409 });

            if (event.capacity) {
                const sold = tickets.filter((entry) => entry.eventId === eventId && entry.status !== 'cancelled').length;
                if (sold >= event.capacity) throw Object.assign(new Error('Event is sold out'), { status: 400 });
            }

            const ticket = {
                id: crypto.randomUUID(),
                qrCode: `TKT-${crypto.randomUUID().replace(/-/g, '').toUpperCase().slice(0, 16)}`,
                userId: null,
                eventId,
                eventTitle: event.title,
                eventDate: event.date,
                eventLocation: event.location || '',
                price: event.price || 0,
                buyerName: cleanName,
                buyerEmail: cleanEmail,
                buyerPhone: null,
                status: 'active',
                purchasedAt: new Date().toISOString(),
                paymentStatus: 'free',
                paymentMethod: null,
                stripeSessionId: null,
                stripePaymentIntentId: null,
                paidAt: null
            };

            const freshTickets = getTickets();
            freshTickets.push(ticket);
            await store.replace('tickets', freshTickets);

            if (resend) {
                sendTicketEmail(ticket, event).catch(function(err) {
                    console.error('Failed to send ticket email:', err.message);
                });
            }

            res.status(201).json({ message: 'Ticket reserved', ticket });
        });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        console.error('Ticket purchase error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/checkout', purchaseLimiter, async (req, res) => {
    const { eventId, name, email } = req.body || {};
    if (!eventId || typeof eventId !== 'string') {
        return res.status(400).json({ error: 'Невірний ID події' });
    }
    const cleanName = sanitize(String(name || '').trim()).slice(0, 100);
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanName || cleanName.length < 1) {
        return res.status(400).json({ error: 'Введіть ім\'я' });
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ error: 'Введіть коректний email' });
    }

    try {
        await store.withLock(`purchase:event:${eventId}`, async () => {
            const events = getEvents();
            const event = events.find((e) => e.id === eventId);
            if (!event) return res.status(404).json({ error: 'Подію не знайдено' });
            if (event.active === false) return res.status(400).json({ error: 'Подія недоступна' });

            const evDate = new Date(event.date);
            const now = new Date();
            const evDay = new Date(evDate.getFullYear(), evDate.getMonth(), evDate.getDate());
            const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (evDay < nowDay) return res.status(400).json({ error: 'Подія вже минула' });

            const tickets = getTickets();
            const existing = tickets.find((t) => t.buyerEmail === cleanEmail && t.eventId === eventId && t.status !== 'cancelled');
            if (existing) return res.status(409).json({ error: 'У вас вже є квиток на цю подію' });

            if (event.capacity) {
                const sold = tickets.filter((t) => t.eventId === eventId && t.status !== 'cancelled').length;
                if (sold >= event.capacity) return res.status(400).json({ error: 'Подія розпродана' });
            }

            if (!event.price || event.price <= 0) {
                const ticket = {
                    id: crypto.randomUUID(),
                    qrCode: `TKT-${crypto.randomUUID().replace(/-/g, '').toUpperCase().slice(0, 16)}`,
                    userId: null,
                    eventId,
                    eventTitle: event.title,
                    eventDate: event.date,
                    eventLocation: event.location || '',
                    price: 0,
                    buyerName: cleanName,
                    buyerEmail: cleanEmail,
                    buyerPhone: null,
                    status: 'active',
                    purchasedAt: new Date().toISOString(),
                    paymentStatus: 'free',
                    paymentMethod: null,
                    stripeSessionId: null,
                    stripePaymentIntentId: null,
                    paidAt: new Date().toISOString()
                };
                const freshTickets = getTickets();
                freshTickets.push(ticket);
                await store.replace('tickets', freshTickets);

                if (resend) {
                    sendTicketEmail(ticket, event).catch(function(err) {
                        console.error('Failed to send ticket email:', err.message);
                    });
                }

                res.cookie('ticket_' + eventId, ticket.id, {
                    httpOnly: true,
                    secure: req.secure,
                    sameSite: 'lax',
                    path: '/',
                    maxAge: 365 * 24 * 60 * 60 * 1000
                });

                return res.status(201).json({ ticket });
            }

            if (!stripe) {
                return res.status(500).json({ error: 'Stripe не налаштований' });
            }

            const stripeImage = event.image && /^https?:\/\//.test(event.image) ? [event.image] : [];
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency: 'cad',
                        product_data: {
                            name: event.title,
                            description: (event.artist ? event.artist + ' - ' : '') + (event.venue || event.location || ''),
                            images: stripeImage
                        },
                        unit_amount: Math.round(event.price * 100)
                    },
                    quantity: 1
                }],
                mode: 'payment',
                success_url: config.siteUrl + '/success?session_id={CHECKOUT_SESSION_ID}',
                cancel_url: config.siteUrl + '/cancel',
                customer_email: cleanEmail,
                metadata: {
                    eventId: eventId,
                    buyerName: cleanName,
                    buyerEmail: cleanEmail
                }
            });

            res.json({ url: session.url, sessionId: session.id });
        });
    } catch (err) {
        console.error('Checkout error:', err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.get('/api/tickets/by-session', async (req, res) => {
    const sessionId = req.query.session_id;
    if (!sessionId) return res.status(400).json({ error: 'Missing session_id' });
    const email = (req.cookies?.user_email || '').trim().toLowerCase();
    const tickets = getTickets();
    const ticket = tickets.find((t) => t.stripeSessionId === sessionId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (email && ticket.buyerEmail !== email) return res.status(403).json({ error: 'Forbidden' });

    res.cookie('ticket_' + ticket.eventId, ticket.id, {
        httpOnly: true,
        secure: req.secure,
        sameSite: 'lax',
        path: '/',
        maxAge: 365 * 24 * 60 * 60 * 1000
    });

    res.json({ ticket });
});

app.get('/api/tickets/my', async (req, res) => {
    const cookies = req.cookies || {};
    const ticketIds = Object.keys(cookies)
        .filter(function(k) { return k.startsWith('ticket_'); })
        .map(function(k) { return cookies[k]; })
        .filter(function(v) { return typeof v === 'string' && v.length > 0; });

    if (ticketIds.length === 0) return res.json({ tickets: [] });

    const allTickets = getTickets();
    const events = getEvents();
    const eventsMap = new Map(events.map(function(e) { return [e.id, e]; }));
    const myTickets = allTickets.filter(function(t) {
        return ticketIds.indexOf(t.id) !== -1 && t.status !== 'cancelled' && t.paymentStatus !== 'pending' && t.paymentStatus !== 'expired';
    }).map(function(t) {
        const ev = eventsMap.get(t.eventId);
        return Object.assign({}, t, { eventImage: ev?.image || null, eventVenue: ev?.venue || ev?.location || null, eventArtist: ev?.artist || null });
    });

    res.json({ tickets: myTickets });
});

function generateMagicToken(email) {
    return jwt.sign({ email: email, type: 'magic' }, config.jwtSecret, { expiresIn: '7d' });
}

function verifyMagicToken(token) {
    try {
        const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
        if (decoded.type !== 'magic' || !decoded.email) return null;
        return decoded.email;
    } catch {
        return null;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function sendTicketEmail(ticket, event) {
    if (!resend) return;
    const date = new Date(event.date);
    const dateStr = date.toLocaleDateString('uk-UA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    const magicToken = generateMagicToken(ticket.buyerEmail);
    const dashboardUrl = config.siteUrl + '/dashboard?token=' + encodeURIComponent(magicToken);
    const priceStr = ticket.price > 0 ? ticket.price + ' $' : 'Безкоштовно';
    const qrImgUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&bgcolor=ffffff&color=000000&data=' + encodeURIComponent(ticket.qrCode);

    await resend.emails.send({
        from: 'Project Iskra <noreply@projekt-iskra.com>',
        to: ticket.buyerEmail,
        subject: 'Ваш квиток на ' + event.title,
        html: '<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0a0a0a;color:#fff;padding:40px 20px;max-width:500px;margin:0 auto;">' +
            '<h1 style="color:#e63946;font-size:24px;margin-bottom:4px;">PROJECT ISKRA</h1>' +
            '<p style="color:#888;font-size:12px;letter-spacing:2px;margin-top:0;">MONTREAL</p>' +
            '<hr style="border:none;border-top:1px solid #222;margin:20px 0;">' +
            '<h2 style="font-size:18px;margin:0 0 8px;">' + escapeHtml(ticket.eventTitle) + '</h2>' +
            '<p style="color:#aaa;font-size:14px;margin:0 0 4px;">' + dateStr + ' - ' + timeStr + '</p>' +
            '<p style="color:#aaa;font-size:14px;margin:0 0 4px;">' + escapeHtml(ticket.eventLocation || '') + '</p>' +
            '<p style="color:#e63946;font-size:16px;font-weight:bold;margin:16px 0;">' + priceStr + '</p>' +
            '<p style="color:#aaa;font-size:14px;">Ім\'я: ' + escapeHtml(ticket.buyerName) + '</p>' +
            '<div style="text-align:center;margin:24px 0;"><img src="' + qrImgUrl + '" width="200" height="200" alt="QR Code" style="border-radius:8px;background:#fff;padding:8px;"></div>' +
            '<p style="color:#aaa;font-size:13px;text-align:center;margin-bottom:24px;">Код: <strong style="color:#fff;letter-spacing:2px;">' + escapeHtml(ticket.qrCode) + '</strong></p>' +
            '<a href="' + dashboardUrl + '" style="display:inline-block;padding:14px 32px;background:#e63946;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;">ПЕРЕГЛЯНУТИ КВИТОК</a>' +
            '<p style="color:#555;font-size:11px;margin-top:30px;">Збережіть цей лист - він містить ваш резервний QR-код.</p>' +
            '</body></html>'
    });
}

async function sendMagicLinkEmail(email) {
    if (!resend) return false;
    const token = generateMagicToken(email);
    const url = config.siteUrl + '/dashboard?token=' + encodeURIComponent(token);

    await resend.emails.send({
        from: 'Project Iskra <noreply@projekt-iskra.com>',
        to: email,
        subject: 'Посилання на ваші квитки - Project Iskra',
        html: '<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0a0a0a;color:#fff;padding:40px 20px;max-width:500px;margin:0 auto;">' +
            '<h1 style="color:#e63946;font-size:24px;margin-bottom:4px;">PROJECT ISKRA</h1>' +
            '<hr style="border:none;border-top:1px solid #222;margin:20px 0;">' +
            '<p style="color:#ccc;font-size:14px;">Натисніть кнопку нижче, щоб переглянути ваші квитки:</p>' +
            '<a href="' + url + '" style="display:inline-block;padding:14px 32px;background:#e63946;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;margin:16px 0;">ПЕРЕГЛЯНУТИ КВИТКИ</a>' +
            '<p style="color:#555;font-size:11px;margin-top:30px;">Це посилання дійсне протягом 30 хвилин.</p>' +
            '</body></html>'
    });
    return true;
}

app.post('/api/auth/magic-link', authLimiter, async (req, res) => {
    const { email } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ error: 'Valid email required' });
    }

    try {
        if (resend) {
            await sendMagicLinkEmail(cleanEmail);
        }

        res.json({ message: 'Check your email' });
    } catch (err) {
        console.error('Magic link error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/auth/verify', (req, res) => {
    const { token } = req.query || {};
    if (!token) return res.status(400).json({ error: 'Token required' });

    const email = verifyMagicToken(String(token));
    if (!email) return res.status(401).json({ error: 'Invalid or expired token' });

    res.cookie('user_email', email, {
        httpOnly: true,
        secure: config.secureCookies,
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000
    });
    res.json({ message: 'OK', email });
});

app.get('/api/tickets/by-email', (req, res) => {
    const email = (req.cookies?.user_email || '').trim().toLowerCase();
    if (!email) return res.status(401).json({ error: 'Not authenticated' });

    const events = getEvents();
    const eventsMap = new Map(events.map(function(e) { return [e.id, e]; }));
    const activeEventIds = new Set(events.filter(function(e) { return e.active !== false; }).map(function(e) { return e.id; }));
    const tickets = getTickets()
        .filter(function(t) {
            return t.buyerEmail === email && t.status !== 'cancelled' && t.paymentStatus !== 'pending' && t.paymentStatus !== 'expired' && activeEventIds.has(t.eventId);
        })
        .sort(function(a, b) { return b.purchasedAt.localeCompare(a.purchasedAt); })
        .map(function(t) {
            const ev = eventsMap.get(t.eventId);
            return Object.assign({}, t, { eventImage: ev?.image || null, eventVenue: ev?.venue || ev?.location || null, eventArtist: ev?.artist || null });
        });
    res.json({ tickets: tickets, email: email });
});

app.get('/api/tickets/verify/:qrCode', requireAdmin, (req, res) => {
    try {
        const tickets = getTickets();
        const ticket = tickets.find((entry) => entry.qrCode === req.params.qrCode);
        if (!ticket) return res.status(404).json({ valid: false, error: 'Ticket not found' });

        const eventTickets = tickets
            .filter((entry) => entry.eventId === ticket.eventId && entry.status !== 'cancelled')
            .sort((a, b) => new Date(a.purchasedAt) - new Date(b.purchasedAt));
        const ticketNumber = eventTickets.findIndex((entry) => entry.id === ticket.id) + 1;

        res.json({
            valid: ticket.status === 'active',
            redeemed: ticket.status === 'used',
            cancelled: ticket.status === 'cancelled',
            ticket: {
                id: ticket.id,
                qrCode: ticket.qrCode,
                eventTitle: ticket.eventTitle,
                eventDate: ticket.eventDate,
                eventLocation: ticket.eventLocation || '',
                price: ticket.price,
                buyerName: ticket.buyerName || 'unknown',
                buyerEmail: ticket.buyerEmail || null,
                buyerPhone: ticket.buyerPhone || null,
                status: ticket.status,
                purchasedAt: ticket.purchasedAt,
                usedAt: ticket.usedAt || null,
                paymentStatus: ticket.paymentStatus || 'free',
                paymentMethod: ticket.paymentMethod || null,
                paidAt: ticket.paidAt || null,
                ticketNumber: ticketNumber
            }
        });
    } catch (err) {
        console.error('Verify error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/tickets/:id', async (req, res) => {
    const ticketId = req.params.id;
    const allTickets = getTickets();
    const ticket = allTickets.find((t) => t.id === ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const email = (req.cookies?.user_email || '').trim().toLowerCase();
    const ticketCookie = req.cookies?.['ticket_' + ticket.eventId];
    const admin = verifyAdminToken(req.cookies?.admin_token);
    const isOwner = (email && ticket.buyerEmail === email) || ticketCookie === ticket.id;
    if (!admin && !isOwner) return res.status(403).json({ error: 'Forbidden' });

    res.json({ ticket });
});

app.post('/api/admin/tickets/:id/redeem', requireAdmin, async (req, res) => {
    try {
        await store.withLock(`redeem:${req.params.id}`, async () => {
            const tickets = getTickets();
            const index = tickets.findIndex((entry) => entry.id === req.params.id);
            if (index === -1) throw Object.assign(new Error('Ticket not found'), { status: 404 });
            if (tickets[index].status === 'cancelled') throw Object.assign(new Error('Ticket cancelled'), { status: 400 });
            if (tickets[index].status === 'used') throw Object.assign(new Error('Already redeemed'), { status: 409 });
            if (tickets[index].paymentStatus === 'pending') throw Object.assign(new Error('Payment not completed'), { status: 400 });
            if (tickets[index].paymentStatus === 'expired') throw Object.assign(new Error('Payment expired'), { status: 400 });
            if (tickets[index].paymentStatus === 'failed') throw Object.assign(new Error('Payment failed'), { status: 400 });

            tickets[index].status = 'used';
            tickets[index].usedAt = new Date().toISOString();
            await store.replace('tickets', tickets);
            res.json({ message: 'Redeemed', ticket: tickets[index] });
        });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        console.error('Redeem error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/admin/login', adminLoginLimiter, async (req, res) => {
    const { email, password } = req.body || {};
    if (!password || typeof password !== 'string') {
        return res.status(400).json({ error: 'Invalid request' });
    }

    const identifier = (email && typeof email === 'string' ? sanitize(email).trim() : '');
    if (!identifier || identifier.length < 3) {
        return res.status(400).json({ error: 'Invalid identifier' });
    }

    try {
        const ip = realIp(req);
        await store.withLock('admin_login:' + ip, async () => {
            const now = Date.now();
            const adminLock = getAdminLock(ip);
            if (adminLock.lockedUntil > now) {
                const retryAfterMinutes = Math.max(1, Math.ceil((adminLock.lockedUntil - now) / 60000));
                logSecurityEvent('ADMIN_LOCKED_ATTEMPT', { email: identifier, ip, userAgent: req.headers['user-agent'] });
                return res.status(429).json({
                    error: 'Admin account locked. Try again later',
                    code: 'LOCKED',
                    retryAfter: retryAfterMinutes
                });
            }

            const maxFails = adminLock.strict ? 1 : config.adminMaxFails;
            const users = getUsers();
            const user = users.find((entry) =>
                (entry.email && entry.email.toLowerCase() === identifier.toLowerCase()) ||
                (entry.phone && entry.phone === identifier)
            );

            let isMaster = false;
            if (identifier.toLowerCase() === config.adminEmail) {
                const passwordBuffer = Buffer.from(password);
                const adminBuffer = Buffer.from(config.adminPassword);
                if (passwordBuffer.length === adminBuffer.length) {
                    isMaster = crypto.timingSafeEqual(passwordBuffer, adminBuffer);
                }
            }

            const isAdminUser = Boolean(user && user.role === 'admin' && await bcrypt.compare(password, user.password));
            if (!isMaster && !isAdminUser) {
                adminLock.fails += 1;
                logSecurityEvent('FAILED_ADMIN_PASSWORD', { email: identifier, ip, userAgent: req.headers['user-agent'] });
                if (adminLock.fails >= maxFails) {
                    adminLock.lockedUntil = now + config.adminLockMs;
                    adminLock.fails = 0;
                    adminLock.strict = true;
                    await setAdminLock(ip, adminLock);
                    return res.status(429).json({
                        error: 'Too many attempts. Admin account locked',
                        code: 'LOCKED',
                        retryAfter: Math.ceil(config.adminLockMs / 60000)
                    });
                }
                await setAdminLock(ip, adminLock);
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            adminLock.fails = 0;
            adminLock.lockedUntil = 0;
            adminLock.strict = false;
            await setAdminLock(ip, adminLock);

            logSecurityEvent('SUCCESSFUL_ADMIN_LOGIN', { email: identifier, ip: realIp(req), userAgent: req.headers['user-agent'] });
            const token = jwt.sign({ role: 'admin', userId: user ? user.id : null }, config.jwtSecret, { expiresIn: '8h' });
            setAuthCookie(res, token, 30 * 24 * 60 * 60 * 1000, 'admin_token', req.secure);
            res.json({ message: 'OK' });
        });
    } catch (err) {
        console.error('Admin login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/admin/me', requireAdmin, (req, res) => {
    res.json({ admin: true, id: req.user?.id || null, email: req.user?.email || null });
});

app.post('/api/admin/logout', requireAdmin, async (req, res) => {
    const token = req.cookies?.admin_token;
    if (token) await addToBlacklist(token, 8 * 60 * 60 * 1000);
    clearAuthCookie(res, 'admin_token', req.secure);
    res.json({ message: 'OK' });
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
    const users = getUsers().map((user) => ({
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role || 'user',
        createdAt: user.createdAt
    }));
    res.json({ users });
});

app.patch('/api/admin/users/:id/role', requireAdmin, async (req, res) => {
    const { role } = req.body || {};
    if (!role || !['admin', 'user'].includes(role)) {
        return res.status(400).json({ error: 'Role must be admin or user' });
    }

    try {
        await store.withLock('admin_role_update', async () => {
            const users = getUsers();
            const user = users.find((entry) => entry.id === req.params.id);
            if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

            const admins = users.filter((entry) => entry.role === 'admin');
            if (user.role === 'admin' && role === 'user' && admins.length <= 1) {
                throw Object.assign(new Error('Cannot remove last admin'), { status: 400 });
            }

            user.role = role;
            await store.replace('users', users);
            logSecurityEvent('ADMIN_ROLE_CHANGE', {
                targetUserId: user.id,
                newRole: role,
                adminId: req.user?.id || 'token'
            });
            res.json({ message: 'Role updated', user: { id: user.id, email: user.email, role: user.role } });
        });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        console.error('Role update error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.patch('/api/admin/users/:id/password', requireAdmin, adminPasswordLimiter, async (req, res) => {
    const { password, currentPassword } = req.body || {};
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.ok) return res.status(400).json({ error: passwordCheck.error });

    try {
        await store.withLock('admin_password_update', async () => {
            const users = getUsers();
            const user = users.find((entry) => entry.id === req.params.id);
            if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

            const isSelf = req.user?.id && req.user.id === user.id;
            if (isSelf) {
                if (!currentPassword || typeof currentPassword !== 'string') {
                    return res.status(400).json({ error: 'Для зміни власного пароля введіть поточний пароль' });
                }
                const ok = await bcrypt.compare(currentPassword, user.password);
                if (!ok) {
                    logSecurityEvent('ADMIN_SELF_PW_WRONG', { adminId: req.user.id, ip: realIp(req) });
                    return res.status(403).json({ error: 'Невірний поточний пароль' });
                }
            }

            user.password = await bcrypt.hash(password, config.bcryptRounds);
            await store.replace('users', users);
            logSecurityEvent('ADMIN_PASSWORD_CHANGE', {
                targetUserId: user.id,
                adminId: req.user?.id || 'token',
                isSelf
            });
            res.json({ message: 'Password updated' });
        });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        console.error('Password update error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.patch('/api/admin/club', requireAdmin, async (req, res) => {
    const { isOpen, message } = req.body || {};
    if (typeof isOpen !== 'boolean') {
        return res.status(400).json({ error: 'isOpen must be boolean' });
    }

    try {
        const club = {
            isOpen,
            message: typeof message === 'string' ? sanitize(message).slice(0, 500) : '',
            updatedAt: new Date().toISOString()
        };
        await store.replace('club', club);
        res.json({ message: 'Club status updated', club });
    } catch (err) {
        console.error('Club update error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/admin/events', requireAdmin, async (req, res) => {
    try {
        const {
            title,
            description,
            image,
            date,
            location,
            artist,
            venue,
            price,
            capacity,
            survey,
            surveyTitle
        } = req.body || {};

        const titleCheck = validateText(title, 'Title', 2, 200);
        if (!titleCheck.ok) return res.status(400).json({ error: titleCheck.error });
        const dateCheck = validateDate(date);
        if (!dateCheck.ok) return res.status(400).json({ error: dateCheck.error });

        let surveyRef = 'default';
        const customSurvey = Array.isArray(survey) ? buildCustomSurveyDefinition(survey, surveyTitle) : null;
        if (customSurvey) {
            await store.update('surveyDefs', (defs) => {
                defs.push(customSurvey);
            });
            surveyRef = customSurvey.id;
        }

        await store.withLock('events:create', async () => {
            const event = {
                id: crypto.randomUUID(),
                title: titleCheck.value,
                description: typeof description === 'string' ? sanitize(description).slice(0, 2000) : '',
                image: typeof image === 'string' ? sanitize(image).slice(0, 500) : '',
                date: dateCheck.value,
                location: typeof location === 'string' ? sanitize(location).slice(0, 300) : '',
                artist: typeof artist === 'string' ? sanitize(artist).slice(0, 200) : '',
                venue: typeof venue === 'string' ? sanitize(venue).slice(0, 300) : '',
                price: typeof price === 'number' && price >= 0 ? price : 0,
                capacity: typeof capacity === 'number' && capacity > 0 ? Math.floor(capacity) : null,
                surveyRef,
                active: true,
                createdAt: new Date().toISOString()
            };
            const events = getEvents();
            events.push(event);
            await store.replace('events', events);
            res.status(201).json({ message: 'Event created', event });
        });
    } catch (err) {
        console.error('Create event error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/admin/events/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await store.withLock(`event:${id}`, async () => {
            const events = getEvents();
            const event = events.find((entry) => entry.id === id);
            if (!event) throw Object.assign(new Error('Event not found'), { status: 404 });

            const { title, description, image, date, location, artist, venue, price, capacity, active, survey, surveyTitle } = req.body || {};

            if (title !== undefined) {
                const titleCheck = validateText(String(title), 'Title', 2, 200);
                if (!titleCheck.ok) throw Object.assign(new Error(titleCheck.error), { status: 400 });
                event.title = titleCheck.value;
            }
            if (description !== undefined) event.description = sanitize(String(description)).slice(0, 2000);
            if (image !== undefined) event.image = sanitize(String(image)).slice(0, 500);
            if (date !== undefined) {
                const dateCheck = validateDate(String(date));
                if (!dateCheck.ok) throw Object.assign(new Error(dateCheck.error), { status: 400 });
                event.date = dateCheck.value;
            }
            if (location !== undefined) event.location = sanitize(String(location)).slice(0, 300);
            if (artist !== undefined) event.artist = sanitize(String(artist)).slice(0, 200);
            if (venue !== undefined) event.venue = sanitize(String(venue)).slice(0, 300);
            if (price !== undefined) event.price = typeof price === 'number' && price >= 0 ? price : event.price;
            if (capacity !== undefined) {
                const newCapacity = typeof capacity === 'number' && capacity > 0 ? Math.floor(capacity) : null;
                if (newCapacity !== null) {
                    const sold = getTickets().filter((t) => t.eventId === id && t.status !== 'cancelled').length;
                    if (newCapacity < sold) throw Object.assign(new Error(`Capacity cannot be below sold tickets (${sold})`), { status: 400 });
                }
                event.capacity = newCapacity;
            }
            if (active !== undefined) event.active = Boolean(active);

            if (Array.isArray(survey) && survey.length > 0) {
                const customSurvey = buildCustomSurveyDefinition(survey, surveyTitle);
                if (customSurvey) {
                    await store.update('surveyDefs', (defs) => {
                        defs.push(customSurvey);
                    });
                    event.surveyRef = customSurvey.id;
                }
            } else if (survey === 'default') {
                event.surveyRef = 'default';
            }

            event.updatedAt = new Date().toISOString();
            await store.replace('events', events);
            res.json({ message: 'Event updated', event });
        });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        console.error('Update event error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/admin/events/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await store.withLock(`event:${id}`, async () => {
            const events = getEvents();
            const event = events.find((entry) => entry.id === id);
            if (!event) throw Object.assign(new Error('Event not found'), { status: 404 });
            event.active = false;
            event.archivedAt = new Date().toISOString();
            await store.replace('events', events);
            res.json({ message: 'Event archived', event });
        });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        console.error('Delete event error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/admin/events', requireAdmin, (req, res) => {
    res.json({ events: getEvents().filter((event) => event.active !== false) });
});

app.get('/api/admin/tickets', requireAdmin, (req, res) => {
    const users = getUsers();
    const userMap = new Map(users.map((user) => [user.id, user]));
    const eventMap = new Map(getEvents().map((event) => [event.id, event]));
    const tickets = getTickets()
        .filter((ticket) => ticket.status !== 'cancelled')
        .filter((ticket) => {
            const event = eventMap.get(ticket.eventId);
            return event && event.active !== false;
        })
        .map((ticket) => {
            const user = userMap.get(ticket.userId);
            const event = eventMap.get(ticket.eventId);
            return {
                ...ticket,
                userEmail: user?.email || null,
                userPhone: user?.phone || null,
                eventActive: Boolean(event && event.active !== false)
            };
        })
        .sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));
    res.json({ tickets });
});

app.get('/api/admin/surveys', requireAdmin, (req, res) => {
    const users = getUsers();
    const userMap = new Map(users.map((user) => [user.id, user]));
    const eventMap = new Map(getEvents().map((event) => [event.id, event]));
    const surveys = getSurveys()
        .filter((survey) => {
            const event = eventMap.get(survey.eventId);
            return event && event.active !== false;
        })
        .map((survey) => {
            const user = userMap.get(survey.userId);
            const event = eventMap.get(survey.eventId);
            return {
                ...survey,
                userEmail: user?.email || null,
                userPhone: user?.phone || null,
                eventTitle: event ? event.title : survey.eventTitle,
                eventActive: Boolean(event && event.active !== false)
            };
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    res.json({ surveys });
});

app.get('/api/admin/events/:id/tickets', requireAdmin, (req, res) => {
    try {
        const event = getEvents().find((entry) => entry.id === req.params.id);
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const userMap = new Map(getUsers().map((user) => [user.id, user]));
        const tickets = getTickets()
            .filter((ticket) => ticket.eventId === req.params.id && ticket.status !== 'cancelled')
            .map((ticket) => {
                const user = userMap.get(ticket.userId);
                return { ...ticket, userEmail: user?.email || null, userPhone: user?.phone || null };
            })
            .sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));
        res.json({ event, tickets });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/admin/events/:id/surveys', requireAdmin, (req, res) => {
    try {
        const event = getEvents().find((entry) => entry.id === req.params.id);
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const userMap = new Map(getUsers().map((user) => [user.id, user]));
        const surveys = getSurveys()
            .filter((survey) => survey.eventId === req.params.id)
            .map((survey) => {
                const user = userMap.get(survey.userId);
                return { ...survey, userEmail: user?.email || null, userPhone: user?.phone || null };
            })
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        res.json({ event, surveys });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/admin/survey-defs', requireAdmin, (req, res) => {
    res.json({ defs: [{ id: 'default', title: 'Опитування за замовчуванням' }, ...getSurveyDefs()] });
});

app.get('/api/admin/archive/events', requireAdmin, (req, res) => {
    const events = getEvents()
        .filter((event) => event.active === false)
        .sort((a, b) => (b.archivedAt || b.createdAt).localeCompare(a.archivedAt || a.createdAt));
    res.json({ events });
});

app.get('/api/admin/archive/events/:id/tickets', requireAdmin, (req, res) => {
    try {
        const event = getEvents().find((entry) => entry.id === req.params.id);
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const userMap = new Map(getUsers().map((user) => [user.id, user]));
        const tickets = getTickets()
            .filter((ticket) => ticket.eventId === req.params.id && ticket.status !== 'cancelled')
            .map((ticket) => {
                const user = userMap.get(ticket.userId);
                return { ...ticket, userEmail: user?.email || null, userPhone: user?.phone || null };
            })
            .sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));
        res.json({ event, tickets });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/admin/archive/events/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await store.withLock(`event:${id}`, async () => {
            const events = getEvents();
            const event = events.find((entry) => entry.id === id);
            if (!event) throw Object.assign(new Error('Event not found'), { status: 404 });
            if (event.active !== false) {
                throw Object.assign(new Error('Active events cannot be permanently deleted. Archive it first'), { status: 400 });
            }

            await store.replace('events', events.filter((entry) => entry.id !== id));
            await store.replace('tickets', getTickets().filter((ticket) => ticket.eventId !== id));
            await store.replace('surveys', getSurveys().filter((survey) => survey.eventId !== id));
            await store.replace('feedback', getFeedback().filter((f) => f.eventId !== id));
            if (event.surveyRef && event.surveyRef !== 'default') {
                await store.replace('surveyDefs', getSurveyDefs().filter((def) => def.id !== event.surveyRef));
            }

            logSecurityEvent('EVENT_PERMANENTLY_DELETED', {
                eventId: id,
                eventTitle: event.title,
                adminId: req.user?.id || 'token'
            });
            res.json({ message: 'Event permanently deleted' });
        });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        console.error('Permanent delete error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/admin/archive/events/:id/surveys', requireAdmin, (req, res) => {
    try {
        const event = getEvents().find((entry) => entry.id === req.params.id);
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const userMap = new Map(getUsers().map((user) => [user.id, user]));
        const surveys = getSurveys()
            .filter((survey) => survey.eventId === req.params.id)
            .map((survey) => {
                const user = userMap.get(survey.userId);
                return { ...survey, userEmail: user?.email || null, userPhone: user?.phone || null };
            })
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        res.json({ event, surveys });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

const sendPage = (file) => (req, res) => {
    res.sendFile(path.join(config.publicDir, file));
};

const requireAdminPage = (file) => (req, res) => {
    const admin = verifyAdminToken(req.cookies?.admin_token);
    if (!admin) return res.status(404).send('Not found');
    res.sendFile(path.join(config.publicDir, file));
};

app.get('/', sendPage('index.html'));
app.get('/dashboard', sendPage('dashboard.html'));
app.get('/login', (req, res) => res.redirect(302, '/dashboard'));
app.get('/admin', requireAdminPage('admin.html'));
app.get('/admin-archive', requireAdminPage('admin-archive.html'));
app.get('/admin/scan', requireAdminPage('scan.html'));
app.get('/buy', sendPage('buy.html'));
app.get('/success', sendPage('success.html'));
app.get('/cancel', sendPage('cancel.html'));

function getGallery() {
    try {
        return store.get('gallery');
    } catch {
        return [];
    }
}

async function saveGallery(images) {
    await store.replace('gallery', images);
}

app.get('/api/gallery', (req, res) => {
    const images = getGallery().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ images });
});

app.post('/api/admin/gallery', requireAdmin, async (req, res) => {
    const { url, alt } = req.body || {};
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL required' });
    }
    const cleanUrl = url.trim();
    if (cleanUrl.length > 500) {
        return res.status(400).json({ error: 'URL too long' });
    }
    const images = getGallery();
    const image = {
        id: crypto.randomUUID(),
        url: cleanUrl,
        alt: sanitize(String(alt || '').trim()).slice(0, 100),
        createdAt: new Date().toISOString()
    };
    images.push(image);
    await saveGallery(images);
    res.status(201).json({ message: 'Image added', image });
});

app.post('/api/admin/upload', requireAdmin, (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            console.error('Upload error:', err.message);
            return res.status(400).json({ error: err.message || 'Помилка завантаження' });
        }
        if (!req.file) return res.status(400).json({ error: 'Файл не завантажено' });
        const url = '/uploads/' + req.file.filename;
        console.log('Upload success:', url, 'size:', req.file.size);
        res.json({ url });
    });
});

app.delete('/api/admin/gallery/:id', requireAdmin, async (req, res) => {
    let images = getGallery();
    const len = images.length;
    images = images.filter((img) => img.id !== req.params.id);
    if (images.length === len) {
        return res.status(404).json({ error: 'Image not found' });
    }
    await saveGallery(images);
    res.json({ message: 'Deleted' });
});

app.all('/api/admin/*', (req, res) => {
    res.status(404).json({ error: 'Not found' });
});

const start = async () => {
    await store.initialize();
    const uploadsDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const cleanupTimer = setInterval(() => {
        blacklistCleanup().catch((err) => {
            console.error('Blacklist cleanup error:', err);
        });
        cleanupPendingTickets().catch((err) => {
            console.error('Pending tickets cleanup error:', err);
        });
    }, 60 * 1000);
    cleanupTimer.unref?.();

    const server = app.listen(config.port, config.host, () => {
        console.log(`Project Iskra running at http://${config.host}:${config.port}`);
    });

    const shutdown = async () => {
        clearInterval(cleanupTimer);
        await store.flush();
        server.close(() => process.exit(0));
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
};

start().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});
