import AxeBuilder from '@axe-core/playwright';
import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { mockAuthenticatedApi, seedPersistedWorkspace } from './support/authenticated-api';

const publicPages = [
  { route: '/', canonical: 'https://data-explorer-editor.vercel.app' },
  { route: '/docs', canonical: 'https://data-explorer-editor.vercel.app/docs' },
  { route: '/changelog', canonical: 'https://data-explorer-editor.vercel.app/changelog' },
  { route: '/legal', canonical: 'https://data-explorer-editor.vercel.app/legal' },
  { route: '/privacy', canonical: 'https://data-explorer-editor.vercel.app/privacy' },
  { route: '/terms', canonical: 'https://data-explorer-editor.vercel.app/terms' },
  { route: '/en', canonical: 'https://data-explorer-editor.vercel.app/en' },
  { route: '/docs/editor', canonical: 'https://data-explorer-editor.vercel.app/docs/editor' },
  { route: '/docs/erd', canonical: 'https://data-explorer-editor.vercel.app/docs/erd' },
  { route: '/en/docs/results', canonical: 'https://data-explorer-editor.vercel.app/en/docs/results' },
] as const;

for (const pageInfo of publicPages) {
  test(`${pageInfo.route} has crawlable metadata`, async ({ page }) => {
    await page.goto(pageInfo.route);
    await expect(page).toHaveTitle(/Data Explorer/i);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', pageInfo.canonical);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('title')).toHaveCount(1);
    await expect(page.locator('meta[name="description"]')).toHaveCount(1);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    await expect(page.locator('link[hreflang="vi"]')).toHaveCount(1);
    await expect(page.locator('link[hreflang="en"]')).toHaveCount(1);
    await expect(page.locator('link[hreflang="x-default"]')).toHaveCount(1);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  });
}

for (const route of ['/', '/docs', '/changelog'] as const) {
  test(`${route} has no automatic WCAG A/AA violations`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations).toEqual([]);
  });
}

for (const theme of ['dark', 'light'] as const) {
  test(`landing ${theme} appearance stays independent and screenshots are compact and uncropped`, async ({ page }) => {
    await page.addInitScript(value => {
      if (!sessionStorage.getItem('landing-theme-test-initialized')) {
        localStorage.setItem('vite-ui-theme', value);
        localStorage.removeItem('data-explorer-landing-theme');
        sessionStorage.setItem('landing-theme-test-initialized', 'true');
      }
    }, theme);
    await page.route('http://localhost:3001/api/auth/refresh', route => route.fulfill({
      status: 401, json: { message: 'Unauthorized' },
      headers: { 'access-control-allow-origin': 'http://127.0.0.1:4173', 'access-control-allow-credentials': 'true' },
    }));
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(new RegExp(theme));
    await expect(page.locator('.landing-page')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'auto');
    const toggle = page.getByRole('button', { name: /^(Chuyển sang giao diện|Switch to)/ });
    await toggle.click();
    const other = theme === 'dark' ? 'light' : 'dark';
    await expect(page.locator('.landing-page')).toHaveAttribute('data-theme', other);
    await expect(page.locator('html')).toHaveClass(new RegExp(theme));
    expect(await page.evaluate(() => localStorage.getItem('vite-ui-theme'))).toBe(theme);
    await page.reload();
    await expect(page.locator('.landing-page')).toHaveAttribute('data-theme', other);
    await page.getByRole('button', { name: /^(Chuyển sang giao diện|Switch to)/ }).click();
    await expect(page.locator('.landing-page')).toHaveAttribute('data-theme', theme);

    for (const label of [/^Query\b/, /^Schema-ERD\b/, /^(Kết quả|Results)(?:\s|$)/]) {
      const tab = page.getByRole('tab', { name: label });
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      const image = page.locator('#workflows [role="tabpanel"][data-state="active"] img');
      await expect.poll(() => image.evaluate(element => {
        const screenshot = element as HTMLImageElement;
        return [screenshot.naturalWidth, screenshot.naturalHeight];
      })).toEqual([2880, 1800]);
      await expect.poll(() => image.evaluate(element => {
        const box = element.getBoundingClientRect();
        return Math.abs(box.width / box.height - 1.6);
      })).toBeLessThan(0.01);
      await expect(image).toHaveCSS('object-fit', 'contain');
      await expect.poll(() => image.evaluate(element => element.getBoundingClientRect().width)).toBeLessThanOrEqual(750);
      const src = await image.getAttribute('src');
      await expect(image.locator('..')).toHaveAttribute('href', src!);
      await expect(image.locator('..')).toHaveAttribute('target', '_blank');
    }
    const images = page.locator('.landing-page .lp-image-frame img');
    await expect(images).toHaveCount(3);
    const pause = page.getByRole('button', { name: /^(Tạm dừng chuyển động|Pause motion)$/ });
    await pause.click();
    await expect(page.locator('.landing-page')).toHaveAttribute('data-motion', 'paused');
    await expect(page.locator('.lp-stage-window').first()).toHaveCSS('animation-name', 'none');
    await expect(page.locator('.lp-stage-region .lp-db-tile').first()).toHaveCSS('animation-play-state', 'paused');
    await expect(page.locator('#demo img')).toHaveAttribute('src', '/images/landing/workspace.webp');
    await expect(page.locator('#demo [role="tablist"]')).toHaveCount(0);
    const heroImage = page.locator('#demo img');
    await expect.poll(() => heroImage.evaluate(element => element.getBoundingClientRect().width)).toBeLessThanOrEqual(650);
    await page.getByRole('button', { name: /^(Bật chuyển động|Enable motion)$/ }).click();
    await expect(page.locator('.landing-page')).toHaveAttribute('data-motion', 'active');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: test.info().outputPath(`landing-${theme}-compact.png`), fullPage: true });
    const violations = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(violations.violations).toEqual([]);
  });
}

