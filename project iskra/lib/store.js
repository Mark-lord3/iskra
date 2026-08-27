const fs = require('fs');
const path = require('path');

const clone = (value) => {
    if (typeof global.structuredClone === 'function') {
        return global.structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
};

const writeFileAtomic = async (filePath, value) => {
    const tmpPath = `${filePath}.tmp`;
    const content = JSON.stringify(value, null, 2);
    await fs.promises.writeFile(tmpPath, content, 'utf8');
    await fs.promises.rename(tmpPath, filePath);
};

const createStore = ({ baseDir, tables }) => {
    const cache = new Map();
    const meta = new Map();
    const writeQueues = new Map();
    const locks = new Map();

    const ensureBaseDir = async () => {
        await fs.promises.mkdir(baseDir, { recursive: true });
    };

    const getFilePath = (name) => {
        const entry = meta.get(name);
        if (!entry) throw new Error(`Unknown table: ${name}`);
        return entry.filePath;
    };

    const loadTable = async (name) => {
        const entry = meta.get(name);
        const raw = await fs.promises.readFile(entry.filePath, 'utf8');
        cache.set(name, JSON.parse(raw));
    };

    const queueWrite = (name, value) => {
        const filePath = getFilePath(name);
        const queued = (writeQueues.get(name) || Promise.resolve())
            .then(() => writeFileAtomic(filePath, value));
        writeQueues.set(name, queued.catch(() => {}));
        return queued;
    };

    const acquireLock = (key, timeout = 5000) => new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const attempt = () => {
            if (!locks.has(key)) {
                locks.set(key, true);
                resolve(() => locks.delete(key));
                return;
            }
            if (Date.now() - startedAt >= timeout) {
                reject(new Error(`Lock timeout: ${key}`));
                return;
            }
            setTimeout(attempt, 10);
        };
        attempt();
    });

    return {
        async initialize() {
            await ensureBaseDir();
            for (const [name, table] of Object.entries(tables)) {
                const filePath = path.join(baseDir, table.file);
                meta.set(name, { filePath, defaultValue: clone(table.defaultValue) });
                try {
                    await fs.promises.access(filePath, fs.constants.F_OK);
                } catch {
                    await writeFileAtomic(filePath, clone(table.defaultValue));
                }
                await loadTable(name);
            }
        },

        get(name) {
            if (!cache.has(name)) throw new Error(`Table is not loaded: ${name}`);
            return clone(cache.get(name));
        },

        async replace(name, value) {
            const cloned = clone(value);
            cache.set(name, cloned);
            await queueWrite(name, cloned);
            return clone(cloned);
        },

        async update(name, updater) {
            return this.withLock(`table:${name}`, async () => {
                const current = this.get(name);
                const draft = clone(current);
                const maybeNext = await updater(draft, current);
                const nextValue = maybeNext === undefined ? draft : maybeNext;
                return this.replace(name, nextValue);
            });
        },

        async withLock(key, handler, timeout = 5000) {
            const release = await acquireLock(key, timeout);
            try {
                return await handler();
            } finally {
                release();
            }
        },

        async flush() {
            await Promise.all(Array.from(writeQueues.values()));
        },

        stats() {
            const result = {};
            for (const name of cache.keys()) {
                const value = cache.get(name);
                result[name] = Array.isArray(value) ? value.length : 1;
            }
            return result;
        }
    };
};

module.exports = {
    createStore,
    clone
};
