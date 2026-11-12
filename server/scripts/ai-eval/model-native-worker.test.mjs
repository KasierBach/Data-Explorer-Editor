import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MODEL_NATIVE_CASES,
  parseModelNativeCommand,
} from './model-native-worker.mjs';

test('native worker admits only the three fixed assessment case IDs', () => {
  assert.deepEqual(MODEL_NATIVE_CASES, [
    'sql-count-null',
    'mongo-null-or-missing',
    'sql-null-note',
  ]);
  for (const [index, caseId] of MODEL_NATIVE_CASES.entries()) {
    assert.deepEqual(
      parseModelNativeCommand(
        JSON.stringify({
          id: index + 1,
          action: 'execute',
          caseId,
        }),
      ),
      { id: index + 1, action: 'execute', caseId },
    );
  }
});

test('native worker refuses query text, paths and arbitrary commands', () => {
  for (const command of [
    {
      id: 1,
      action: 'execute',
      caseId: 'sql-count-null',
      query: 'DROP TABLE orders',
    },
    { id: 1, action: 'execute', caseId: 'unknown' },
    { id: 1, action: 'shell', caseId: 'sql-count-null' },
    { id: 0, action: 'execute', caseId: 'sql-count-null' },
    { id: 1, action: 'close', path: '../private' },
    { id: 1, action: 'execute', caseId: '__proto__' },
  ])
    assert.throws(
      () => parseModelNativeCommand(JSON.stringify(command)),
      /MODEL_NATIVE_COMMAND_INVALID/,
    );
});

test('native worker bounds commands and rejects duplicate or prototype keys', () => {
  for (const input of [
    '{"id":1,"id":2,"action":"close"}',
    '{"id":1,"action":"close","__proto__":null}',
    '{"id":1,"action":"close","protot\\u0079pe":null}',
    '{"id":1,"action":"close","constr\\u0075ctor":null}',
  ])
    assert.throws(
      () => parseModelNativeCommand(input),
      /MODEL_NATIVE_COMMAND_INVALID/,
    );
  assert.throws(
    () =>
      parseModelNativeCommand(
        JSON.stringify({ id: 1, action: 'close', padding: 'x'.repeat(3000) }),
      ),
    /MODEL_NATIVE_COMMAND_INVALID/,
  );
  assert.deepEqual(parseModelNativeCommand('{"id":1,"action":"close"}'), {
    id: 1,
    action: 'close',
  });
});