test('landing product captures have distinct bytes at their full intrinsic size', async ({ page, request }) => {
  const assets = ['workspace', 'query', 'schema-erd', 'results', 'ai-review'];
  const hashes = [];
  for (const name of assets) {
    const response = await request.get(`/images/landing/${name}.webp`);
    expect(response.ok()).toBe(true);
    hashes.push(createHash('sha256').update(await response.body()).digest('hex'));
  }
  expect(new Set(hashes).size).toBe(assets.length);
  await page.goto('/images/landing/query.webp');
  await expect.poll(() => page.locator('img').evaluate(element => {
    const image = element as HTMLImageElement;
    return [image.naturalWidth, image.naturalHeight];
  })).toEqual([2880, 1800]);
});

test('landing reduced motion stops stage and rail without hiding content', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.lp-stage-window')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.lp-engine-track')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.lp-hero-copy')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.lp-engine-list[aria-hidden="true"]')).toBeHidden();
  await expect(page.locator('.lp-engine-list').first().getByRole('listitem')).toHaveCount(9);
  await page.locator('#workflows').scrollIntoViewIfNeeded();
  await expect(page.getByRole('tab', { name: /^Query\b/ })).toBeVisible();
  await expect(page.locator('#workflows [role="tabpanel"][data-state="active"]')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.lp-button-primary').first()).toHaveCSS('transition-duration', '0s');
});

test('landing content stays visible without IntersectionObserver', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'IntersectionObserver', { value: undefined, configurable: true }));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.locator('#workflows').scrollIntoViewIfNeeded();
  await expect(page.getByRole('tab', { name: /^Query\b/ })).toBeVisible();
  await expect(page.locator('#workflows')).toHaveCSS('opacity', '1');
  await expect(page.locator('.landing-page footer')).toBeVisible();
});

test('landing mobile menu restores focus on Escape and FAQ opens from the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const menu = page.getByRole('button', { name: /^(Bật\/tắt menu|Toggle menu)$/ });
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#landing-mobile-nav')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#landing-mobile-nav')).toHaveCount(0);
  await expect(menu).toBeFocused();
  const summary = page.locator('.landing-page details summary').first();
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(summary.locator('..')).toHaveAttribute('open', '');
  await expect(summary.locator('..').locator('p')).toBeVisible();
});

