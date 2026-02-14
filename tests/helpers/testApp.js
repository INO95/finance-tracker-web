const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { createApp } = require('../../src/app');

const REPO_ROOT = path.join(__dirname, '../..');

function request({ port, method = 'GET', pathname, body, headers = {} }) {
    return new Promise((resolve, reject) => {
        const payload = body != null ? JSON.stringify(body) : null;
        const req = http.request(
            {
                host: '127.0.0.1',
                port,
                method,
                path: pathname,
                headers: {
                    ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
                    ...headers,
                },
            },
            res => {
                let raw = '';
                res.on('data', chunk => {
                    raw += chunk;
                });
                res.on('end', () => {
                    let json = null;
                    try {
                        json = raw ? JSON.parse(raw) : null;
                    } catch {
                        json = null;
                    }
                    resolve({ status: res.statusCode, headers: res.headers, raw, json });
                });
            },
        );

        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

async function createTestApp({ storageDriver = 'sqlite', apiToken = '', seedSqlitePath = '' } = {}) {
    const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'finance-tracker-web-'));
    const dataDir = path.join(tempRoot, 'data');
    const configDir = path.join(tempRoot, 'config');

    await fs.promises.mkdir(dataDir, { recursive: true });
    await fs.promises.mkdir(configDir, { recursive: true });

    const config = {
        categories: {
            식비: { icon: '🍽️' },
            기타: { icon: '📦' },
        },
        paymentMethods: {
            현금: { type: 'cash' },
            스미토모: { type: 'bank' },
        },
        financePolicy: {
            realFoodBudgetMonthlyYen: 60000,
            creditCards: [],
        },
    };

    await fs.promises.writeFile(path.join(configDir, 'default.json'), JSON.stringify(config, null, 2), 'utf8');

    if (storageDriver === 'json') {
        const initialDb = {
            config: {
                schemaVersion: 2,
                currency: 'JPY',
                owner: '',
                last_updated: null,
            },
            transactions: [],
            liabilities: { creditCards: {} },
            categories: [],
        };
        await fs.promises.writeFile(path.join(dataDir, 'finance_db.json'), JSON.stringify(initialDb, null, 2), 'utf8');
    }

    if (storageDriver === 'sqlite' && seedSqlitePath) {
        await fs.promises.copyFile(seedSqlitePath, path.join(dataDir, 'finance_db.sqlite'));
    }

    const app = createApp({
        port: 0,
        host: '127.0.0.1',
        dataDir,
        configDir,
        staticDir: path.join(REPO_ROOT, 'public'),
        storageDriver,
        schemaPath: path.join(REPO_ROOT, 'data/schema.sql'),
        apiToken,
        corsOrigin: '*',
    });

    await app.start();
    const address = app.server.address();
    const port = address && typeof address === 'object' ? address.port : 0;

    async function cleanup() {
        await app.close();
        await fs.promises.rm(tempRoot, { recursive: true, force: true });
    }

    return {
        app,
        port,
        tempRoot,
        request: args => request({ port, ...args }),
        cleanup,
    };
}

module.exports = {
    createTestApp,
};
