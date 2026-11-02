const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { createE2eEnvironment } = require('./e2e-environment.cjs');

// Run from a clean checkout so neither Nest nor generated Prisma loads workstation secrets.
assert.equal(existsSync(join(__dirname, '../.env')), false, 'Full-stack fixture requires a checkout without server/.env.');
process.env = { ...createE2eEnvironment(process.env), PORT: '3001' };
process.chdir(join(__dirname, '..'));
require('../dist/src/main.js');
