import type { Plugin } from 'vite';

type Node = Record<string, unknown>;

function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && 'type' in value;
}

export function recoveryImportUrl(specifier: string, baseUrl: string, search: string): string {
  const marker = new URLSearchParams(search).get('_recovery');
  if (!marker || !/^[a-z0-9_]{1,80}$/.test(marker)) return specifier;
  const url = new URL(specifier, baseUrl);
  if (!url.pathname.startsWith('/assets/') || /^\/assets\/_recovery\/[a-z0-9_]{1,80}\//.test(url.pathname)) return specifier;
  const file = url.pathname.slice('/assets/'.length);
  if (!/^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(file)) return specifier;
  url.pathname = `/assets/_recovery/${marker}/${file}`;
  return url.href;
}

export function recoverChunkImports(code: string, parse: (code: string) => unknown): string | null {
  if (!code.includes('import(')) return null;
  const pending: unknown[] = [parse(code)];
  const imports: Array<{ start: number; end: number }> = [];
  while (pending.length) {
    const node = pending.pop();
    if (!isNode(node)) continue;
    const source = node.source;
    if (node.type === 'ImportExpression' && isNode(source) && source.type === 'Literal'
      && typeof source.value === 'string' && /^\.{1,2}\/[^?#]+\.js$/.test(source.value)
      && typeof source.start === 'number' && typeof source.end === 'number') {
      imports.push({ start: source.start, end: source.end });
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) pending.push(...value);
      else if (isNode(value)) pending.push(value);
    }
  }
  if (!imports.length) return null;
  let name = '__dataExplorerRecoveryImport';
  while (code.includes(name)) name += '_';
  let result = code;
  for (const { start, end } of imports.sort((a, b) => b.start - a.start)) {
    result = `${result.slice(0, start)}${name}(${result.slice(start, end)})${result.slice(end)}`;
  }
  // Only the document entry chooses the namespace; relative static and dynamic imports then share it.
  const helper = `function ${name}(specifier){return (${recoveryImportUrl.toString()})(specifier,import.meta.url,typeof window==="undefined"?"":window.location.search);}`;
  return `${helper}\n${result}`;
}

export function chunkRecovery(): Plugin {
  return {
    name: 'data-explorer-chunk-recovery',
    apply: 'build',
    // The late rewrite must participate in filenames as well as artifact checksums.
    augmentChunkHash(chunk) {
      return chunk.isEntry && chunk.dynamicImports.length ? `${isNode.toString()}\n${recoveryImportUrl.toString()}\n${recoverChunkImports.toString()}` : undefined;
    },
    generateBundle: {
      // Vite has finalized its preload/CSS dependency lists before this hook runs.
      order: 'post',
      handler(_options, bundle) {
        for (const chunk of Object.values(bundle)) {
          if (chunk.type !== 'chunk' || !chunk.isEntry) continue;
          const transformed = recoverChunkImports(chunk.code, source => this.parse(source));
          if (transformed !== null) chunk.code = transformed;
        }
      },
    },
  };
}
