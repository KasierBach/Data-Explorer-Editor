import assert from 'node:assert/strict';
import test from 'node:test';
import { findBlockingVulnerabilities } from './npm-audit.mjs';

const report = {
  vulnerabilities: {
    'react-router': {
      severity: 'high',
      via: [{ severity: 'high', source: 1, url: 'https://github.com/advisories/GHSA-QWWW-VCR4-C8H2' }],
    },
    'react-router-dom': { severity: 'high', via: ['react-router'] },
  },
};

test('fails closed when the advisory is not explicitly allowed', () => {
  assert.deepEqual(
    findBlockingVulnerabilities(report).map(({ name }) => name),
    ['react-router', 'react-router-dom'],
  );
});

test('allows only the exact advisory and its transitive package finding', () => {
  assert.deepEqual(
    findBlockingVulnerabilities(report, new Set(['GHSA-QWWW-VCR4-C8H2'])),
    [],
  );
});

test('does not hide a second advisory on an allowlisted package', () => {
  const withAnotherFinding = structuredClone(report);
  withAnotherFinding.vulnerabilities['react-router'].via.push({
    severity: 'critical',
    source: 2,
    url: 'https://github.com/advisories/GHSA-AAAA-BBBB-CCCC',
  });

  assert.deepEqual(
    findBlockingVulnerabilities(withAnotherFinding, new Set(['GHSA-QWWW-VCR4-C8H2'])).map(({ name }) => name),
    ['react-router', 'react-router-dom'],
  );
});