test('landing image viewer preserves the full image, closes with Escape and restores focus', async ({ page }) => {
  await page.goto('/');
  const opener = page.locator('#demo a[href="/images/landing/workspace.webp"]');
  await opener.click();
  const viewer = page.getByRole('dialog', { name: /^(Giao diện sản phẩm|Product interface)$/ });
  await expect(viewer).toBeVisible();
  await expect(viewer.locator('img')).toHaveAttribute('src', '/images/landing/workspace.webp');
  await expect.poll(() => viewer.locator('img').evaluate(element => {
    const image = element as HTMLImageElement;
    return [image.naturalWidth, image.naturalHeight];
  })).toEqual([2880, 1800]);
  await expect(viewer.locator('img')).toHaveCSS('object-fit', 'contain');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(viewer).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('landing image viewer handles Escape without closing the open background mobile menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const menu = page.getByRole('button', { name: /^(Bật\/tắt menu|Toggle menu)$/ });
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  const opener = page.locator('#demo a[href="/images/landing/workspace.webp"]');
  await opener.focus();
  await opener.press('Enter');
  const viewer = page.getByRole('dialog', { name: /^(Giao diện sản phẩm|Product interface)$/ });
  await expect(viewer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(viewer).toHaveCount(0);
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#landing-mobile-nav')).toBeVisible();
  await expect(opener).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toBeFocused();
});

test('landing automatic motion pauses for focus, hidden tabs, and offscreen content', async ({ page }) => {
  await page.goto('/');
  await page.mouse.move(0, 0);
  await expect(page.locator('.lp-stage-region')).toHaveAttribute('data-running', 'true');
  const tile = page.locator('.lp-stage-region .lp-db-tile').first();
  const before = await tile.evaluate(element => getComputedStyle(element).translate);
  await expect.poll(() => tile.evaluate(element => getComputedStyle(element).translate)).not.toBe(before);
  await page.locator('#demo a.lp-screenshot-link').focus();
  await expect(page.locator('.lp-stage-region')).toHaveAttribute('data-running', 'false');
  await expect(tile).toHaveCSS('animation-play-state', 'paused');
  await page.locator('#demo .lp-button-primary').focus();
  await expect(page.locator('.lp-stage-region')).toHaveAttribute('data-running', 'true');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.lp-stage-region')).toHaveAttribute('data-running', 'false');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.lp-stage-region')).toHaveAttribute('data-running', 'true');
  await page.locator('#get-started').scrollIntoViewIfNeeded();
  await expect(page.locator('.lp-stage-region')).toHaveAttribute('data-running', 'false');
  await expect(page.locator('.lp-engine-rail')).toHaveAttribute('data-running', 'false');
});

test('landing anchors keep their targets', async ({ page }) => {
  await page.goto('/');
  for (const anchor of ['features', 'demo', 'pricing']) {
    await expect(page.locator(`#${anchor}`)).toHaveCount(1);
    await expect(page.locator(`header a[href="#${anchor}"]`)).toHaveCount(1);
  }
});

