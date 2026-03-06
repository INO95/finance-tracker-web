const path = require('path');
const { JsonRepository } = require('./jsonRepository');

function createStorage({
    financeDbPath,
    dataDir,
    sqlitePath,
    schemaPath,
    driver,
} = {}) {
    const selectedDriver = String(driver || process.env.FINANCE_STORAGE_DRIVER || 'sqlite').toLowerCase();
    const baseDataDir = dataDir || path.join(__dirname, '../../data');
    const jsonPath = financeDbPath || path.join(baseDataDir, 'finance_db.json');
    const dbPath = sqlitePath || process.env.FINANCE_SQLITE_PATH || path.join(baseDataDir, 'finance_db.sqlite');
    const sqlSchemaPath = schemaPath || path.join(__dirname, '../../data/schema.sql');

    if (selectedDriver === 'json') {
        return new JsonRepository({ financeDbPath: jsonPath, dataDir: baseDataDir });
    }

    if (selectedDriver === 'sqlite') {
        try {
            const { SqliteRepository } = require('./sqliteRepository');
            return new SqliteRepository({ sqlitePath: dbPath, schemaPath: sqlSchemaPath });
        } catch (error) {
            const missingSqliteDependency = error
                && error.code === 'MODULE_NOT_FOUND'
                && String(error.message || '').includes("'better-sqlite3'");
            if (missingSqliteDependency) {
                const wrapped = new Error('sqlite storage requires installed better-sqlite3 dependency. Run `npm ci` first.');
                wrapped.cause = error;
                throw wrapped;
            }
            throw error;
        }
    }

    throw new Error(`Unsupported storage driver: ${selectedDriver}`);
}

module.exports = {
    createStorage,
};
