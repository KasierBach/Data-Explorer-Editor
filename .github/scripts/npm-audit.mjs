import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BLOCKING_SEVERITIES = new Set(['high', 'critical']);

function advisoryIdsFor(name, vulnerabilities, visiting = new Set()) {
  if (visiting.has(name)) return new Set();
  const nextVisiting = new Set(visiting).add(name);
  const ids = new Set();

  for (const via of vulnerabilities[name]?.via ?? []) {
    if (typeof via === 'string') {
      for (const id of advisoryIdsFor(via, vulnerabilities, nextVisiting)) ids.add(id);
      continue;
    }
    if (!BLOCKING_SEVERITIES.has(via.severity)) continue;
    const advisoryId = via.url?.match(/GHSA-[\w-]+/i)?.[0]?.toUpperCase();
    ids.add(advisoryId ?? `SOURCE-${via.source}`);
  }

  return ids;
}

export function findBlockingVulnerabilities(report, allowedAdvisories = new Set()) {
  const vulnerabilities = report.vulnerabilities ?? {};

  return Object.entries(vulnerabilities).flatMap(([name, vulnerability]) => {
    if (!BLOCKING_SEVERITIES.has(vulnerability.severity)) return [];
    const advisoryIds = advisoryIdsFor(name, vulnerabilities);
    const unapproved = [...advisoryIds].filter((id) => !allowedAdvisories.has(id));
    return advisoryIds.size > 0 && unapproved.length === 0
      ? []
      : [{ name, severity: vulnerability.severity, advisoryIds: unapproved }];
  });
}

export function runAudit() {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCommand, ['audit', '--omit=dev', '--json'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (result.error || !result.stdout) {
    console.error(result.error?.message ?? result.stderr ?? 'npm audit returned no report');
    return 1;
  }

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    console.error(result.stdout);
    return 1;
  }

  const allowed = new Set(
    (process.env.NPM_AUDIT_ALLOW_GHSA ?? '')
      .split(',')
      .map((id) => id.trim().toUpperCase())
      .filter(Boolean),
  );
  const blocking = findBlockingVulnerabilities(report, allowed);

  if (blocking.length > 0) {
    console.error('Blocking npm audit findings:');
    for (const item of blocking) {
      console.error(`- ${item.name} (${item.severity}): ${item.advisoryIds.join(', ') || 'unresolved advisory'}`);
    }
    return 1;
  }

  const ignored = Object.values(report.vulnerabilities ?? {}).filter(
    (vulnerability) => BLOCKING_SEVERITIES.has(vulnerability.severity),
  ).length;
  console.log(`npm audit passed${ignored ? ` with ${ignored} allowlisted package finding(s)` : ''}.`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = runAudit();
}