for (const lang of ['vi', 'en'] as const) {
  test(`landing header keeps its ${lang} navigation centered without overlapping controls`, async ({ page }) => {
    await page.setViewportSize({ width: 1917, height: 900 });
    await page.goto(lang === 'en' ? '/en' : '/');

    for (const width of [1917, 1440, 1280, 1101]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.locator('.lp-desktop-nav')).toBeVisible();
      await expect.poll(() => page.locator('.lp-header-inner').evaluate(element => {
        const header = element.closest('header')!.getBoundingClientRect();
        const nav = element.querySelector('.lp-desktop-nav')!.getBoundingClientRect();
        return Math.abs(nav.left + nav.width / 2 - (header.left + header.width / 2));
      })).toBeLessThanOrEqual(1);
      await expect.poll(() => page.locator('.lp-header-inner').evaluate(element => {
        const brand = element.querySelector('.lp-brand')!.getBoundingClientRect();
        const nav = element.querySelector('.lp-desktop-nav')!.getBoundingClientRect();
        const actions = element.querySelector('.lp-header-actions')!.getBoundingClientRect();
        return Math.min(nav.left - brand.right, actions.left - nav.right);
      })).toBeGreaterThanOrEqual(16);
      await expect.poll(() => page.locator('.lp-header-actions').evaluate(element => {
        const language = element.querySelector('.lp-header-language > div')!.getBoundingClientRect();
        const github = element.querySelector('.lp-github-link')!.getBoundingClientRect();
        const theme = element.querySelector('button[aria-label*="giao diện"],button[aria-label*="theme"]')!.getBoundingClientRect();
        const workspace = element.querySelector('.lp-header-cta')!.getBoundingClientRect();
        return Math.max(language.height, github.height, theme.height, workspace.height) - Math.min(language.height, github.height, theme.height, workspace.height);
      })).toBeLessThanOrEqual(1);
      await expect.poll(() => page.locator('.lp-header-language').evaluate(element => {
        const control = element.firstElementChild!.getBoundingClientRect();
        const links = Array.from(element.querySelectorAll('a')).map(link => link.getBoundingClientRect());
        return {
          height: control.height,
          separatorVisible: Array.from(element.querySelectorAll('span[aria-hidden="true"]')).some(separator => getComputedStyle(separator).display !== 'none'),
          minLinkHeight: Math.min(...links.map(link => link.height)),
        };
      })).toEqual({ height: 46, separatorVisible: false, minLinkHeight: 44 });
    }

    for (const width of [1100, 1024, 901, 900, 768, 600, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.locator('.lp-desktop-nav')).toBeHidden();
      const menu = page.locator('.lp-menu-button');
      await expect(menu).toBeVisible();
      await menu.click();
      const language = page.locator('#landing-mobile-nav').getByRole('link', { name: 'EN', exact: true });
      await expect(language).toBeVisible();
      await expect(language).toHaveAttribute('href', '/en');
      const languageBox = await language.boundingBox();
      expect(languageBox!.height).toBeGreaterThanOrEqual(44);
      expect(languageBox!.width).toBeGreaterThanOrEqual(44);
      await page.keyboard.press('Escape');
      await expect(menu).toBeFocused();
      await expect.poll(() => page.locator('.lp-header-inner').evaluate(element => {
        const brand = element.querySelector('.lp-brand')!.getBoundingClientRect();
        const actions = element.querySelector('.lp-header-actions')!.getBoundingClientRect();
        return actions.left - brand.right;
      })).toBeGreaterThanOrEqual(8);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    }
  });
}

test('public hydration preserves full content, metadata and CSP without loading editor assets', async ({ page }) => {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.goto('/');
  await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
  await expect(page.locator('title')).toHaveCount(1);
  await expect(page.locator('meta[name="description"]')).toHaveCount(1);
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.locator('#get-started')).toBeVisible();
  expect(errors).toEqual([]);
  expect(requests.filter(url => /vendor-monaco|vendor-editor|editor\.worker|json\.worker/.test(url))).toEqual([]);
});

test('public content and language links work before JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL: 'http://127.0.0.1:4173' });
  const page = await context.newPage();
  try {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('#pricing')).toBeVisible();
    await expect(page.locator('#get-started')).toBeVisible();
    await expect(page.locator('meta[name="description"]')).toHaveCount(1);
    await expect(page.locator('title')).toHaveCount(1);
    await expect(page.locator('#demo a.lp-screenshot-link')).toHaveAttribute('href', '/images/landing/workspace.webp');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('.lp-header-language').getByRole('link', { name: 'EN', exact: true }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Complex data.');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.goto('/en/docs/editor');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('SQL Editor');
    await expect(page.locator('main')).toHaveCount(1);
  } finally {
    await context.close();
  }
});

test('public URL routing, OG image and sitemap expose correct HTTP contracts', async ({ request }) => {
  const direct = await request.get('/docs/editor');
  expect(direct.status()).toBe(200);
  const html = await direct.text();
  expect(html).toContain('Trình soạn thảo SQL');
  expect(html).toContain('data-public-rendered');
  expect(html).not.toContain('data-static-content');
  for (const [aliasPath, canonical] of [['/docs/editor/', '/docs/editor'], ['/docs/editor.html?from=alias', '/docs/editor?from=alias'], ['/index.html?from=alias', '/?from=alias']]) {
    const alias = await request.get(aliasPath, { maxRedirects: 0 });
    expect(alias.status()).toBe(308);
    expect(alias.headers().location).toBe(canonical);
  }
  for (const path of ['/missing-public-page', '/docs/missing-section', '/images/missing-image.png']) {
    expect((await request.get(path)).status()).toBe(404);
  }
  const og = await request.get('/og-image.png');
  expect(og.status()).toBe(200);
  expect(og.headers()['content-type']).toMatch(/^image\/png/);
  const bytes = await og.body();
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(bytes.readUInt32BE(16)).toBe(1200);
  expect(bytes.readUInt32BE(20)).toBe(630);
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml).toContain('https://data-explorer-editor.vercel.app/en/docs/editor');
  expect(xml).not.toMatch(/\/sql-explorer|\/admin|<lastmod>2026-06-22/);
  const login = await request.get('/login');
  expect(login.headers()['x-robots-tag']).toContain('noindex');
});

