const sanitize = (input) => {
    if (typeof input !== 'string') return '';
    let clean = input.normalize('NFKC').trim();
    clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    clean = clean.replace(/[<>]/g, '');
    clean = clean.replace(/(?:javascript|data|vbscript|blob|file|ftp):/gi, '');
    clean = clean.replace(/expression\s*\(/gi, '');
    clean = clean.replace(/(-moz-binding|behavior)\s*:/gi, '');
    clean = clean.replace(/on\w+\s*=/gi, '');
    clean = clean.replace(/&(?:lt|gt|#60|#x3[cC]|#62|#x3[eE]|#0);?/gi, '');
    clean = clean.replace(/foreignObject/gi, '');
    if (clean.length > 10000) clean = clean.slice(0, 10000);
    return clean;
};

const validateEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    if (email.length > 254) return false;
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
};

const validatePhone = (phone) => {
    if (!phone || typeof phone !== 'string') return false;
    if (phone.length > 30) return false;
    if (!/^\+?[\d\s\-\(\)]{10,20}$/.test(phone)) return false;
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
};

const validatePassword = (pw) => {
    if (!pw || typeof pw !== 'string') return { ok: false, error: 'Invalid password' };
    if (pw.length < 6 || pw.length > 128) return { ok: false, error: 'Password must be 6-128 characters' };
    if (!/[A-Z]/.test(pw)) return { ok: false, error: 'Password must contain an uppercase letter' };
    if (!/[0-9]/.test(pw)) return { ok: false, error: 'Password must contain a digit' };
    return { ok: true };
};

const isJunk = (str) => {
    if (!str || typeof str !== 'string') return true;
    const s = str.trim();
    if (s.length < 2) return true;
    const letters = s.replace(/[^a-zA-Zа-яА-ЯїЇіІєЄґҐёЁ]/g, '');
    if (letters.length < 2) return true;
    const unique = new Set(s.toLowerCase()).size;
    if (s.length >= 4 && unique <= 1) return true;
    if (/^(.)\1{3,}$/.test(s)) return true;
    if (/^[a-zA-Zа-яА-ЯїЇіІєЄґҐёЁ]{1,2}\d{2,}$/.test(s) && letters.length < 2) return true;
    return false;
};

const validateText = (text, fieldName, min = 1, max = 1000) => {
    if (!text || typeof text !== 'string') {
        return { ok: false, error: `${fieldName} is required` };
    }
    const clean = sanitize(text);
    if (clean.length < min) {
        return { ok: false, error: `${fieldName} must be at least ${min} characters` };
    }
    if (clean.length > max) {
        return { ok: false, error: `${fieldName} must be less than ${max} characters` };
    }
    if (isJunk(clean)) {
        return { ok: false, error: `Please enter valid ${fieldName}` };
    }
    return { ok: true, value: clean };
};

const validateDate = (date) => {
    if (!date || typeof date !== 'string') return { ok: false, error: 'Invalid date' };
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return { ok: false, error: 'Invalid date format' };
    return { ok: true, value: date };
};

const validateNumber = (num, fieldName, min = 0, max = Number.MAX_SAFE_INTEGER) => {
    if (typeof num !== 'number' || Number.isNaN(num)) {
        return { ok: false, error: `${fieldName} must be a number` };
    }
    if (num < min || num > max) {
        return { ok: false, error: `${fieldName} must be between ${min} and ${max}` };
    }
    return { ok: true, value: num };
};

const validateSurveyText = (value, fieldName) => {
    if (!value || typeof value !== 'string' || value.trim().length < 1) {
        return { ok: false, error: `${fieldName} is required` };
    }
    const clean = sanitize(value);
    if (clean.length < 2 || isJunk(clean)) {
        return { ok: false, error: `Please enter valid ${fieldName}` };
    }
    return { ok: true, value: clean };
};

const sanitizeQuestionKey = (value, fallback = 'question') => {
    const base = sanitize(String(value || fallback))
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
    let key = base || fallback;
    if (!/^[a-z]/.test(key)) key = `q_${key}`;
    return key.slice(0, 50);
};

const normalizeSurveyQuestions = (survey = []) => {
    const usedKeys = new Set();
    const normalized = [];

    for (const rawQuestion of survey) {
        if (!rawQuestion || !rawQuestion.key || !rawQuestion.label) continue;

        let key = sanitizeQuestionKey(rawQuestion.key, `question_${normalized.length + 1}`);
        while (usedKeys.has(key)) {
            key = sanitizeQuestionKey(`${key}_${normalized.length + 1}`);
        }
        usedKeys.add(key);

        const type = rawQuestion.type === 'choice'
            ? 'choice'
            : rawQuestion.type === 'number'
                ? 'number'
                : 'text';

        const question = {
            key,
            label: sanitize(String(rawQuestion.label)).slice(0, 200),
            type,
            required: Boolean(rawQuestion.required),
            max: typeof rawQuestion.max === 'number'
                ? rawQuestion.max
                : type === 'number'
                    ? 3
                    : type === 'choice'
                        ? 100
                        : 300
        };

        if (type === 'choice') {
            const options = Array.isArray(rawQuestion.options)
                ? rawQuestion.options
                    .map((option) => sanitize(String(option)).slice(0, 100))
                    .filter(Boolean)
                : [];
            if (options.length === 0) continue;
            question.options = options;
        }

        normalized.push(question);
    }

    return normalized;
};

const maskEmail = (email) => {
    if (!email || typeof email !== 'string' || !email.includes('@')) return null;
    const [local, domain] = email.split('@');
    if (!local || !domain) return null;
    const safeLocal = local.length <= 2
        ? `${local[0] || '*'}*`
        : `${local.slice(0, 2)}***`;
    return `${safeLocal}@${domain}`;
};

const maskPhone = (phone) => {
    if (!phone || typeof phone !== 'string') return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return '***';
    return `***${digits.slice(-4)}`;
};

const maskIdentifier = (value) => {
    if (!value || typeof value !== 'string') return null;
    if (value.includes('@')) return maskEmail(value);
    return maskPhone(value) || '***';
};

const maskIp = (ip) => {
    if (!ip || typeof ip !== 'string') return null;
    if (ip.includes(':')) {
        const parts = ip.split(':').filter(Boolean);
        return parts.slice(0, 2).join(':') + ':***';
    }
    const parts = ip.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.***.***`;
    return '***';
};

const sanitizeLogDetails = (details = {}) => {
    const out = {};
    for (const [key, value] of Object.entries(details)) {
        if (value == null) continue;
        if (key === 'email' || key === 'buyerEmail') out[key] = maskEmail(value);
        else if (key === 'phone' || key === 'buyerPhone') out[key] = maskPhone(value);
        else if (key === 'identifier') out[key] = maskIdentifier(value);
        else if (key === 'ip') out[key] = maskIp(value);
        else if (key === 'userAgent') out[key] = 'redacted';
        else if (key.toLowerCase().includes('token')) out[key] = 'redacted';
        else out[key] = value;
    }
    return out;
};

module.exports = {
    sanitize,
    validateEmail,
    validatePhone,
    validatePassword,
    validateText,
    validateDate,
    validateNumber,
    isJunk,
    validateSurveyText,
    sanitizeQuestionKey,
    normalizeSurveyQuestions,
    sanitizeLogDetails
};
