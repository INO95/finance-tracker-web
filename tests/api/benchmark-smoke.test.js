const test = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { promisify } = require('util');

const runExecFile = promisify(execFile);

test('benchmark script runs and emits pass result on smoke profile', async () => {
    const scriptPath = path.join(__dirname, '../../scripts/benchmark-transactions.js');
    const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'finance-bench-smoke-'));
    const outputJsonPath = path.join(tempRoot, 'result.json');
    const { stdout } = await runExecFile(process.execPath, [
        scriptPath,
        '--rows', '600',
        '--warmup', '3',
        '--measured', '8',
        '--limit', '50',
        '--p95-threshold-ms', '10000',
        '--output-json', outputJsonPath,
    ]);

    assert.match(stdout, /Benchmark Result/);
    assert.match(stdout, /"pass":\s*true/);

    const result = JSON.parse(await fs.promises.readFile(outputJsonPath, 'utf8'));
    assert.equal(result.pass, true);
    assert.equal(result.endpoint, '/api/finance/transactions');
    await fs.promises.rm(tempRoot, { recursive: true, force: true });
});
