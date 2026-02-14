const path = require('path');
const { JsonRepository } = require('./jsonRepository');
const { SqliteRepository } = require('./sqliteRepository');

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
        return new SqliteRepository({ sqlitePath: dbPath, schemaPath: sqlSchemaPath });
    }

    throw new Error(`Unsupported storage driver: ${selectedDriver}`);
}

module.exports = {
    createStorage,
};
