const path = require('path');
const http = require('http');
const { createStorage } = require('./repository/storage');
const { createRouter } = require('./router');

function createApp(options = {}) {
    const port = Number(options.port ?? process.env.FINANCE_WEB_PORT ?? 4380);
    const host = options.host ?? process.env.FINANCE_WEB_HOST ?? '127.0.0.1';

    const dataDir = options.dataDir || path.join(__dirname, '../data');
    const configDir = options.configDir || path.join(__dirname, '../config');
    const staticDir = options.staticDir || path.join(__dirname, '../public');
    const financeDbPath = options.financeDbPath || path.join(dataDir, 'finance_db.json');
    const configPath = options.configPath || path.join(configDir, 'default.json');
    const sqlitePath = options.sqlitePath ?? process.env.FINANCE_SQLITE_PATH ?? path.join(dataDir, 'finance_db.sqlite');
    const schemaPath = options.schemaPath ?? path.join(__dirname, '../data/schema.sql');

    const storage = createStorage({
        driver: options.storageDriver ?? process.env.FINANCE_STORAGE_DRIVER ?? 'sqlite',
        financeDbPath,
        dataDir,
        sqlitePath,
        schemaPath,
    });

    const router = createRouter({
        storage,
        configPath,
        staticDir,
        corsOrigin: options.corsOrigin ?? process.env.FINANCE_CORS_ORIGIN ?? '*',
        requiredApiToken: options.apiToken != null ? options.apiToken : process.env.FINANCE_WEB_API_TOKEN,
    });

    const server = http.createServer((req, res) => {
        Promise.resolve(router(req, res)).catch(error => {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: 'internal_server_error', details: error.message }, null, 2));
        });
    });

    async function start() {
        if (storage && storage.ready && typeof storage.ready.then === 'function') {
            await storage.ready;
        }

        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(port, host, () => {
                server.off('error', reject);
                resolve();
            });
        });
    }

    async function close() {
        await new Promise(resolve => {
            if (!server.listening) {
                resolve();
                return;
            }
            server.close(() => resolve());
        });
        await storage.close();
    }

    return {
        port,
        host,
        server,
        storage,
        start,
        close,
    };
}

module.exports = {
    createApp,
};
