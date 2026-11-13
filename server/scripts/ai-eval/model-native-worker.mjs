import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readJsonArtifact, validateCatalog } from './evaluator.mjs';
import { createNativeFixtures } from './native-replay.mjs';

export const MODEL_NATIVE_CASES = Object.freeze([
  'sql-count-null',
  'mongo-null-or-missing',
  'sql-null-note',
]);
const MAX_COMMAND_BYTES = 2048;
const commandError = () =>
  Object.assign(new Error('MODEL_NATIVE_COMMAND_INVALID'), {
    code: 'MODEL_NATIVE_COMMAND_INVALID',
  });

function record(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export function parseModelNativeCommand(input) {
  if (typeof input !== 'string' || Buffer.byteLength(input) > MAX_COMMAND_BYTES)
    throw commandError();
  const keys = [];
  const duplicateProbe = input.replace(
    /"((?:\\.|[^"\\])*)"\s*:/g,
    (_match, key) => {
      const decoded = JSON.parse(`"${key}"`);
      if (
        keys.includes(decoded) ||
        ['__proto__', 'prototype', 'constructor'].includes(decoded)
      )
        throw commandError();
      keys.push(decoded);
      return _match;
    },
  );
  void duplicateProbe;
  let value;
  try {
    value = JSON.parse(input);
  } catch (error) {
    if (error?.code === 'MODEL_NATIVE_COMMAND_INVALID') throw error;
    throw commandError();
  }
  if (
    !record(value) ||
    !Number.isSafeInteger(value.id) ||
    value.id < 1 ||
    value.id > 1000
  )
    throw commandError();
  if (value.action === 'close') {
    if (Object.keys(value).sort().join(',') !== 'action,id')
      throw commandError();
    return value;
  }
  if (
    value.action !== 'execute' ||
    Object.keys(value).sort().join(',') !== 'action,caseId,id' ||
    !MODEL_NATIVE_CASES.includes(value.caseId)
  )
    throw commandError();
  return value;
}

async function runWorker() {
  const catalogPath = fileURLToPath(
    new URL('./synthetic-catalog.v1.json', import.meta.url),
  );
  const catalog = validateCatalog((await readJsonArtifact(catalogPath)).data);
  const cases = new Map(catalog.cases.map((item) => [item.id, item]));
  const fixture = await createNativeFixtures(
    catalog,
    `a12_${randomUUID().replace(/-/g, '')}`,
  );
  const send = (value) => {
    const text = JSON.stringify(value);
    if (Buffer.byteLength(text) > 1024 * 1024)
      throw new Error('MODEL_NATIVE_RESPONSE_TOO_LARGE');
    process.stdout.write(`${text}\n`);
  };
  let closed = false;
  try {
    send({ type: 'ready' });
    const lines = createInterface({
      input: process.stdin,
      crlfDelay: Infinity,
    });
    for await (const line of lines) {
      let command;
      try {
        command = parseModelNativeCommand(line);
        if (command.action === 'close') {
          await fixture.close();
          closed = true;
          send({ id: command.id, ok: true, value: null });
          break;
        }
        const item = cases.get(command.caseId);
        const result = await fixture.execute(
          item.engine,
          item.expected.response.query,
        );
        send({ id: command.id, ok: true, value: result });
      } catch (error) {
        send({
          id: command?.id ?? null,
          ok: false,
          error: {
            code:
              typeof error?.code === 'string' &&
              /^(?:MODEL|NATIVE)_[A-Z0-9_]+$/.test(error.code)
                ? error.code
                : 'MODEL_NATIVE_EXECUTION_FAILED',
          },
        });
      }
    }
  } finally {
    if (!closed) await fixture.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runWorker().catch(() => {
    process.stderr.write('{"code":"MODEL_NATIVE_WORKER_FAILED"}\n');
    process.exitCode = 1;
  });
}