test('public language switch preserves docs location and Back/Forward history', async ({ page }) => {
  await page.goto('/docs/editor');
  const english = page.locator('header').getByRole('link', { name: 'EN', exact: true });
  await english.click();
  await expect(page).toHaveURL(/\/en\/docs\/editor$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('SQL Editor');
  await page.goBack();
  await expect(page).toHaveURL(/\/docs\/editor$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/en\/docs\/editor$/);
});

for (const viewport of [{ width: 320, height: 568 }, { width: 667, height: 375 }, { width: 844, height: 390 }]) {
  test(`landing menu permits signed-in touch navigation at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockAuthenticatedApi(page);
    await page.goto('/');
    await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
    await expect(page.locator('#demo').getByRole('link', { name: /^(Mở workspace|Open workspace)$/ })).toHaveAttribute('href', '/sql-explorer');
    const menu = page.getByRole('button', { name: /^(Bật\/tắt menu|Toggle menu)$/ });
    await menu.click();
    const nav = page.locator('#landing-mobile-nav');
    const logout = nav.getByRole('button', { name: /^(Đăng xuất|Logout)$/ });
    await logout.scrollIntoViewIfNeeded();
    const hit = await logout.evaluate(element => {
      const box = element.getBoundingClientRect();
      const target = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return Boolean(target && (element === target || element.contains(target)));
    });
    expect(hit).toBe(true);
    const navBox = await nav.boundingBox();
    expect(navBox!.y + navBox!.height).toBeLessThanOrEqual(viewport.height + 1);
    const language = nav.getByRole('link', { name: 'EN', exact: true });
    await language.scrollIntoViewIfNeeded();
    const languageBox = await language.boundingBox();
    expect(languageBox!.height).toBeGreaterThanOrEqual(44);
    expect(languageBox!.width).toBeGreaterThanOrEqual(44);
    await expect(nav).toHaveCSS('overflow-y', 'auto');
    await page.keyboard.press('Escape');
    await expect(menu).toBeFocused();
  });
}

test('public in-app navigation restores workspace metadata and saved locale on Back', async ({ page }) => {
  await mockAuthenticatedApi(page);
  await seedPersistedWorkspace(page, { lang: 'en', activeConnectionId: 'connection-e2e', activeDatabase: 'analytics' });
  await page.goto('/sql-explorer');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('Data Explorer');
  const brand = page.getByTestId('workspace-header').locator('div.cursor-pointer');
  await expect(brand).toHaveCount(1);
  await brand.click();
  await expect(page).toHaveURL('http://127.0.0.1:4173/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://data-explorer-editor.vercel.app');
  await expect(page.locator('title')).toHaveCount(1);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
  await page.goBack();
  await expect(page).toHaveURL(/\/sql-explorer$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('Data Explorer');
  await expect(page.locator('title')).toHaveCount(1);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
});

for (const theme of ['light', 'dark'] as const) {
  test(`public non-landing pages preserve the ${theme} workspace theme`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem('vite-ui-theme', value), theme);
    for (const path of ['/docs', '/en/changelog', '/privacy']) {
      await page.goto(path);
      await expect(page.locator('html')).toHaveClass(new RegExp(theme));
      await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
      await expect(page.locator('html')).toHaveClass(new RegExp(theme));
      expect(await page.evaluate(() => localStorage.getItem('vite-ui-theme'))).toBe(theme);
    }
  });
}

for (const width of [320, 390]) {
  test(`Docs installation supports touch navigation and keyboard scrolling at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/docs/editor');
    await page.getByRole('button', { name: 'Open documentation menu', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Close documentation menu', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await page.locator('#public-docs-menu').getByRole('link', { name: 'Cài đặt', exact: true }).click();
    await expect(page).toHaveURL(/\/docs\/installation$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Cài đặt');
    await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
    await page.evaluate(() => document.fonts.ready);
    const blocks = page.locator('.public-docs main .bg-slate-950.overflow-x-auto');
    await expect(blocks).not.toHaveCount(0);
    for (const block of await blocks.all()) await expect(block).toHaveAttribute('tabindex', '0');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 320, height: 844 });
    await expect.poll(() => blocks.evaluateAll(elements => elements.some(element => element.scrollWidth > element.clientWidth + 1))).toBe(true);
    const geometry = await blocks.evaluateAll(elements => elements.map((element, index) => ({ index, overflow: element.scrollWidth - element.clientWidth })));
    const overflowing = geometry.find(block => block.overflow > 1);
    expect(overflowing).toBeDefined();
    const code = blocks.nth(overflowing!.index);
    await expect(code).toHaveAttribute('tabindex', '0');
    await code.focus();
    await expect(code).toBeFocused();
    const before = await code.evaluate(element => element.scrollLeft);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => code.evaluate(element => element.scrollLeft)).toBeGreaterThan(before);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
  });
}

