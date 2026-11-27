// @vitest-environment node
import { fileURLToPath } from 'node:url';
import { parseAst } from 'rollup/parseAst';
import { build, type Plugin } from 'vite';
import { describe, expect, it } from 'vitest';
import { chunkRecovery, recoverChunkImports, recoveryImportUrl } from '../scripts/chunk-recovery';
import { recoveryAssetPath } from '../scripts/public-routing';

const transform = (code: string) => recoverChunkImports(code, parseAst);

function recoveryUrl(search: string, browser = true) {
  return recoveryImportUrl('./view.js', 'https://example.test/assets/index.js', browser ? search : '');
}

async function buildFixture(plugins: Plugin[] = []) {
  const sources: Record<string, string> = {
    '\0fixture-entry.js': 'globalThis.load=()=>import("./lazy.js");',
    '\0fixture-lazy.js': 'import "./lazy.css";export const ready=true;',
    '\0fixture-lazy.css': '.recovery-fixture { color: blue; }',
  };
  const result = await build({
    configFile: false,
    root: fileURLToPath(new URL('../', import.meta.url)),
    envDir: false,
    publicDir: false,
    logLevel: 'silent',
    plugins: [{
      name: 'chunk-recovery-fixture',
      resolveId(id) {
        if (id === 'fixture-entry') return '\0fixture-entry.js';
        if (id === './lazy.js') return '\0fixture-lazy.js';
        if (id === './lazy.css') return '\0fixture-lazy.css';
      },
      load(id) { return sources[id] ?? null; },
    }, ...plugins],
    build: {
      write: false,
      minify: true,
      rollupOptions: { input: 'fixture-entry', output: { entryFileNames: 'entry-[hash].js' } },
    },
  });
  if (Array.isArray(result) || !('output' in result)) throw new Error('Expected one completed fixture build');
  const entry = result.output.find(item => item.type === 'chunk' && item.isEntry);
  if (!entry || entry.type !== 'chunk') throw new Error('Missing fixture entry');
  const css = result.output.filter(item => item.type === 'asset' && item.fileName.endsWith('.css')).map(item => item.fileName);
  return { entry, css };
}

describe('built chunk recovery', () => {
  it('wraps only real relative module imports and preserves Vite preloads', () => {
    const source = 'const a=preload(()=>import("./view.js"),["./view.css"]);const b=import("../other.js");';
    const code = transform(source)!;
    expect(code).toContain('preload(()=>import(__dataExplorerRecoveryImport("./view.js")),["./view.css"])');
    expect(code).toContain('import(__dataExplorerRecoveryImport("../other.js"))');
    expect(() => parseAst(code)).not.toThrow();
  });

  it('does not rewrite text, comments, static imports or unrelated import specifiers', () => {
    const source = 'import value from "./shared.js";const example=\'import("./example.js")\';/* import("./comment.js") */function load(){return [import("package"),import("/absolute.js"),import("./style.css"),import("./worker.js?worker")]}';
    expect(transform(source)).toBeNull();
  });

  it('avoids colliding with an existing binding', () => {
    expect(transform('const __dataExplorerRecoveryImport=1;function load(){return import("./view.js")}'))
      .toContain('import(__dataExplorerRecoveryImport_("./view.js"))');
  });

  it.each(['', '?locale=en', '?_recovery=', '?_recovery=invalid%3Cvalue', `?_recovery=${'a'.repeat(81)}`])('preserves the normal URL for %s', search => {
    expect(recoveryUrl(search)).toBe('./view.js');
  });

  it('gives a user-requested recovery a fresh module URL without forwarding other query values', () => {
    expect(recoveryUrl('?token=SYNTHETIC_SECRET&_recovery=rs_')).toBe('https://example.test/assets/_recovery/rs_/view.js');
  });

  it('keeps static and dynamic imports in one recovery namespace without nesting it', () => {
    const entry = recoveryImportUrl('./main.js', 'https://example.test/assets/index.js', '?_recovery=rs');
    const editor = new URL('./QueryEditor.js', entry).href;
    expect(new URL('./AppShell.js', editor).href).toBe(new URL('./AppShell.js', entry).href);
    expect(new URL('./AppShell.js', entry).pathname).toBe('/assets/_recovery/rs/AppShell.js');
    expect(recoveryImportUrl('./view.js', entry, '?_recovery=rs')).toBe('./view.js');
    expect(recoveryImportUrl('../private.js', 'https://example.test/assets/index.js', '?_recovery=rs')).toBe('../private.js');
  });

  it.each(['main.js', 'vendor-core.css', 'editor.worker.js'])('maps only a flat recovery asset back to its sealed file (%s)', file => {
    expect(recoveryAssetPath(`/assets/_recovery/rs_1/${file}`)).toBe(`/assets/${file}`);
  });

  it.each([
    '/api/_recovery/rs/query', '/assets/main.js', '/assets/_recovery/rs/../secret',
    '/assets/_recovery/rs/%2e%2e%2fsecret', '/assets/_recovery/rs/nested/file.js',
    `/assets/_recovery/${'a'.repeat(81)}/main.js`, '/assets/_recovery/invalid-value/main.js',
  ])('rejects paths outside the bounded asset alias (%s)', pathname => {
    expect(recoveryAssetPath(pathname)).toBeNull();
  });

  it('does not require a browser global in server or worker contexts', () => {
    expect(recoveryUrl('', false)).toBe('./view.js');
  });

  it('preserves actual Vite CSS preloads and seals deterministic recovery-aware filenames', async () => {
    const normal = await buildFixture();
    const recovered = await buildFixture([chunkRecovery()]);
    expect(recovered.css).toHaveLength(1);
    expect(recovered.css).toEqual(normal.css);
    expect(recovered.entry.code).toContain(recovered.css[0]);
    expect(recovered.entry.code).toContain('__dataExplorerRecoveryImport');
    expect(recovered.entry.fileName).not.toBe(normal.entry.fileName);
    const repeated = await buildFixture([chunkRecovery()]);
    expect(repeated.entry.fileName).toBe(recovered.entry.fileName);
  });

  it('runs only for builds after Vite metadata is finalized and contributes to chunk hashes', () => {
    const plugin = chunkRecovery();
    expect(plugin.apply).toBe('build');
    expect(plugin.generateBundle).toMatchObject({ order: 'post' });
    expect(plugin.augmentChunkHash).toBeTypeOf('function');
  });
});
