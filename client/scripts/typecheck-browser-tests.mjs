import { readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const clientRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sources = [];

function collectTypeScript(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) collectTypeScript(path);
        else if (entry.name.endsWith('.ts')) sources.push(relative(clientRoot, path));
    }
}

collectTypeScript(join(clientRoot, 'e2e'));
collectTypeScript(join(clientRoot, 'full-stack'));
sources.push('playwright.config.ts', 'playwright.full-stack.config.ts');

const result = spawnSync(process.execPath, [
    join(clientRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
    '--noEmit',
    '--module', 'esnext',
    '--moduleResolution', 'bundler',
    '--target', 'es2022',
    '--strict',
    '--esModuleInterop',
    '--skipLibCheck',
    ...sources.sort(),
], {
    cwd: clientRoot,
    stdio: 'inherit',
    env: process.env,
});

if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