test('public footer shortcuts retain the current language', async ({ page }) => {
  await page.goto('/en/changelog');
  const footer = page.locator('footer');
  const docs = footer.getByRole('link', { name: 'Documentation', exact: true });
  const changelog = footer.getByRole('link', { name: 'Changelog', exact: true });
  await expect(docs).toHaveCount(2);
  await expect(changelog).toHaveCount(2);
  for (const link of await docs.all()) await expect(link).toHaveAttribute('href', '/en/docs');
  for (const link of await changelog.all()) await expect(link).toHaveAttribute('href', '/en/changelog');
});

test('guest CTA goes to login and keeps a real href', async ({ page }) => {
  await page.goto('/');
  const cta = page.locator('#demo').getByRole('link', { name: /^(Mở workspace|Open workspace)$/ });
  await expect(cta).toHaveAttribute('href', '/login');
  await cta.click();
  await expect(page).toHaveURL(/\/login$/);
});

test('authenticated CTA and landing appearance preserve workspace ownership', async ({ page }) => {
  await mockAuthenticatedApi(page);
  await seedPersistedWorkspace(page, { lang: 'vi', activeConnectionId: 'connection-e2e', activeDatabase: 'analytics' });
  await page.goto('/');
  const cta = page.locator('#demo').getByRole('link', { name: /^(Mở workspace|Open workspace)$/ });
  await expect(cta).toHaveAttribute('href', '/sql-explorer');
  const appTheme = await page.locator('html').getAttribute('class');
  await page.getByRole('button', { name: /^(Chuyển sang giao diện|Switch to)/ }).click();
  await expect(page.locator('html')).toHaveAttribute('class', appTheme!);
});

test('pricing cards keep the workspace path for their CTAs', async ({ page }) => {
  await page.goto('/#pricing');
  const cards = page.locator('#pricing a.lp-button');
  await expect(cards).toHaveCount(3);
  for (const card of await cards.all()) await expect(card).toHaveAttribute('href', '/sql-explorer');
});

test('landing offers verified web, local Docker and source paths instead of a fake app download', async ({ page }) => {
  await page.goto('/');
  const access = page.locator('#get-started');
  await expect(access.getByRole('link', { name: /^(Xem Quick Start|Read Quick Start)$/ })).toHaveAttribute('href', 'https://github.com/KasierBach/Data-Explorer-Editor#quick-start');
  await expect(access.getByRole('link', { name: /^(Mở GitHub|View on GitHub)$/ })).toHaveAttribute('href', 'https://github.com/KasierBach/Data-Explorer-Editor');
  await expect(page.locator('header').getByRole('link', { name: 'GitHub', exact: true })).toHaveAttribute('href', 'https://github.com/KasierBach/Data-Explorer-Editor');
  await expect(page.locator('footer').getByRole('link', { name: /^(Báo lỗi|Report an issue)$/ })).toHaveAttribute('href', 'https://github.com/KasierBach/Data-Explorer-Editor/issues');
  await expect(page.getByRole('link', { name: /Download|Tải ứng dụng/i })).toHaveCount(0);
});
