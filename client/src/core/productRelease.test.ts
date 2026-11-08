/// <reference types="node" />
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getChangelogPageContent } from '@/presentation/pages/changelogContent';
import { CURRENT_RELEASE, getReleaseDate, releaseAnchorId } from './productRelease';

const root = path.resolve(process.cwd(), '..');

describe('published product release', () => {
  it('matches the three product manifests without rewriting unrelated lock metadata', () => {
    expect(CURRENT_RELEASE).toEqual({ version: '1.6.7', tag: 'v1.6.7', date: '2026-09-02' });
    for (const manifestPath of ['package.json', 'client/package.json', 'server/package.json']) {
      const manifest = JSON.parse(readFileSync(path.join(root, manifestPath), 'utf8')) as { version: string };
      expect(manifest.version, manifestPath).toBe(CURRENT_RELEASE.version);
    }
    // Root lock 3.6.4 drift is tracked separately; this docs contract is about manifests/releases.
  });

  it.each([
    ['v1.6.7', 'release-v1-6-7'],
    ['v1.0.0', 'release-v1-0-0'],
    ['v1.6.0-alpha', 'release-v1-6-0-alpha'],
    ['2.10.3', 'release-2-10-3'],
  ])('creates the shared stable changelog anchor for %s', (version, anchor) => {
    expect(releaseAnchorId(version)).toBe(anchor);
  });

  it.each(['vi', 'en'] as const)('uses shared release anchors for every %s changelog entry', lang => {
    const { releases } = getChangelogPageContent(lang);
    const ids = releases.map(release => releaseAnchorId(release.version));
    expect(ids[0]).toBe('release-v1-6-7');
    expect(new Set(ids).size).toBe(releases.length);
    expect(ids.every(id => /^release-[a-zA-Z0-9-]+$/.test(id))).toBe(true);
  });

  it('localizes the exact published day consistently with the latest changelog', () => {
    const date = new Date(`${CURRENT_RELEASE.date}T00:00:00Z`);
    for (const lang of ['vi', 'en'] as const) {
      const expected = new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(date);
      expect(getReleaseDate(lang)).toBe(expected);
      const latest = getChangelogPageContent(lang).releases[0];
      expect(latest.version).toBe(CURRENT_RELEASE.tag);
      expect(latest.date).toBe(expected);
    }
    expect(getReleaseDate('vi')).not.toBe(getReleaseDate('en'));
    expect(getReleaseDate('en')).toBe('September 2, 2026');
    expect(CURRENT_RELEASE.date).not.toBe('2026-11-07');
  });
});
