import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

const appRoute = /^\/(?:login|forgot-password|legal-consent|onboarding|(?:sql-explorer|nosql-explorer|admin|teams|billing)(?:\/.*)?)$/;
const contentTypes: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };

export function publicRouting(): Plugin {
    return {
        name: 'data-explorer-public-routing',
        configurePreviewServer(server) {
            const directory = path.resolve(server.config.root, server.config.build.outDir);
            const routes = JSON.parse(readFileSync(path.join(directory, 'public-routes.json'), 'utf8')) as { path: string }[];
            const publicPaths = new Set(routes.map(route => route.path));
            server.middlewares.use((request, response, next) => {
                if (request.method !== 'GET' && request.method !== 'HEAD') return next();
                const url = new URL(request.url ?? '/', 'http://127.0.0.1');
                if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return next();
                let pathname: string;
                try { pathname = decodeURIComponent(url.pathname); } catch { response.statusCode = 400; response.end('Invalid URL'); return; }
                const canonical = pathname === '/index.html' ? '/' : pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
                if (publicPaths.has(canonical) && canonical !== pathname) {
                    response.statusCode = 308;
                    response.setHeader('Location', `${canonical}${url.search}`);
                    response.end();
                    return;
                }
                let file: string | undefined;
                if (publicPaths.has(pathname)) file = pathname === '/' ? 'index.html' : `${pathname.slice(1)}.html`;
                else if (appRoute.test(pathname)) {
                    file = 'app.html';
                    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
                } else {
                    const target = path.resolve(directory, `.${pathname}`);
                    if (target.startsWith(`${directory}${path.sep}`) && existsSync(target) && path.extname(target)) {
                        response.setHeader('X-Content-Type-Options', 'nosniff');
                        return next();
                    }
                    file = '404.html';
                    response.statusCode = 404;
                    response.setHeader('X-Robots-Tag', 'noindex, follow');
                }
                const target = path.join(directory, file);
                if (!existsSync(target)) { response.statusCode = 404; response.end('Not found'); return; }
                response.setHeader('Content-Type', contentTypes[path.extname(target)] ?? 'application/octet-stream');
                response.setHeader('Cache-Control', 'no-cache');
                response.setHeader('X-Content-Type-Options', 'nosniff');
                response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' http://localhost:3001 http://127.0.0.1:* https:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
                response.end(request.method === 'HEAD' ? undefined : readFileSync(target));
            });
        },
    };
}
