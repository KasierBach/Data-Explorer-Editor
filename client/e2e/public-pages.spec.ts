import AxeBuilder from '@axe-core/playwright';
import { createHash } from 'node:crypto';
import { expect, test, type BrowserContext, type Locator, type Page, type Request } from '@playwright/test';
import { mockAuthenticatedApi, seedPersistedWorkspace } from './support/authenticated-api';
import { DOCS_CATALOG, getDocTopic } from '../src/core/docs/docsCatalog';
import { getLegalDocument, type LegalDocKey } from '../src/presentation/public/legalContent';

type NavigationLanguage = 'vi' | 'en';
type NavigationPage = 'landing' | 'docs' | 'changelog';

const navigationLabels = {
  vi: ['Trang chủ', 'Tài liệu', 'Cập nhật'],
  en: ['Home', 'Documentation', 'Changelog'],
} as const;
const navigationPages: NavigationPage[] = ['landing', 'docs', 'changelog'];
const navigationPaths = { landing: '/', docs: '/docs', changelog: '/changelog' } as const;

function localizedNavigationPath(lang: NavigationLanguage, path: string) {
  return lang === 'en' ? (path === '/' ? '/en' : `/en${path}`) : path;
}

async function mockPublicNavigationSession(page: Page, authenticated = false) {
  if (authenticated) {
    await mockAuthenticatedApi(page);
    return;
  }
  await page.route('http://localhost:3001/api/auth/refresh', route => route.fulfill({
    status: 401,
    json: { message: 'Unauthorized' },
    headers: { 'access-control-allow-origin': 'http://127.0.0.1:4173', 'access-control-allow-credentials': 'true' },
  }));
}

async function expectPublicPageLinks(nav: Locator, lang: NavigationLanguage, currentPage: NavigationPage) {
  const links = nav.locator('.lp-header-link, .pe-nav-link');
  await expect(links).toHaveCount(3);
  await expect(links).toHaveText([...navigationLabels[lang]]);
  expect(await links.evaluateAll(elements => elements.map(element => element.tagName))).toEqual(['A', 'A', 'A']);
  await expect(nav.locator('.lp-header-link[aria-current="page"], .pe-nav-link[aria-current="page"]')).toHaveCount(1);
  for (const [index, kind] of navigationPages.entries()) {
    const link = links.nth(index);
    await expect(link).toHaveAttribute('href', localizedNavigationPath(lang, navigationPaths[kind]));
    await expect(link).not.toHaveAttribute('target', '_blank');
    if (kind === currentPage) await expect(link).toHaveAttribute('aria-current', 'page');
    else await expect(link).not.toHaveAttribute('aria-current', /.+/);
  }
}

async function visiblePublicPageNavigation(page: Page, kind: NavigationPage) {
  if (kind === 'docs') {
    const desktop = page.locator('.pe-doc-desktop-pages');
    if (await desktop.isVisible()) return desktop;
    const explore = page.locator('.pe-doc-explore');
    if (await explore.getAttribute('open') === null) await explore.locator(':scope > summary').click();
    return page.locator('.pe-doc-compact-pages');
  }
  if (kind === 'changelog') return page.locator('.pe-header-nav');
  const desktop = page.locator('.lp-desktop-nav');
  if (await desktop.isVisible()) return desktop;
  const menu = page.locator('.lp-menu-button');
  if (await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
  return page.locator('#landing-mobile-nav');
}

async function expectNavigationHitTargets(nav: Locator, fontSize: number) {
  for (const link of await nav.locator('.lp-header-link, .pe-nav-link').all()) {
    await expect(link).toBeVisible();
    await expect(link).toHaveCSS('font-size', `${fontSize}px`);
    const box = await link.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
}

async function expectCenteredPageNavigation(header: Locator, nav: Locator) {
  await expect(nav).toBeVisible();
  await expect.poll(async () => {
    const [headerBox, navBox, linkCenter] = await Promise.all([
      header.boundingBox(),
      nav.boundingBox(),
      nav.locator('.lp-header-link, .pe-nav-link').evaluateAll(elements => {
        const boxes = elements.map(element => element.getBoundingClientRect());
        return (Math.min(...boxes.map(box => box.left)) + Math.max(...boxes.map(box => box.right))) / 2;
      }),
    ]);
    if (!headerBox || !navBox) return Infinity;
    const headerCenter = headerBox.x + headerBox.width / 2;
    return Math.max(Math.abs(navBox.x + navBox.width / 2 - headerCenter), Math.abs(linkCenter - headerCenter));
  }).toBeLessThanOrEqual(1);
}

async function expectHeaderControlsNotOverlapping(header: Locator, includeExplore = false) {
  const selector = `a:visible, button:visible, input:visible${includeExplore ? ', .pe-doc-explore > summary:visible' : ''}`;
  await expect.poll(() => header.locator(selector).evaluateAll(elements => {
    const targets = elements.map(element => ({ label: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? element.tagName, box: element.getBoundingClientRect() }));
    const overlaps: string[] = [];
    for (const [index, target] of targets.entries()) {
      for (const other of targets.slice(index + 1)) {
        const width = Math.min(target.box.right, other.box.right) - Math.max(target.box.left, other.box.left);
        const height = Math.min(target.box.bottom, other.box.bottom) - Math.max(target.box.top, other.box.top);
        if (width > 1 && height > 1) overlaps.push(`${target.label} / ${other.label}`);
      }
    }
    return overlaps;
  })).toEqual([]);
}

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
    await expect(page.locator('.lp-stage-region .lp-data-packet').first()).toHaveCSS('animation-play-state', 'paused');
    await expect(page.locator('.lp-engine-rail')).toHaveCSS('animation-play-state', 'paused');
    await expect(page.locator('.lp-engine-rail')).toHaveAttribute('data-running', 'false');
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
  await expect(page.locator('.lp-data-packet').first()).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.lp-stage-scan')).toBeHidden();
  await expect(page.locator('.lp-ambient')).toBeVisible();
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

test('landing mobile menu closes on desktop resize without reopening when returning to mobile', async ({ page }) => {
  await mockPublicNavigationSession(page);
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto('/en');
  await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
  const menu = page.locator('.lp-menu-button');
  await expect(page.locator('.lp-desktop-nav')).toBeHidden();
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#landing-mobile-nav')).toBeVisible();
  await expectPublicPageLinks(page.locator('#landing-mobile-nav'), 'en', 'landing');
  await page.setViewportSize({ width: 1101, height: 900 });
  await expect(page.locator('.lp-desktop-nav')).toBeVisible();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#landing-mobile-nav')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#landing-mobile-nav')).toHaveCount(0);
  await menu.click();
  await expectPublicPageLinks(page.locator('#landing-mobile-nav'), 'en', 'landing');
  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toBeFocused();
});

for (const lang of ['vi', 'en'] as const) {
  test(`landing back-to-top ${lang} appears beyond the first viewport and focuses its native fragment`, async ({ page }) => {
    await mockPublicNavigationSession(page);
    await page.goto(localizedNavigationPath(lang, '/'));
    await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
    const target = page.locator('#landing-top');
    const backToTop = page.locator('a.lp-back-to-top');
    await expect(target).toHaveCount(1);
    await expect(target).toHaveAttribute('tabindex', '-1');
    await expect(target).toHaveCSS('position', 'absolute');
    await expect.poll(() => target.evaluate(element => Math.abs(element.getBoundingClientRect().height - innerHeight))).toBeLessThanOrEqual(1);
    await expect(backToTop).toHaveCount(1);
    await expect(backToTop).toHaveAttribute('href', '#landing-top');
    await expect(backToTop).toHaveAttribute('aria-label', lang === 'vi' ? 'Quay lên đầu trang' : 'Back to top');
    await expect(backToTop).toBeHidden();
    const firstViewport = await page.evaluate(() => innerHeight);
    await page.evaluate(height => window.scrollTo({ top: Math.floor(height / 2), behavior: 'instant' }), firstViewport);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    await expect(backToTop).toBeHidden();
    await page.evaluate(height => window.scrollTo({ top: height + 100, behavior: 'instant' }), firstViewport);
    await expect.poll(() => page.evaluate(() => scrollY - innerHeight)).toBeGreaterThan(0);
    await expect(backToTop).toBeVisible();
    const box = await backToTop.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await backToTop.click();
    await expect(page).toHaveURL(`http://127.0.0.1:4173${localizedNavigationPath(lang, '/')}#landing-top`);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThanOrEqual(1);
    await expect(target).toBeFocused();
    await expect(backToTop).toBeHidden();
  });
}

test('landing back-to-top uses its native fragment with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL: 'http://127.0.0.1:4173', viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  try {
    for (const lang of ['vi', 'en'] as const) {
      await page.goto(localizedNavigationPath(lang, '/'));
      const target = page.locator('#landing-top');
      const backToTop = page.getByRole('link', { name: lang === 'vi' ? 'Quay lên đầu trang' : 'Back to top', exact: true });
      await expect(target).toHaveAttribute('tabindex', '-1');
      await expect(backToTop).toHaveAttribute('href', '#landing-top');
      await expect(backToTop).toBeVisible();
      await page.locator('#get-started').scrollIntoViewIfNeeded();
      await expect.poll(() => page.evaluate(() => scrollY > innerHeight)).toBe(true);
      await backToTop.click();
      await expect(page).toHaveURL(`http://127.0.0.1:4173${localizedNavigationPath(lang, '/')}#landing-top`);
      await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThanOrEqual(1);
      await expect(target).toBeFocused();
    }
  } finally {
    await context.close();
  }
});

test('landing back-to-top respects a reduced-motion browser context', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', baseURL: 'http://127.0.0.1:4173', viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await mockPublicNavigationSession(page);
    await page.goto('/en');
    await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
    const backToTop = page.getByRole('link', { name: 'Back to top', exact: true });
    await expect(backToTop).toBeHidden();
    await page.locator('#get-started').scrollIntoViewIfNeeded();
    await expect(backToTop).toBeVisible();
    await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'auto');
    await expect(backToTop).toHaveCSS('transition-duration', '0s');
    await backToTop.click();
    await expect(page).toHaveURL(/\/en#landing-top$/);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThanOrEqual(1);
    await expect(page.locator('#landing-top')).toBeFocused();
    await expect(backToTop).toBeHidden();
  } finally {
    await context.close();
  }
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

test('landing automatic motion continues on hover and freezes on focus, hidden tabs, and offscreen content', async ({ page }) => {
  await page.goto('/');
  await page.mouse.move(0, 0);
  const region = page.locator('.lp-stage-region');
  const packet = page.locator('.lp-data-packet').first();
  const tile = region.locator('.lp-db-tile').first();
  const ambient = page.locator('.lp-ambient');
  const values = () => page.evaluate(() => {
    const ambient = document.querySelector('.lp-ambient')!;
    return {
      packet: getComputedStyle(document.querySelector('.lp-data-packet')!).strokeDashoffset,
      tile: getComputedStyle(document.querySelector('.lp-db-tile')!).translate,
      light: getComputedStyle(ambient, '::after').transform,
    };
  });
  await expect(region).toHaveAttribute('data-running', 'true');
  const hasPointerDepth = await page.evaluate(() => matchMedia('(min-width: 601px) and (hover: hover) and (pointer: fine)').matches);
  await expect(region).toHaveAttribute('data-depth-enabled', String(hasPointerDepth));
  const before = await values();
  await expect.poll(async () => (await values()).packet).not.toBe(before.packet);
  await expect.poll(async () => (await values()).tile).not.toBe(before.tile);
  await expect.poll(async () => (await values()).light).not.toBe(before.light);

  const box = await page.locator('.lp-product-stage').boundingBox();
  await page.mouse.move(box!.x + box!.width * 0.75, box!.y + box!.height * 0.3);
  await expect(region).toHaveAttribute('data-running', 'true');
  await expect(packet).toHaveCSS('animation-play-state', 'running');
  await expect(tile).toHaveCSS('animation-play-state', 'running');
  await expect.poll(() => ambient.evaluate(element => getComputedStyle(element, '::after').animationPlayState)).toBe('running');
  const hovered = await values();
  await expect.poll(async () => (await values()).packet).not.toBe(hovered.packet);
  await expect.poll(async () => (await values()).tile).not.toBe(hovered.tile);
  await expect.poll(async () => (await values()).light).not.toBe(hovered.light);
  await page.mouse.move(0, 0);
  await expect(region).toHaveAttribute('data-running', 'true');

  await page.locator('#demo a.lp-screenshot-link').focus();
  await expect(region).toHaveAttribute('data-running', 'false');
  await expect(region).toHaveAttribute('data-depth-enabled', 'false');
  await expect(tile).toHaveCSS('animation-play-state', 'paused');
  await expect(packet).toHaveCSS('animation-play-state', 'paused');
  await expect.poll(() => ambient.evaluate(element => getComputedStyle(element, '::before').animationPlayState)).toBe('paused');
  await page.locator('.lp-ambient, .lp-product-stage').evaluateAll(elements => Promise.all(
    elements.flatMap(element => element.getAnimations({ subtree: true })).map(animation => animation.ready),
  ));
  const focused = await values();
  await page.waitForTimeout(180);
  expect(await values()).toEqual(focused);
  await page.locator('#demo .lp-button-primary').focus();
  await expect(region).toHaveAttribute('data-running', 'true');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(region).toHaveAttribute('data-running', 'false');
  await expect.poll(() => ambient.evaluate(element => getComputedStyle(element, '::after').animationPlayState)).toBe('paused');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(region).toHaveAttribute('data-running', 'true');
  await page.locator('#get-started').scrollIntoViewIfNeeded();
  await expect(region).toHaveAttribute('data-running', 'false');
  await expect(page.locator('.lp-engine-rail')).toHaveAttribute('data-running', 'false');
  await expect.poll(() => ambient.evaluate(element => getComputedStyle(element, '::after').animationPlayState)).toBe('paused');
});

test('landing depth only moves decoration and disables at the mobile breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
  await page.evaluate(() => document.fonts.ready);
  const region = page.locator('.lp-stage-region');
  const stage = page.locator('.lp-product-stage');
  const decoration = page.locator('.lp-depth-decoration');
  const pointer = await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches);
  await expect(region).toHaveAttribute('data-depth-enabled', String(pointer));
  await expect(region).toHaveAttribute('data-running', 'true');
  const targets = page.locator('.lp-stage-window, #demo .lp-screenshot-link, #demo .lp-screenshot-caption, #demo .lp-hero-actions a');
  await expect.poll(() => page.locator('.lp-hero-copy').evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).m42)).toBe(0);
  const before = await targets.evaluateAll(elements => elements.map(element => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  }));
  const box = await stage.boundingBox();
  const transform = await decoration.evaluate(element => getComputedStyle(element).transform);
  await page.mouse.move(box!.x + box!.width * 0.85, box!.y + box!.height * 0.25);
  if (pointer) {
    await expect.poll(() => decoration.evaluate(element => getComputedStyle(element).transform)).not.toBe(transform);
  }
  expect(await targets.evaluateAll(elements => elements.map(element => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  }))).toEqual(before);
  await expect(page.locator('.lp-depth-layer').first()).toHaveCSS('pointer-events', 'none');

  await page.setViewportSize({ width: 600, height: 844 });
  await expect(region).toHaveAttribute('data-depth-enabled', 'false');
  const small = await stage.boundingBox();
  await page.mouse.move(small!.x + small!.width * 0.8, small!.y + small!.height * 0.3);
  for (const layer of await page.locator('.lp-depth-layer').all()) {
    await expect(layer).toHaveCSS('transform', 'none');
  }
  await expect(page.locator('.lp-data-route-2')).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 900, height: 900 });
  await page.mouse.move(0, 0);
  await expect(region).toHaveAttribute('data-depth-enabled', String(pointer));
});

test('landing flares run once on borders without translating workflow or AI hit targets', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
  await page.evaluate(() => document.fonts.ready);
  const feature = page.locator('.lp-features-section .lp-feature-card').first();
  await feature.scrollIntoViewIfNeeded();
  await expect(page.locator('.lp-features-section .lp-reveal')).toHaveClass(/is-active/);
  await expect.poll(() => feature.evaluate(element => getComputedStyle(element, '::after').animationName)).toBe('lp-border-flare');
  const workflow = page.locator('#workflows');
  await workflow.scrollIntoViewIfNeeded();
  await expect(page.locator('.lp-signal-section').first()).toHaveClass(/is-active/);
  await expect(page.locator('.lp-signal-section').first()).toHaveCSS('animation-name', 'none');
  const frame = workflow.locator('.lp-image-frame');
  await expect.poll(() => frame.evaluate(element => getComputedStyle(element, '::after').animationIterationCount)).toBe('1');
  await expect.poll(() => frame.evaluate(element => getComputedStyle(element, '::after').animationName)).toBe('lp-border-flare');
  const schemaTab = page.getByRole('tab', { name: /^Schema-ERD\b/ });
  await schemaTab.click();
  await expect(schemaTab).toHaveAttribute('aria-selected', 'true');
  await expect(workflow.locator('.lp-tabpanel[data-state="active"]')).toHaveCSS('animation-name', 'none');
  await expect(workflow.locator('.lp-tabpanel[data-state="active"]')).toHaveCSS('transform', 'none');
  await page.locator('.lp-ai-section').scrollIntoViewIfNeeded();
  await expect(page.locator('.lp-ai-section .lp-reveal')).toHaveCSS('animation-name', 'none');
  await expect.poll(() => page.locator('.lp-ai-section .lp-image-frame').evaluate(element => getComputedStyle(element, '::after').animationName)).toBe('lp-border-flare');
});

test('landing engine rail keeps moving on hover without a sweep over its labels and respects hidden tabs and manual pause', async ({ page }) => {
  await page.goto('/');
  const rail = page.locator('.lp-engine-rail');
  const track = rail.locator('.lp-engine-track');
  await rail.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await expect(rail).toHaveAttribute('data-running', 'true');
  const before = await track.evaluate(element => getComputedStyle(element).transform);
  await expect.poll(() => track.evaluate(element => getComputedStyle(element).transform)).not.toBe(before);
  const box = await rail.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(rail).toHaveAttribute('data-running', 'true');
  await expect(track).toHaveCSS('animation-play-state', 'running');
  await expect.poll(() => rail.evaluate(element => getComputedStyle(element, '::after').content)).toBe('none');
  const hovered = await track.evaluate(element => getComputedStyle(element).transform);
  await expect.poll(() => track.evaluate(element => getComputedStyle(element).transform)).not.toBe(hovered);
  await page.mouse.move(0, 0);
  await expect(rail).toHaveAttribute('data-running', 'true');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(rail).toHaveAttribute('data-running', 'false');
  await expect(track).toHaveCSS('animation-play-state', 'paused');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(rail).toHaveAttribute('data-running', 'true');
  await page.getByRole('button', { name: /^(Tạm dừng chuyển động|Pause motion)$/ }).click();
  await expect(rail).toHaveAttribute('data-running', 'false');
  await expect(track).toHaveCSS('animation-play-state', 'paused');
  await track.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.ready)));
  const frozen = await track.evaluate(element => getComputedStyle(element).transform);
  await page.waitForTimeout(180);
  expect(await track.evaluate(element => getComputedStyle(element).transform)).toBe(frozen);
});

test('landing anchors keep their targets without returning section links to the header', async ({ page }) => {
  await mockPublicNavigationSession(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
  for (const anchor of ['features', 'demo', 'pricing']) {
    await expect(page.locator(`#${anchor}`)).toHaveCount(1);
    await expect(page.locator(`.lp-landing-header a[href="#${anchor}"]`)).toHaveCount(0);
  }
  await expect(page.locator('#workflows')).toHaveCount(1);
  await expectPublicPageLinks(page.locator('.lp-desktop-nav'), 'vi', 'landing');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.lp-menu-button').click();
  await expectPublicPageLinks(page.locator('#landing-mobile-nav'), 'vi', 'landing');
  for (const anchor of ['features', 'demo', 'pricing']) {
    await expect(page.locator(`.lp-landing-header a[href="#${anchor}"]`)).toHaveCount(0);
    await expect(page.locator(`#${anchor}`)).toHaveCount(1);
  }
  await expect(page.locator('#landing-mobile-nav a[href="#get-started"]')).toHaveCount(1);
  await expect(page.locator('#pricing a.lp-button')).toHaveCount(3);
});

async function docsNavigationEvidence(page: Page) {
  await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
  await expect(page.locator('.public-docs')).toHaveAttribute('data-enhanced', 'true');
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  const documents: string[] = [];
  const stableNodes = await Promise.all(['.pe-doc-header', '.pe-doc-search input', '.pe-doc-filter'].map(async selector => {
    const node = await page.locator(selector).elementHandle();
    expect(node).not.toBeNull();
    return { selector, node: node! };
  }));
  page.on('request', (request: Request) => {
    if (request.resourceType() === 'document' && request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
  });
  return {
    timeOrigin,
    documents,
    async assertSameDocument() {
      await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
      await expect(page.locator('.public-docs')).toHaveAttribute('data-enhanced', 'true');
      expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
      expect(documents).toEqual([]);
      for (const { selector, node } of stableNodes) expect(await node.evaluate((original, currentSelector) => original.isSameNode(document.querySelector(currentSelector)), selector)).toBe(true);
    },
  };
}

async function expectDocsTopic(page: Page, id: string, heading: string, lang: NavigationLanguage = 'en', suffix = '') {
  const topic = getDocTopic(id)!;
  expect(topic).toBeDefined();
  const path = localizedNavigationPath(lang, `/docs/${id}`);
  await expect(page).toHaveURL(`http://127.0.0.1:4173${path}${suffix}`);
  await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
  await expect(page.locator('#root')).toHaveAttribute('data-public-path', path);
  await expect(page.locator('.public-docs')).toHaveAttribute('data-enhanced', 'true');
  await expect(page.locator('.public-docs')).toHaveAttribute('data-doc-page', id);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(heading);
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
  await expect(page).toHaveTitle(`${lang === 'vi' ? topic.title : topic.titleEn} | Data Explorer`);
  await expect(page.locator('title')).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://data-explorer-editor.vercel.app${path}`);
  await expect(page.locator('meta[name="description"]')).toHaveCount(1);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', lang === 'vi' ? topic.description : topic.descriptionEn);
  await expect(page.locator('.pe-doc-footer a')).toHaveAttribute('href', `https://github.com/KasierBach/Data-Explorer-Editor/edit/main/${topic.sourcePath}`);
  await expect(page.locator('.pe-doc-native-nav nav a[aria-current="page"]')).toHaveAttribute('href', path);
  await expect(page.locator('.pe-doc-language').getByRole('link', { name: lang === 'en' ? 'EN' : 'VN', exact: true })).toHaveAttribute('aria-current', 'page');
}

async function expectDocsReadingStart(page: Page) {
  await expect(page.locator('.pe-doc-article h1')).toBeFocused();
  await expect.poll(() => page.locator('.pe-doc-scroll').evaluate(element => element.scrollTop)).toBe(0);
  const positions = await page.locator('.pe-doc-scroll').evaluate(element => new Promise<number[]>(resolve => {
    requestAnimationFrame(() => {
      const first = element.scrollTop;
      requestAnimationFrame(() => resolve([first, element.scrollTop]));
    });
  }));
  expect(positions).toEqual([0, 0]);
}

for (const lang of ['vi', 'en'] as const) {
  test(`Docs articles ${lang} share the introduction width and align their footer`, async ({ page }) => {
    await mockPublicNavigationSession(page);
    await page.setViewportSize({ width: 1920, height: 900 });
    await page.goto(localizedNavigationPath(lang, '/docs/introduction'));
    const evidence = await docsNavigationEvidence(page);
    const introduction = (await page.locator('.pe-doc-intro').boundingBox())!;
    expect(introduction.width).toBe(1120);
    for (const id of ['first-query', 'editor', 'installation']) {
      const path = localizedNavigationPath(lang, `/docs/${id}`);
      await page.locator(`.pe-doc-sidebar .doc-sidebar-nav a[href="${path}"]`).click();
      await expect(page.locator('.public-docs')).toHaveAttribute('data-doc-page', id);
      await expect.poll(() => page.locator('.pe-doc-article').evaluate(element => element.getBoundingClientRect().width)).toBe(introduction.width);
      const article = (await page.locator('.pe-doc-article').boundingBox())!;
      const after = (await page.locator('.pe-doc-after').boundingBox())!;
      expect(Math.abs(article.x - introduction.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(after.x - article.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(after.width - article.width)).toBeLessThanOrEqual(1);
      await evidence.assertSameDocument();
    }
    for (const width of [1440, 844, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(() => page.locator('.pe-doc-scroll').evaluate(element => {
        const article = element.querySelector('.pe-doc-article')!.getBoundingClientRect();
        const after = element.querySelector('.pe-doc-after')!.getBoundingClientRect();
        return Math.max(Math.abs(article.width - Math.min(element.clientWidth, 1120)), Math.abs(after.width - article.width), Math.abs(after.left - article.left));
      })).toBeLessThanOrEqual(1);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    }
  });
}

test('Docs instant navigation keeps sidebar, previous/next and history in one document', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop sidebar scrolling is covered here; portalled touch navigation has its own case.');
  await mockPublicNavigationSession(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/en/docs/introduction');
  const evidence = await docsNavigationEvidence(page);
  const sidebar = page.locator('.pe-doc-sidebar');
  await sidebar.getByRole('link', { name: 'Installation', exact: true }).click();
  await expectDocsTopic(page, 'installation', 'Installation');
  await expectDocsReadingStart(page);
  await evidence.assertSameDocument();

  const articleScroll = page.locator('.pe-doc-scroll');
  await articleScroll.hover();
  await page.mouse.wheel(0, 600);
  await expect.poll(() => articleScroll.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  const pageScroll = await page.evaluate(() => scrollY);
  const sidebarScroll = await sidebar.evaluate(element => element.scrollTop);
  for (const [id, heading] of [['prerequisites', 'Prerequisites'], ['installation', 'Installation']] as const) {
    await test.step(`pointer previous/next → ${id}`, async () => {
      await page.locator(`.pe-doc-after > div a[href="/en/docs/${id}"]`).click();
      await expectDocsTopic(page, id, heading);
      await expectDocsReadingStart(page);
      expect(await page.evaluate(() => scrollY)).toBe(pageScroll);
      expect(await sidebar.evaluate(element => element.scrollTop)).toBe(sidebarScroll);
      await evidence.assertSameDocument();
    });
  }
  for (const [id, heading] of [['prerequisites', 'Prerequisites'], ['installation', 'Installation']] as const) {
    await test.step(`keyboard previous/next → ${id}`, async () => {
      const link = page.locator(`.pe-doc-after > div a[href="/en/docs/${id}"]`);
      await link.scrollIntoViewIfNeeded();
      await link.focus();
      await expect(link).toBeFocused();
      await expect.poll(() => articleScroll.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      await link.press('Enter');
      await expectDocsTopic(page, id, heading);
      await expectDocsReadingStart(page);
      expect(await page.evaluate(() => scrollY)).toBe(pageScroll);
      expect(await sidebar.evaluate(element => element.scrollTop)).toBe(sidebarScroll);
      await evidence.assertSameDocument();
    });
  }
  await sidebar.getByRole('link', { name: 'Monaco Editor', exact: true }).click();
  await expectDocsTopic(page, 'editor', 'SQL Editor');
  await expectDocsReadingStart(page);
  await evidence.assertSameDocument();
  for (const [id, heading] of [['installation', 'Installation'], ['prerequisites', 'Prerequisites'], ['installation', 'Installation']] as const) {
    await page.goBack();
    await expectDocsTopic(page, id, heading);
    await expectDocsReadingStart(page);
    await evidence.assertSameDocument();
  }
  for (const [id, heading] of [['prerequisites', 'Prerequisites'], ['installation', 'Installation'], ['editor', 'SQL Editor']] as const) {
    await page.goForward();
    await expectDocsTopic(page, id, heading);
    await expectDocsReadingStart(page);
    await evidence.assertSameDocument();
  }
});

test('Docs instant navigation preserves search click/Enter, query and Connections include/exclude filters', async ({ page }) => {
  await mockPublicNavigationSession(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/en/docs/installation');
  const evidence = await docsNavigationEvidence(page);
  const search = page.getByRole('combobox');
  const filter = page.locator('.pe-doc-filter');
  const menu = page.locator('.pe-doc-filter-menu');
  const catalog = menu.getByRole('group', { name: 'Documentation groups', exact: true });
  const modes = menu.getByRole('group', { name: 'Filter mode', exact: true });
  const connections = catalog.getByRole('menuitemradio', { name: /^Connections/ });
  const exclude = modes.getByRole('menuitemradio', { name: 'Exclude', exact: true });
  await search.fill('Monaco Editor');
  await expect(page.getByRole('option')).toHaveCount(1);
  await expect(page.getByRole('option')).toHaveAttribute('href', '/en/docs/editor');
  await page.getByRole('option').click();
  await expectDocsTopic(page, 'editor', 'SQL Editor');
  await expectDocsReadingStart(page);
  await expect(search).toHaveValue('Monaco Editor');
  await evidence.assertSameDocument();

  await filter.click();
  await connections.click();
  await search.fill('postgres');
  await expect(page.getByRole('option')).toHaveCount(1);
  await expect(page.getByRole('option')).toHaveAttribute('href', '/en/docs/postgres');
  await search.press('Escape');
  await page.locator('.pe-doc-sidebar').getByRole('link', { name: 'Installation', exact: true }).click();
  await expectDocsTopic(page, 'installation', 'Installation');
  await expect(search).toHaveValue('postgres');
  await expect(filter).toHaveAttribute('data-active', 'true');
  await expect(filter).toHaveAccessibleName('Filter: Include only · Connections');
  await filter.click();
  await expect(connections).toHaveAttribute('aria-checked', 'true');
  await expect(modes.getByRole('menuitemradio', { name: 'Include only', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await evidence.assertSameDocument();
  await search.click();
  await expect(page.getByRole('option')).toHaveCount(1);
  await expect(search).toHaveAttribute('aria-activedescendant', (await page.getByRole('option').getAttribute('id'))!);
  await search.press('Enter');
  await expectDocsTopic(page, 'postgres', 'PostgreSQL');
  await expectDocsReadingStart(page);
  await expect(page.locator('.pe-search-popover')).toHaveCount(0);
  await evidence.assertSameDocument();
  for (const direction of ['back', 'forward'] as const) {
    if (direction === 'back') await page.goBack();
    else await page.goForward();
    await expectDocsTopic(page, direction === 'back' ? 'installation' : 'postgres', direction === 'back' ? 'Installation' : 'PostgreSQL');
    await expectDocsReadingStart(page);
    await expect(search).toHaveValue('postgres');
    await expect(filter).toHaveAttribute('data-active', 'true');
    await expect(filter).toHaveAccessibleName('Filter: Include only · Connections');
    await evidence.assertSameDocument();
  }

  await filter.click();
  await exclude.click();
  await expect(menu).toHaveCount(0);
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('postgres');
  await expect(filter).toHaveAccessibleName('Filter: Exclude · Connections');
  await expect(page.getByRole('option')).toHaveCount(0);
  await expect(page.locator('.pe-search-popover').getByRole('status')).toContainText('0/0 topics');
  await search.fill('Monaco Editor');
  await expect(page.getByRole('option')).toHaveCount(1);
  await expect(page.getByRole('option')).toHaveAttribute('href', '/en/docs/editor');
  await page.getByRole('option').click();
  await expectDocsTopic(page, 'editor', 'SQL Editor');
  await expectDocsReadingStart(page);
  await expect(search).toHaveValue('Monaco Editor');
  await expect(filter).toHaveAccessibleName('Filter: Exclude · Connections');
  await evidence.assertSameDocument();

  await page.locator('.pe-doc-sidebar').getByRole('link', { name: 'Installation', exact: true }).click();
  await expectDocsTopic(page, 'installation', 'Installation');
  await expectDocsReadingStart(page);
  await expect(search).toHaveValue('Monaco Editor');
  await expect(filter).toHaveAccessibleName('Filter: Exclude · Connections');
  await evidence.assertSameDocument();
  await search.click();
  await expect(page.getByRole('option')).toHaveCount(1);
  await expect(search).toHaveAttribute('aria-activedescendant', (await page.getByRole('option').getAttribute('id'))!);
  await search.press('Enter');
  await expectDocsTopic(page, 'editor', 'SQL Editor');
  await expectDocsReadingStart(page);
  await expect(page.locator('.pe-search-popover')).toHaveCount(0);
  await evidence.assertSameDocument();
  for (const direction of ['back', 'forward'] as const) {
    if (direction === 'back') await page.goBack();
    else await page.goForward();
    await expectDocsTopic(page, direction === 'back' ? 'installation' : 'editor', direction === 'back' ? 'Installation' : 'SQL Editor');
    await expectDocsReadingStart(page);
    await expect(search).toHaveValue('Monaco Editor');
    await expect(filter).toHaveAttribute('data-active', 'true');
    await expect(filter).toHaveAccessibleName('Filter: Exclude · Connections');
    await filter.click();
    await expect(connections).toHaveAttribute('aria-checked', 'true');
    await expect(exclude).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    await expect(filter).toBeFocused();
    await expect(page.locator('.pe-search-popover')).toHaveCount(0);
    await evidence.assertSameDocument();
  }
});

test('Docs instant navigation updates locale, metadata and real query/hash links without reload', async ({ page }) => {
  await mockPublicNavigationSession(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  const suffix = '?from=instant#query';
  await page.goto(`/docs/editor${suffix}`);
  const evidence = await docsNavigationEvidence(page);
  const search = page.getByRole('combobox');
  await search.fill('Monaco');
  await search.press('Escape');
  const english = page.locator('.pe-doc-language').getByRole('link', { name: 'EN', exact: true });
  await expect(english).toHaveAttribute('href', `/en/docs/editor${suffix}`);
  await english.click();
  await expectDocsTopic(page, 'editor', 'SQL Editor', 'en', suffix);
  await expect(search).toHaveValue('Monaco');
  await evidence.assertSameDocument();
  await expect(page.locator('.pe-doc-language').getByRole('link', { name: 'VN', exact: true })).toHaveAttribute('href', `/docs/editor${suffix}`);
  await page.goBack();
  await expectDocsTopic(page, 'editor', 'Trình soạn thảo SQL', 'vi', suffix);
  await evidence.assertSameDocument();
  await page.goForward();
  await expectDocsTopic(page, 'editor', 'SQL Editor', 'en', suffix);
  await expect(search).toHaveValue('Monaco');
  await evidence.assertSameDocument();
});

test('Docs instant navigation delegates portalled drawer links and focuses the new article', async ({ page }) => {
  await mockPublicNavigationSession(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en/docs/editor');
  const evidence = await docsNavigationEvidence(page);
  const search = page.getByRole('combobox');
  await search.fill('Monaco');
  await search.press('Escape');
  const menu = page.locator('.pe-doc-menu');
  const dialog = page.getByRole('dialog', { name: 'Documentation navigation', exact: true });
  for (const [id, label, heading] of [['installation', 'Installation', 'Installation'], ['editor', 'Monaco Editor', 'SQL Editor']] as const) {
    await menu.click();
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(element => element.closest('.public-docs') === null)).toBe(true);
    const link = dialog.getByRole('link', { name: label, exact: true });
    await expect(link).toHaveAttribute('href', `/en/docs/${id}`);
    await link.click();
    await expect(dialog).toHaveCount(0);
    await expectDocsTopic(page, id, heading);
    await expectDocsReadingStart(page);
    await expect(search).toHaveValue('Monaco');
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await evidence.assertSameDocument();
  }
});

test('Docs instant navigation preserves native modified links and non-docs document navigation', async ({ page, context, isMobile }) => {
  test.skip(isMobile, 'Native modified and middle-button new-tab gestures require a desktop browser.');
  await context.route('http://localhost:3001/api/auth/refresh', route => route.fulfill({
    status: 401, json: { message: 'Unauthorized' },
    headers: { 'access-control-allow-origin': 'http://127.0.0.1:4173', 'access-control-allow-credentials': 'true' },
  }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/en/docs/editor');
  const evidence = await docsNavigationEvidence(page);
  const installation = page.locator('.pe-doc-sidebar').getByRole('link', { name: 'Installation', exact: true });
  for (const gesture of ['modified', 'middle'] as const) {
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      installation.click(gesture === 'modified' ? { modifiers: ['ControlOrMeta'] } : { button: 'middle' }),
    ]);
    try {
      await expectDocsTopic(popup, 'installation', 'Installation');
      await expectDocsTopic(page, 'editor', 'SQL Editor');
      await evidence.assertSameDocument();
    } finally { await popup.close(); }
  }
  await expect(page.locator('.pe-doc-footer a')).toHaveAttribute('target', '_blank');
  await expect(page.locator('.pe-doc-footer a')).toHaveAttribute('rel', /noopener/);
  await page.locator('.pe-doc-page-shortcuts').getByRole('link', { name: 'Product updates', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:4173/en/changelog');
  await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Changelog');
  expect(evidence.documents).toEqual(['http://127.0.0.1:4173/en/changelog']);
  expect(await page.evaluate(() => performance.timeOrigin)).not.toBe(evidence.timeOrigin);

  await page.goto('/en/docs/editor');
  const homeEvidence = await docsNavigationEvidence(page);
  await page.locator('.pe-doc-page-shortcuts').getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:4173/en');
  await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Complex data.');
  expect(homeEvidence.documents).toEqual(['http://127.0.0.1:4173/en']);
  expect(await page.evaluate(() => performance.timeOrigin)).not.toBe(homeEvidence.timeOrigin);
});

for (const lang of ['vi', 'en'] as const) {
  test(`Docs header ${lang} keeps keyboard order aligned with the regrouped desktop controls`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop Tab traversal runs in desktop projects; mobile native links and filter navigation have separate coverage.');
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockPublicNavigationSession(page);
    await page.goto(localizedNavigationPath(lang, '/docs/editor'));
    await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
    await expect(page.locator('.public-docs')).toHaveAttribute('data-enhanced', 'true');
    const header = page.locator('.pe-doc-header');
    const search = header.getByRole('combobox');
    const filter = header.locator('.pe-doc-filter');
    const pages = header.locator('.pe-doc-desktop-pages').getByRole('link');
    await header.locator('.pe-brand').focus();
    await page.keyboard.press('Tab');
    await expect(search).toBeFocused();
    await search.press('Escape');
    await page.keyboard.press('Tab');
    await expect(filter).toBeFocused();
    for (const link of await pages.all()) {
      await page.keyboard.press('Tab');
      await expect(link).toBeFocused();
    }
    for (const link of await header.locator('.pe-doc-language').getByRole('link').all()) {
      await page.keyboard.press('Tab');
      await expect(link).toBeFocused();
    }
    await page.keyboard.press('Tab');
    await expect(header.locator('.pe-doc-workspace')).toBeFocused();
    await expect(search).toHaveValue('');
    await expect(page).toHaveURL(`http://127.0.0.1:4173${localizedNavigationPath(lang, '/docs/editor')}`);
  });

  test(`public navigation native journey keeps ${lang} locale, current page and browser history`, async ({ page }) => {
    await mockPublicNavigationSession(page);
    const assertLocation = async (kind: NavigationPage) => {
      const path = localizedNavigationPath(lang, navigationPaths[kind]);
      await expect(page).toHaveURL(`http://127.0.0.1:4173${path}`);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://data-explorer-editor.vercel.app${path === '/' ? '' : path}`);
      await expect(page.locator('title')).toHaveCount(1);
      await expect(page.locator('meta[name="description"]')).toHaveCount(1);
      await expectPublicPageLinks(await visiblePublicPageNavigation(page, kind), lang, kind);
    };
    await page.goto(localizedNavigationPath(lang, '/'));
    await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
    await assertLocation('landing');
    await (await visiblePublicPageNavigation(page, 'landing')).getByRole('link', { name: navigationLabels[lang][1], exact: true }).click();
    await assertLocation('docs');
    await (await visiblePublicPageNavigation(page, 'docs')).getByRole('link', { name: navigationLabels[lang][2], exact: true }).click();
    await assertLocation('changelog');
    await expect(page.locator('.pe-header-nav').getByRole('link')).toHaveCount(3);
    await page.locator('.pe-header-nav').getByRole('link', { name: navigationLabels[lang][0], exact: true }).click();
    await assertLocation('landing');
    for (const kind of ['changelog', 'docs', 'landing'] as const) {
      await page.goBack();
      await assertLocation(kind);
    }
    for (const kind of ['docs', 'changelog', 'landing'] as const) {
      await page.goForward();
      await assertLocation(kind);
    }
  });

  test(`public navigation Docs ${lang} shortcuts and release links keep native localized destinations`, async ({ page }) => {
    await mockPublicNavigationSession(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    const docsPath = localizedNavigationPath(lang, '/docs/editor');
    const releasePath = `${localizedNavigationPath(lang, '/changelog')}#release-v1-6-7`;
    await page.goto(docsPath);
    await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
    await expectPublicPageLinks(await visiblePublicPageNavigation(page, 'docs'), lang, 'docs');
    await expect(page.locator('.pe-doc-desktop-pages').getByRole('link')).toHaveCount(3);
    await expect(page.locator('.pe-doc-compact-pages a[href]')).toHaveCount(3);
    const nativeTopics = page.locator('.pe-doc-native-nav nav a');
    await expect(nativeTopics).toHaveCount(43);
    await expect(page.locator('.pe-doc-native-nav nav a[aria-current="page"]')).toHaveCount(1);
    await expect(page.locator('.pe-doc-native-nav nav a[aria-current="page"]')).toHaveAttribute('href', docsPath);
    for (const topic of await nativeTopics.all()) {
      await expect(topic).toHaveAttribute('href', new RegExp(`^${localizedNavigationPath(lang, '/docs')}/[^/#]+$`));
    }
    const shortcuts = page.getByRole('navigation', { name: lang === 'vi' ? 'Khám phá Data Explorer' : 'Explore Data Explorer', exact: true });
    await expect(shortcuts).toHaveClass(/pe-doc-page-shortcuts/);
    await expect(shortcuts.getByRole('link')).toHaveCount(2);
    await expect(shortcuts.getByRole('link')).toHaveText(lang === 'vi' ? ['Trang chủ', 'Cập nhật sản phẩm'] : ['Home', 'Product updates']);
    await expect(shortcuts.getByRole('link').nth(0)).toHaveAttribute('href', localizedNavigationPath(lang, '/'));
    await expect(shortcuts.getByRole('link').nth(1)).toHaveAttribute('href', localizedNavigationPath(lang, '/changelog'));
    expect(await shortcuts.evaluate(element => element.closest('.pe-doc-after') !== null)).toBe(true);
    const editFooter = page.locator('.pe-doc-footer');
    await shortcuts.scrollIntoViewIfNeeded();
    expect((await shortcuts.boundingBox())!.y).toBeGreaterThanOrEqual((await editFooter.boundingBox())!.y);

    for (const selector of ['.pe-doc-sidebar a[href$="#release-v1-6-7"]', '.pe-outline-release']) {
      const release = page.locator(selector);
      await expect(release).toHaveCount(1);
      await expect(release).toHaveAttribute('href', releasePath);
      await release.click();
      await expect(page).toHaveURL(`http://127.0.0.1:4173${releasePath}`);
      await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.locator('#release-v1-6-7')).toHaveCount(1);
      await expect(page.locator('#release-v1-6-7 .pc-features')).toBeVisible();
      await expect(page.locator('#release-v1-6-7 .pc-feature').first()).toBeInViewport();
      await page.goBack();
      await expect(page).toHaveURL(`http://127.0.0.1:4173${docsPath}`);
    }
    await shortcuts.getByRole('link').nth(1).click();
    await expect(page).toHaveURL(`http://127.0.0.1:4173${localizedNavigationPath(lang, '/changelog')}`);
    await page.goBack();
    await shortcuts.getByRole('link').nth(0).click();
    await expect(page).toHaveURL(`http://127.0.0.1:4173${localizedNavigationPath(lang, '/')}`);
  });

  for (const authenticated of [false, true]) {
    for (const kind of navigationPages) {
      test(`public navigation geometry ${kind} ${lang} ${authenticated ? 'authenticated' : 'guest'} covers responsive header widths`, async ({ page, browserName, isMobile }) => {
        test.skip(browserName !== 'chromium' || isMobile, 'One desktop Chromium sweep measures the shared CSS at all six widths; native journeys run in every project.');
        await mockPublicNavigationSession(page, authenticated);
        const path = localizedNavigationPath(lang, kind === 'docs' ? '/docs/editor' : navigationPaths[kind]);
        await page.goto(path);
        await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
        await page.evaluate(() => document.fonts.ready);
        const widths = kind === 'docs' ? [320, 390, 844, 900, 901, 1100, 1101, 1440, 1920] : [320, 390, 844, 1100, 1440, 1920];
        for (const width of widths) {
          await test.step(`${width}px`, async () => {
            await page.setViewportSize({ width, height: 900 });
            const header = page.locator(kind === 'landing' ? '.lp-landing-header' : kind === 'docs' ? '.pe-doc-header' : '.pe-header');
            const nav = await visiblePublicPageNavigation(page, kind);
            await expectPublicPageLinks(nav, lang, kind);
            if (kind !== 'landing') await expect(nav.getByRole('link')).toHaveCount(3);
            await expectNavigationHitTargets(nav, kind === 'docs' ? 14 : kind === 'landing' ? (width > 1100 ? 15 : 14) : (width > 600 ? 15 : 14));
            const workspace = kind === 'landing'
              ? (width > 1100 ? page.locator('.lp-header-cta') : nav.locator('.lp-mobile-utilities').getByRole('link', { name: 'Workspace', exact: true }))
              : page.locator(kind === 'docs' ? '.pe-doc-workspace' : '.pe-header-workspace');
            await expect(workspace).toHaveAttribute('href', authenticated ? '/sql-explorer' : '/login');
            const workspaceTarget = kind === 'docs' && width <= 600 ? page.locator('.pe-doc-explore-workspace') : workspace;
            if (kind === 'docs' && width <= 600) await expect(workspace).toBeHidden();
            await expect(workspaceTarget).toBeVisible();
            await expect(workspaceTarget).toHaveAttribute('href', authenticated ? '/sql-explorer' : '/login');
            const workspaceBox = await workspaceTarget.boundingBox();
            expect(workspaceBox!.width).toBeGreaterThanOrEqual(44);
            expect(workspaceBox!.height).toBeGreaterThanOrEqual(44);
            if (kind === 'changelog') {
              const logout = page.locator('.pe-header-utilities').getByRole('button', { name: lang === 'vi' ? 'Đăng xuất' : 'Logout', exact: true });
              await expect(logout).toHaveCount(authenticated ? 1 : 0);
              if (authenticated) {
                await expect(logout).toBeVisible();
                expect((await logout.boundingBox())!.height).toBeGreaterThanOrEqual(44);
              }
            }
            if (kind !== 'docs' && (kind !== 'landing' || width > 1100)) await expectCenteredPageNavigation(header, nav);
            if (kind !== 'docs' && width > 1100) {
              const grid = kind === 'landing' ? page.locator('.lp-header-inner') : page.locator('.pe-header-layout');
              await expect(grid).toHaveCSS('display', 'grid');
              const columns = await grid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(/\s+/).map(Number.parseFloat));
              expect(columns).toHaveLength(3);
              expect(Math.abs(columns[0] - columns[2])).toBeLessThanOrEqual(1);
            } else if (kind === 'changelog') {
              const brand = page.locator('.pe-header .pe-brand');
              const [brandBox, navBox] = await Promise.all([brand.boundingBox(), nav.boundingBox()]);
              expect(navBox!.y).toBeGreaterThanOrEqual(brandBox!.y + brandBox!.height - 1);
              if (width <= 600) {
                const language = header.locator('[data-appearance="pill"]');
                const languageBox = await language.boundingBox();
                expect(languageBox!.y + languageBox!.height).toBeLessThanOrEqual(navBox!.y + 1);
                const utilitiesBox = await page.locator('.pe-header-utilities').boundingBox();
                expect(utilitiesBox!.y).toBeGreaterThanOrEqual(navBox!.y + navBox!.height - 1);
              }
            }
            if (kind === 'docs') {
              const explore = page.locator('.pe-doc-explore');
              const headerWithPanel = await header.boundingBox();
              await expect(header.locator('.pe-doc-word, .pe-button-primary')).toHaveCount(0);
              await expect(page.locator('.pe-doc-explore-workspace')).toHaveAttribute('href', authenticated ? '/sql-explorer' : '/login');
              if (width <= 1100) {
                await expect(page.locator('.pe-doc-desktop-pages')).toBeHidden();
                await expect(explore).toHaveAttribute('open', '');
                await explore.locator(':scope > summary').click();
                await expect(explore).not.toHaveAttribute('open', '');
                await expect(page.locator('.pe-doc-explore-panel')).toBeHidden();
              } else {
                await expect(page.locator('.pe-doc-desktop-pages')).toBeVisible();
                await expect(explore).toBeHidden();
              }
              const headerBox = await header.boundingBox();
              expect(Math.abs(headerBox!.height - headerWithPanel!.height)).toBeLessThanOrEqual(1);
              expect(headerBox!.height).toBeGreaterThanOrEqual(width <= 900 ? 116 : 68);
              expect(headerBox!.height).toBeLessThanOrEqual(width <= 900 ? 124 : 72);
              const slot = page.locator('.pe-doc-search-slot');
              const tools = slot.locator('.pe-doc-search-tools');
              const searchWrapper = tools.locator('.pe-doc-search');
              const search = tools.getByRole('combobox');
              const filter = tools.getByRole('button', { name: lang === 'vi' ? 'Bộ lọc' : 'Filter', exact: true });
              await expect(slot).toHaveCount(1);
              await expect(tools).toHaveCount(1);
              await expect(search).toHaveCount(1);
              await expect(header.getByRole('combobox')).toHaveCount(1);
              await expect(search).toBeVisible();
              await expect(filter).toBeVisible();
              await expect(search).toHaveCSS('font-size', '14px');
              await expect(filter).toHaveCSS('font-size', '14px');
              const [searchBox, wrapperBox, toolsBox, filterBox] = await Promise.all([search.boundingBox(), searchWrapper.boundingBox(), tools.boundingBox(), filter.boundingBox()]);
              expect(searchBox!.height).toBeGreaterThanOrEqual(44);
              expect(searchBox!.width).toBeGreaterThanOrEqual(44);
              expect(wrapperBox!.width).toBeLessThanOrEqual(360);
              expect(toolsBox!.width).toBeLessThanOrEqual(472);
              expect(filterBox!.width).toBeGreaterThanOrEqual(44);
              expect(filterBox!.height).toBeGreaterThanOrEqual(44);
              const brand = page.locator('.pe-doc-brand-row');
              const [brandBox, actionsBox] = await Promise.all([brand.boundingBox(), page.locator('.pe-doc-header-actions').boundingBox()]);
              if (width > 900) {
                await expect.poll(() => header.locator('.pe-doc-brand-row, .pe-doc-desktop-pages:visible, .pe-doc-search-tools, .pe-doc-explore > summary:visible, .pe-doc-header-actions').evaluateAll(elements => {
                  const centers = elements.map(element => { const box = element.getBoundingClientRect(); return box.y + box.height / 2; });
                  return Math.max(...centers) - Math.min(...centers);
                })).toBeLessThanOrEqual(1);
                const logoGap = toolsBox!.x - (brandBox!.x + brandBox!.width);
                expect(Math.abs(logoGap - (width > 1279 ? 40 : width > 1100 ? 34 : 22))).toBeLessThanOrEqual(1);
                expect(toolsBox!.x + toolsBox!.width).toBeLessThanOrEqual(actionsBox!.x + 1);
                if (width > 1100) {
                  const navBox = await nav.boundingBox();
                  expect(navBox!.x).toBeGreaterThanOrEqual(toolsBox!.x + toolsBox!.width + 12);
                  const utilityGap = actionsBox!.x - (navBox!.x + navBox!.width);
                  expect(utilityGap).toBeGreaterThanOrEqual(12);
                  expect(utilityGap).toBeLessThanOrEqual(24);
                  expect(await header.evaluate(element => {
                    const search = element.querySelector('.pe-doc-search-slot')!;
                    const pages = element.querySelector('.pe-doc-desktop-pages')!;
                    const actions = element.querySelector('.pe-doc-header-actions')!;
                    return Boolean(search.compareDocumentPosition(pages) & Node.DOCUMENT_POSITION_FOLLOWING) && Boolean(pages.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING);
                  })).toBe(true);
                }
                await expect(page.locator('.pe-doc-menu')).toBeHidden();
              } else {
                const summaryBox = await explore.locator(':scope > summary').boundingBox();
                expect(searchBox!.y).toBeGreaterThanOrEqual(Math.max(brandBox!.y + brandBox!.height, actionsBox!.y + actionsBox!.height) - 1);
                expect(Math.abs(searchBox!.y + searchBox!.height / 2 - (summaryBox!.y + summaryBox!.height / 2))).toBeLessThanOrEqual(1);
                expect(toolsBox!.x + toolsBox!.width).toBeLessThanOrEqual(summaryBox!.x + 1);
                expect(wrapperBox!.width).toBeGreaterThanOrEqual(140);
                expect(summaryBox!.width).toBeGreaterThanOrEqual(44);
                expect(summaryBox!.height).toBeGreaterThanOrEqual(44);
                await expect(explore.locator(':scope > summary')).toHaveAccessibleName(lang === 'vi' ? 'Khám phá' : 'Explore');
                await expect(page.locator('.pe-doc-menu')).toBeVisible();
                expect((await page.locator('.pe-doc-menu').boundingBox())!.height).toBeGreaterThanOrEqual(44);
              }
            }
            await expectHeaderControlsNotOverlapping(header, kind === 'docs');
            await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
            if (kind === 'landing' && width <= 1100) {
              await expect(page.locator('.lp-desktop-nav')).toBeHidden();
              await page.keyboard.press('Escape');
              await expect(page.locator('#landing-mobile-nav')).toHaveCount(0);
              await expect(page.locator('.lp-menu-button')).toBeFocused();
            }
          });
        }
      });
    }
  }
}

for (const lang of ['vi', 'en'] as const) {
  for (const authenticated of [false, true]) {
    test(`Docs header ${lang} ${authenticated ? 'authenticated' : 'guest'} stays compact with wider system fonts at responsive boundaries`, async ({ page }) => {
      await mockPublicNavigationSession(page, authenticated);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(localizedNavigationPath(lang, '/docs/editor'));
      const evidence = await docsNavigationEvidence(page);
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({ content: '.pe-doc-header { font-family: Verdana, sans-serif; }' });
      const header = page.locator('.pe-doc-header');
      const workspace = header.locator('.pe-doc-workspace');
      const tools = header.locator('.pe-doc-search-tools');
      const search = tools.getByRole('combobox');
      const filter = tools.locator('.pe-doc-filter');

      for (const width of [900, 901, 1100, 1101, 1279, 1280, 1440]) {
        await test.step(`${width}px wider-system-font docs header`, async () => {
          await page.setViewportSize({ width, height: 900 });
          await expect(header).toBeVisible();
          await expect(workspace).toBeVisible();
          await expect(workspace).toHaveAttribute('href', authenticated ? '/sql-explorer' : '/login');
          await expect(workspace).toHaveCSS('white-space', 'nowrap');
          await expect(workspace).toHaveCSS('flex-shrink', '0');
          await expect.poll(() => header.evaluate(element => element.getBoundingClientRect().height)).toBeLessThanOrEqual(width <= 900 ? 124 : 72);
          await expect.poll(() => header.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(width <= 900 ? 116 : 68);
          expect((await workspace.boundingBox())!.height).toBeGreaterThanOrEqual(44);
          expect((await workspace.boundingBox())!.height).toBeLessThanOrEqual(53);
          expect((await search.boundingBox())!.width).toBeGreaterThanOrEqual(44);
          expect((await search.boundingBox())!.height).toBeGreaterThanOrEqual(44);
          expect((await filter.boundingBox())!.height).toBeGreaterThanOrEqual(44);
          expect((await tools.boundingBox())!.width).toBeLessThanOrEqual(472);
          expect((await header.locator('.pe-doc-search').boundingBox())!.width).toBeLessThanOrEqual(360);
          await expect(search).toHaveCSS('font-size', '14px');
          await expect(filter).toHaveCSS('font-size', '14px');
          await expect.poll(() => workspace.evaluate(element => {
            const textNode = Array.from(element.childNodes).find(node => node.nodeType === Node.TEXT_NODE)!;
            const range = document.createRange();
            range.selectNodeContents(textNode);
            return range.getClientRects().length;
          })).toBe(1);
          await expect(header.locator('.pe-doc-desktop-pages')).toBeVisible({ visible: width > 1100 });
          await expect(header.locator('.pe-doc-explore')).toBeVisible({ visible: width <= 1100 });
          if (width > 900) {
            const [brandBox, toolsBox] = await Promise.all([header.locator('.pe-doc-brand-row').boundingBox(), tools.boundingBox()]);
            const logoGap = toolsBox!.x - (brandBox!.x + brandBox!.width);
            expect(Math.abs(logoGap - (width > 1279 ? 40 : width > 1100 ? 34 : 22))).toBeLessThanOrEqual(1);
          }
          await expectHeaderControlsNotOverlapping(header, true);
          await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
          await evidence.assertSameDocument();
        });
      }
    });
  }
}

for (const lang of ['vi', 'en'] as const) {
  test(`landing header keeps its ${lang} navigation centered without overlapping controls`, async ({ page }) => {
    await mockPublicNavigationSession(page);
    await page.setViewportSize({ width: 1917, height: 900 });
    await page.goto(lang === 'en' ? '/en' : '/');
    await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
    await page.evaluate(() => document.fonts.ready);

    for (const width of [1917, 1440, 1280, 1279, 1101]) {
      await test.step(`${width}px desktop header`, async () => {
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
          const centers = [language, github, theme, workspace].map(box => box.y + box.height / 2);
          return Math.max(...centers) - Math.min(...centers);
        })).toBeLessThanOrEqual(1);
        await expect.poll(() => page.locator('.lp-header-language').evaluate(element => {
          const control = getComputedStyle(element.firstElementChild!);
          const link = getComputedStyle(element.querySelector('a')!);
          return {
            padding: control.padding,
            separatorVisible: Array.from(element.querySelectorAll('span[aria-hidden="true"]')).some(separator => getComputedStyle(separator).display !== 'none'),
            minLinkHeight: link.minHeight,
            linkPadding: link.padding,
            linkRadius: link.borderRadius,
          };
        })).toEqual({ padding: '4px', separatorVisible: true, minLinkHeight: '0px', linkPadding: '4px 10px', linkRadius: '8px' });
        expect((await page.locator('.lp-header-language > div').boundingBox())!.height).toBeLessThan(40);
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      });
    }
  });

  test(`landing header ${lang} preserves clearance with a wider system font near the desktop breakpoint`, async ({ page }) => {
    await mockPublicNavigationSession(page);
    await page.setViewportSize({ width: 1101, height: 900 });
    await page.goto(lang === 'en' ? '/en' : '/');
    await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: '.lp-header-inner { font-family: Verdana, sans-serif; }' });
    const header = page.locator('.lp-header-inner');

    for (const width of [1101, 1279, 1280, 1100]) {
      await test.step(`${width}px wider-system-font header`, async () => {
        await page.setViewportSize({ width, height: 900 });
        const desktop = page.locator('.lp-desktop-nav');
        if (width === 1100) {
          await expect(desktop).toBeHidden();
          await expect(page.locator('.lp-menu-button')).toBeVisible();
          await expect(header).toHaveCSS('padding-left', '32px');
        } else {
          await expect(desktop).toBeVisible();
          await expect(header).toHaveCSS('padding-left', width < 1280 ? '16px' : '32px');
          await expectCenteredPageNavigation(page.locator('.lp-landing-header'), desktop);
          await expect.poll(() => header.evaluate(element => {
            const brand = element.querySelector('.lp-brand')!.getBoundingClientRect();
            const nav = element.querySelector('.lp-desktop-nav')!.getBoundingClientRect();
            const actions = element.querySelector('.lp-header-actions')!.getBoundingClientRect();
            return Math.min(nav.left - brand.right, actions.left - nav.right);
          })).toBeGreaterThanOrEqual(16);
        }
        await expect(header).toHaveCSS('padding-right', width > 1100 && width < 1280 ? '16px' : '32px');
        await expect(header).toHaveCSS('height', '68px');
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      });
    }
  });

  for (const width of [1100, 1024, 901, 900, 768, 600, 390, 320]) {
    test(`landing header ${lang} mobile navigation stays usable at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(lang === 'en' ? '/en' : '/');
      await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
      await page.evaluate(() => document.fonts.ready);
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
    });
  }
}

test('public hydration preserves full content, metadata and CSP without loading editor assets', async ({ page }) => {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.route('http://localhost:3001/api/auth/refresh', route => route.fulfill({
    status: 401, json: { message: 'Unauthorized' },
    headers: { 'access-control-allow-origin': 'http://127.0.0.1:4173', 'access-control-allow-credentials': 'true' },
  }));
  const refresh = page.waitForResponse('http://localhost:3001/api/auth/refresh');
  await page.goto('/');
  expect((await refresh).status()).toBe(401);
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
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  try {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('#pricing')).toBeVisible();
    await expect(page.locator('#get-started')).toBeVisible();
    await expect(page.locator('meta[name="description"]')).toHaveCount(1);
    await expect(page.locator('title')).toHaveCount(1);
    await expect(page.locator('#demo a.lp-screenshot-link')).toHaveAttribute('href', '/images/landing/workspace.webp');
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

test('application URLs serve the SPA shell instead of public content or a server 404', async ({ request }) => {
  for (const path of ['/login', '/forgot-password', '/legal-consent', '/onboarding', '/sql-explorer', '/sql-explorer/erd', '/nosql-explorer', '/admin', '/teams', '/billing/return']) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()['x-robots-tag'], path).toBe('noindex, nofollow');
    expect(response.headers()['content-type'], path).toContain('text/html');
    const html = await response.text();
    expect(html, path).toContain('<div id="root"></div>');
    expect(html, path).toMatch(/<script type="module"[^>]+src="\/assets\//);
    expect(html, path).not.toMatch(/data-public-rendered|data-static-content|Page not found/);
    const head = await request.head(path);
    expect(head.status(), path).toBe(200);
    expect(head.headers()['x-robots-tag'], path).toBe('noindex, nofollow');
  }
});

for (const theme of ['light', 'dark'] as const) {
  test(`Docs language pill stays compact on desktop and preserves locale links in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(value => localStorage.setItem('vite-ui-theme', value), theme);
    await mockAuthenticatedApi(page);
    await page.goto('/docs/editor#query');
    await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
    const control = page.locator('.public-docs header [data-appearance="pill"]:visible');
    const vietnamese = control.getByRole('link', { name: 'VN', exact: true });
    const english = control.getByRole('link', { name: 'EN', exact: true });
    await expect(control).toHaveCount(1);
    await expect(vietnamese).toHaveAttribute('aria-current', 'page');
    await expect(english).toHaveAttribute('href', '/en/docs/editor#query');
    const compact = await page.evaluate(() => matchMedia('(min-width: 640px) and (hover: hover) and (pointer: fine)').matches);
    await expect.poll(() => control.evaluate(element => ({
      padding: getComputedStyle(element).padding,
      background: getComputedStyle(element).backgroundColor,
      border: getComputedStyle(element).borderTopColor,
    }))).toEqual({ padding: '4px', background: theme === 'dark' ? 'rgb(12, 20, 40)' : 'rgb(238, 242, 251)', border: theme === 'dark' ? 'rgb(37, 52, 81)' : 'rgb(214, 222, 238)' });
    await expect(vietnamese).toHaveCSS('border-radius', '8px');
    await expect(vietnamese).toHaveCSS('box-shadow', 'none');
    if (compact) {
      expect((await control.boundingBox())!.height).toBeLessThan(40);
    } else {
      const box = await english.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: test.info().outputPath(`docs-language-${theme}.png`) });
    await english.click();
    await expect(page).toHaveURL(/\/en\/docs\/editor#query$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('SQL Editor');
    await page.reload();
    await expect(control.getByRole('link', { name: 'EN', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(control.getByRole('link', { name: 'VN', exact: true })).toHaveAttribute('href', '/docs/editor#query');
  });
}

for (const width of [390, 844]) {
  test(`Docs language pill retains touch targets at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 844 });
    await mockAuthenticatedApi(page);
    await page.goto('/docs/editor');
    const control = page.locator('.public-docs header [data-appearance="pill"]:visible');
    await expect(control).toHaveCount(1);
    const touch = await page.evaluate(() => !matchMedia('(min-width: 640px) and (hover: hover) and (pointer: fine)').matches);
    for (const link of await control.getByRole('link').all()) {
      const box = await link.boundingBox();
      if (touch) {
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: test.info().outputPath(`docs-language-${width}.png`) });
    await control.getByRole('link', { name: 'EN', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/docs\/editor$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
}

for (const route of ['/sql-explorer', '/nosql-explorer'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${route} language pill matches landing and keeps workspace locale in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await mockAuthenticatedApi(page);
      await seedPersistedWorkspace(page, { tabs: [], activeTabId: null, nosqlActiveCollection: null, isSidebarOpen: false, isAiPanelOpen: false });
      await page.addInitScript(value => {
        localStorage.setItem('vite-ui-theme', value);
        if (!sessionStorage.getItem('language-pill-initialized')) {
          localStorage.setItem('lang', 'en');
          sessionStorage.setItem('language-pill-initialized', 'true');
        }
      }, theme);
      await page.goto(route);
      const control = page.locator('main [data-appearance="pill"]');
      await expect(control).toHaveCount(1);
      const vietnamese = control.getByRole('button', { name: 'VN', exact: true });
      const english = control.getByRole('button', { name: 'EN', exact: true });
      await expect(english).toHaveAttribute('aria-pressed', 'true');
      await expect(english).toHaveCSS('box-shadow', 'none');
      await expect.poll(() => control.evaluate(element => getComputedStyle(element).backgroundColor)).toBe(theme === 'dark' ? 'rgb(12, 20, 40)' : 'rgb(238, 242, 251)');
      const compact = await page.evaluate(() => matchMedia('(min-width: 640px) and (hover: hover) and (pointer: fine)').matches);
      if (compact) expect((await control.boundingBox())!.height).toBeLessThan(40);
      await page.screenshot({ path: test.info().outputPath(`workspace-language-${theme}.png`) });
      await vietnamese.click();
      await expect(vietnamese).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
      expect(await page.evaluate(() => localStorage.getItem('lang'))).toBe('vi');
      await page.reload();
      await expect(vietnamese).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
      await english.focus();
      await page.keyboard.press('Enter');
      await expect(english).toHaveAttribute('aria-pressed', 'true');
      expect(await page.evaluate(() => localStorage.getItem('lang'))).toBe('en');
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    });
  }
}

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
  await expect(page.locator('#demo').getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('#demo').getByRole('heading', { level: 1 })).toContainText('Dữ liệu phức tạp.');
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

test('Docs Knowledge Hub keeps decorative motion on hover and fixed discovery targets', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockAuthenticatedApi(page);
  await page.goto('/docs/introduction');
  await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
  await page.evaluate(() => document.fonts.ready);
  const scene = page.locator('.pe-scene-knowledge');
  await expect(scene).toHaveAttribute('data-running', 'true');
  await expect(scene).toHaveAttribute('aria-hidden', 'true');
  await expect(scene.locator('.kd-page')).toHaveCount(3);
  await expect(scene.locator('a,button')).toHaveCount(0);
  const targets = page.locator('.kd-hub-dock a, .pe-doc-hero-actions a');
  const bounds = await targets.evaluateAll(elements => elements.map(element => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  }));
  const box = await scene.boundingBox();
  await page.mouse.move(box!.x + box!.width * .75, box!.y + box!.height * .3);
  await expect(scene).toHaveAttribute('data-running', 'true');
  const packet = scene.locator('.kd-route-packet');
  const offset = await packet.evaluate(element => getComputedStyle(element).strokeDashoffset);
  await expect.poll(() => packet.evaluate(element => getComputedStyle(element).strokeDashoffset)).not.toBe(offset);
  expect(await targets.evaluateAll(elements => elements.map(element => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  }))).toEqual(bounds);
  await page.getByRole('button', { name: 'Tạm dừng chuyển động', exact: true }).click();
  await expect(scene).toHaveAttribute('data-running', 'false');
  await expect(packet).toHaveCSS('animation-play-state', 'paused');
  await packet.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.ready)));
  const frozen = await packet.evaluate(element => getComputedStyle(element).strokeDashoffset);
  await page.waitForTimeout(160);
  expect(await packet.evaluate(element => getComputedStyle(element).strokeDashoffset)).toBe(frozen);
});

for (const lang of ['vi', 'en'] as const) {
  test(`Docs real group filter ${lang} includes/excludes topics, caps desktop tools and keeps the article and topic navigation intact`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await mockPublicNavigationSession(page);
    const path = localizedNavigationPath(lang, '/docs/first-query');
    await page.goto(path);
    await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
    await expect(page.locator('.public-docs')).toHaveAttribute('data-enhanced', 'true');
    await page.evaluate(() => document.fonts.ready);
    const evidence = await docsNavigationEvidence(page);
    const label = lang === 'vi' ? 'Bộ lọc' : 'Filter';
    const topics = lang === 'vi' ? 'chủ đề' : 'topics';
    const allTopics = lang === 'vi' ? 'Tất cả chủ đề' : 'All topics';
    const includeLabel = lang === 'vi' ? 'Chỉ hiển thị' : 'Include only';
    const excludeLabel = lang === 'vi' ? 'Loại trừ' : 'Exclude';
    const clearLabel = lang === 'vi' ? 'Bỏ lọc' : 'Clear filter';
    const connectionTitle = lang === 'vi' ? 'Kết nối' : 'Connections';
    const header = page.locator('.pe-doc-header');
    const tools = header.locator('.pe-doc-search-tools');
    const wrapper = tools.locator('.pe-doc-search');
    const input = tools.getByRole('combobox');
    const filter = tools.locator('.pe-doc-filter');
    const popover = page.locator('.pe-search-popover');
    const status = popover.getByRole('status');
    const menu = page.locator('.pe-doc-filter-menu');
    const catalog = menu.getByRole('group', { name: lang === 'vi' ? 'Nhóm tài liệu' : 'Documentation groups', exact: true });
    const modes = menu.getByRole('group', { name: lang === 'vi' ? 'Cách lọc' : 'Filter mode', exact: true });
    const clearFilter = menu.getByRole('menuitem', { name: clearLabel, exact: true });
    const include = modes.getByRole('menuitemradio', { name: includeLabel, exact: true });
    const exclude = modes.getByRole('menuitemradio', { name: excludeLabel, exact: true });
    const connections = catalog.getByRole('menuitemradio', { name: new RegExp(`^${connectionTitle}`) });
    const choices = catalog.getByRole('menuitemradio');
    const heading = page.getByRole('heading', { level: 1 });
    const headingText = (await heading.textContent())!;
    const headerHeight = (await header.boundingBox())!.height;
    const sidebar = page.locator('.pe-doc-sidebar .doc-sidebar-nav');
    const native = page.locator('.pe-doc-native-nav nav');
    const sidebarHrefs = await sidebar.locator('a[href]').evaluateAll(elements => elements.map(element => element.getAttribute('href')));
    const nativeHrefs = await native.locator('a[href]').evaluateAll(elements => elements.map(element => element.getAttribute('href')));
    await expect(sidebar.locator('a[href]')).toHaveCount(43);
    await expect(native.locator('a[href]')).toHaveCount(43);
    await expect(filter).toBeVisible();
    await expect(filter).toHaveAccessibleName(label);
    await expect(filter.locator('.pe-filter-label-desktop')).toBeVisible();
    await expect(filter.locator('.pe-filter-label-desktop')).toHaveText(label);
    const [toolsBox, wrapperBox, inputBox, filterBox] = await Promise.all([tools.boundingBox(), wrapper.boundingBox(), input.boundingBox(), filter.boundingBox()]);
    expect(toolsBox!.width).toBeLessThanOrEqual(472);
    expect(wrapperBox!.width).toBeLessThanOrEqual(360);
    expect(inputBox!.width).toBeGreaterThanOrEqual(44);
    expect(inputBox!.width).toBeLessThan(wrapperBox!.width);
    expect(inputBox!.height).toBeGreaterThanOrEqual(44);
    expect(filterBox!.width).toBeGreaterThanOrEqual(44);
    expect(filterBox!.height).toBeGreaterThanOrEqual(44);
    expect(wrapperBox!.x + wrapperBox!.width).toBeLessThanOrEqual(filterBox!.x);
    await expectHeaderControlsNotOverlapping(header, true);
    await input.click();
    await expect(input).toHaveValue('');
    await expect(page.getByRole('option')).toHaveCount(8);
    await expect(status).toHaveText(`8/43 ${topics}`);
    await filter.click();
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute('role', 'menu');
    await expect(menu).toHaveClass(/public-experience/);
    await expect(header.locator('.pe-doc-filter-menu')).toHaveCount(0);
    await expect(popover).toHaveCount(0);
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await expect(catalog).toBeVisible();
    await expect(modes).toBeVisible();
    await expect(menu.getByRole('group')).toHaveCount(2);
    await expect(choices).toHaveCount(9);
    await expect(modes.getByRole('menuitemradio')).toHaveCount(2);
    await expect(modes.getByRole('menuitemradio')).toHaveText([includeLabel, excludeLabel]);
    await expect(include).toHaveAttribute('aria-checked', 'true');
    await expect(exclude).toHaveAttribute('aria-checked', 'false');
    await expect(catalog.locator('[aria-checked="true"]')).toHaveCount(1);
    await expect(modes.locator('[aria-checked="true"]')).toHaveCount(1);
    await expect(clearFilter).toBeVisible();
    await expect(clearFilter).toHaveAttribute('aria-disabled', 'true');
    await expect.poll(() => choices.evaluateAll(elements => elements.map(element => ({
      title: Array.from(element.childNodes).filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join('').trim(),
      count: element.querySelector('.pe-filter-count')?.textContent?.trim(),
      checked: element.getAttribute('aria-checked'),
    })))).toEqual([
      { title: allTopics, count: '43', checked: 'true' },
      ...DOCS_CATALOG.map(group => ({ title: lang === 'vi' ? group.title : group.titleEn, count: String(group.items.length), checked: 'false' })),
    ]);
    for (const row of await menu.locator('[role="menuitem"], [role="menuitemradio"]').all()) {
      const box = (await row.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(Number(box.height.toFixed(3))).toBeGreaterThanOrEqual(44);
      await expect(row).toHaveCSS('min-height', '44px');
    }
    await exclude.click(); // Mode alone must not activate or narrow the all-topics scope.
    await expect(menu).toHaveCount(0);
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('');
    await expect(filter).toHaveAccessibleName(label);
    await expect(filter).toHaveAttribute('data-active', 'false');
    await expect(status).toHaveText(`8/43 ${topics}`);
    await expect(page.getByRole('option')).toHaveCount(8);
    await expect(popover.getByRole('button', { name: lang === 'vi' ? 'Đặt lại bộ lọc' : 'Reset filter', exact: true })).toHaveCount(0);
    await filter.click();
    await expect(clearFilter).toHaveAttribute('aria-disabled', 'true');
    await expect(exclude).toHaveAttribute('aria-checked', 'true');
    await expect(choices.first()).toHaveAttribute('aria-checked', 'true');
    await choices.first().click(); // Selecting the already-checked All topics still resets the mode.
    await expect(menu).toHaveCount(0);
    await expect(input).toBeFocused();
    await expect(status).toHaveText(`8/43 ${topics}`);
    await filter.click();
    await expect(include).toHaveAttribute('aria-checked', 'true');
    await expect(exclude).toHaveAttribute('aria-checked', 'false');
    await connections.click();
    await expect(menu).toHaveCount(0);
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('');
    await expect(filter).toHaveAccessibleName(`${label}: ${includeLabel} · ${connectionTitle}`);
    await expect(filter).toHaveAttribute('title', `${includeLabel} · ${connectionTitle}`);
    await expect(filter).toHaveAttribute('data-active', 'true');
    await expect(status).toHaveText(`8/9 ${topics}`);
    await expect(popover).toContainText(`${includeLabel} · ${connectionTitle}`);
    const connectionTopics = DOCS_CATALOG.find(group => group.id === 'connections')!.items;
    const options = page.getByRole('listbox').getByRole('option');
    await expect(options).toHaveCount(8);
    await expect.poll(() => options.evaluateAll(elements => elements.map(element => ({ tagName: element.tagName, href: element.getAttribute('href') })))).toEqual(
      connectionTopics.slice(0, 8).map(topic => ({ tagName: 'A', href: localizedNavigationPath(lang, `/docs/${topic.id}`) })),
    );
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(input).toHaveAttribute('aria-activedescendant', (await options.nth(0).getAttribute('id'))!);
    await expect(page).toHaveURL(`http://127.0.0.1:4173${path}`);
    await expect(heading).toHaveText(headingText);
    await input.fill('postgres');
    await expect(options).toHaveCount(1);
    await expect(options).toHaveAttribute('href', localizedNavigationPath(lang, '/docs/postgres'));
    await expect(status).toHaveText(`1/1 ${topics}`);
    await input.fill('Monaco'); // A real title in SQL Workspace must not leak into Connections.
    await expect(page.getByRole('option')).toHaveCount(0);
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(status).toContainText(`0/0 ${topics}`);
    await expect(status).toContainText(lang === 'vi' ? 'Không tìm thấy' : 'No matching topics');
    await page.getByRole('button', { name: lang === 'vi' ? 'Xóa tìm kiếm' : 'Clear search', exact: true }).click();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('');
    await expect(filter).toHaveAttribute('data-active', 'true');
    await expect(status).toHaveText(`8/9 ${topics}`);
    await expect(page.getByRole('option')).toHaveCount(8);
    await popover.getByRole('button', { name: lang === 'vi' ? 'Đặt lại bộ lọc' : 'Reset filter', exact: true }).click();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('');
    await expect(filter).toHaveAccessibleName(label);
    await expect(filter).toHaveAttribute('data-active', 'false');
    await expect(status).toHaveText(`8/43 ${topics}`);
    await expect(page.getByRole('option')).toHaveCount(8);
    await expect(popover.getByRole('button', { name: lang === 'vi' ? 'Đặt lại bộ lọc' : 'Reset filter', exact: true })).toHaveCount(0);

    await filter.click();
    await expect(include).toHaveAttribute('aria-checked', 'true');
    await connections.click();
    await input.press('ArrowDown');
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
    await filter.click();
    await exclude.click();
    await expect(menu).toHaveCount(0);
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('');
    await expect(filter).toHaveAccessibleName(`${label}: ${excludeLabel} · ${connectionTitle}`);
    await expect(filter).toHaveAttribute('title', `${excludeLabel} · ${connectionTitle}`);
    await expect(filter).toHaveAttribute('data-active', 'true');
    await expect(status).toHaveText(`8/34 ${topics}`);
    await expect(popover).toContainText(`${excludeLabel} · ${connectionTitle}`);
    const complement = DOCS_CATALOG.filter(group => group.id !== 'connections').flatMap(group => group.items.map(topic => topic.id));
    await expect(options).toHaveCount(8);
    await expect.poll(() => options.evaluateAll(elements => elements.map(element => element.getAttribute('href')))).toEqual(
      complement.slice(0, 8).map(id => localizedNavigationPath(lang, `/docs/${id}`)),
    );
    await expect(options.first()).toHaveAttribute('aria-selected', 'true');
    await expect(input).toHaveAttribute('aria-activedescendant', (await options.first().getAttribute('id'))!);
    await input.fill('postgres');
    await expect(page.getByRole('option')).toHaveCount(0);
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(status).toContainText(`0/0 ${topics}`);
    await input.fill('Monaco');
    await expect(options).toHaveCount(1);
    await expect(options).toHaveAttribute('href', localizedNavigationPath(lang, '/docs/editor'));
    await expect(status).toHaveText(`1/1 ${topics}`);
    await filter.click();
    await expect(clearFilter).not.toHaveAttribute('aria-disabled', 'true');
    await expect(connections).toHaveAttribute('aria-checked', 'true');
    await expect(exclude).toHaveAttribute('aria-checked', 'true');
    await expect(catalog.locator('[aria-checked="true"]')).toHaveCount(1);
    await expect(modes.locator('[aria-checked="true"]')).toHaveCount(1);
    await include.click();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('Monaco');
    await expect(filter).toHaveAccessibleName(`${label}: ${includeLabel} · ${connectionTitle}`);
    await expect(page.getByRole('option')).toHaveCount(0);
    await filter.click();
    await exclude.click();
    await expect(input).toHaveValue('Monaco');
    await expect(options).toHaveCount(1);
    await expect(options).toHaveAttribute('href', localizedNavigationPath(lang, '/docs/editor'));

    const otherGroup = DOCS_CATALOG[0];
    const otherTitle = lang === 'vi' ? otherGroup.title : otherGroup.titleEn;
    await filter.click();
    await choices.nth(1).click();
    await expect(menu).toHaveCount(0);
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('Monaco');
    await expect(filter).toHaveAccessibleName(`${label}: ${excludeLabel} · ${otherTitle}`);
    await expect(options).toHaveCount(1);
    await expect(options).toHaveAttribute('href', localizedNavigationPath(lang, '/docs/editor'));
    await filter.click();
    await expect(exclude).toHaveAttribute('aria-checked', 'true');
    await connections.click();
    await page.getByRole('button', { name: lang === 'vi' ? 'Xóa tìm kiếm' : 'Clear search', exact: true }).click();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('');
    await expect(filter).toHaveAccessibleName(`${label}: ${excludeLabel} · ${connectionTitle}`);
    await expect(status).toHaveText(`8/34 ${topics}`);
    await expect(options).toHaveCount(8);
    await expect(options.first()).toHaveAttribute('aria-selected', 'true');
    await expect(input).toHaveAttribute('aria-activedescendant', (await options.first().getAttribute('id'))!);
    await input.fill('postgres');
    await input.press('Escape');
    await expect(popover).toHaveCount(0);
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await filter.click();
    await expect(popover).toHaveCount(0);
    await expect(clearFilter).toBeVisible();
    await expect(clearFilter).not.toHaveAttribute('aria-disabled', 'true');
    await clearFilter.click();
    await expect(menu).toHaveCount(0);
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('postgres');
    await expect(filter).toHaveAccessibleName(label);
    await expect(filter).toHaveAttribute('data-active', 'false');
    await expect(status).toHaveText(`1/1 ${topics}`);
    await expect(options).toHaveCount(1);
    await expect(options).toHaveAttribute('href', localizedNavigationPath(lang, '/docs/postgres'));
    await expect(options).toHaveAttribute('aria-selected', 'true');
    await expect(input).toHaveAttribute('aria-activedescendant', (await options.getAttribute('id'))!);
    await filter.click();
    await expect(clearFilter).toHaveAttribute('aria-disabled', 'true');
    await expect(choices.first()).toHaveAttribute('aria-checked', 'true');
    await expect(include).toHaveAttribute('aria-checked', 'true');
    await expect(catalog.locator('[aria-checked="true"]')).toHaveCount(1);
    await expect(modes.locator('[aria-checked="true"]')).toHaveCount(1);
    await connections.click();
    await filter.click();
    await exclude.click();
    await expect(input).toHaveValue('postgres');
    await expect(page.getByRole('option')).toHaveCount(0);
    await popover.getByRole('button', { name: lang === 'vi' ? 'Đặt lại bộ lọc' : 'Reset filter', exact: true }).click();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('postgres');
    await expect(filter).toHaveAccessibleName(label);
    await expect(filter).toHaveAttribute('data-active', 'false');
    await expect(options).toHaveCount(1);
    await expect(options).toHaveAttribute('href', localizedNavigationPath(lang, '/docs/postgres'));
    await expect(options).toHaveAttribute('aria-selected', 'true');
    await filter.click();
    await expect(include).toHaveAttribute('aria-checked', 'true');
    await expect(choices.first()).toHaveAttribute('aria-checked', 'true');
    await connections.click();
    await filter.click();
    await exclude.click();
    await filter.click();
    await choices.first().click();
    await expect(menu).toHaveCount(0);
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('postgres');
    await expect(filter).toHaveAccessibleName(label);
    await expect(filter).toHaveAttribute('data-active', 'false');
    await expect(options).toHaveCount(1);
    await expect(options).toHaveAttribute('href', localizedNavigationPath(lang, '/docs/postgres'));
    await filter.click();
    await expect(clearFilter).toHaveAttribute('aria-disabled', 'true');
    await expect(include).toHaveAttribute('aria-checked', 'true');
    await expect(choices.first()).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    await expect(filter).toBeFocused();
    await expect(popover).toHaveCount(0);
    await page.getByRole('button', { name: lang === 'vi' ? 'Xóa tìm kiếm' : 'Clear search', exact: true }).click();
    await expect(input).toHaveValue('');
    await expect(status).toHaveText(`8/43 ${topics}`);
    await expect(page.getByRole('option')).toHaveCount(8);
    expect((await filter.boundingBox())!.width).toBe(filterBox!.width);
    expect(Math.abs((await header.boundingBox())!.height - headerHeight)).toBeLessThanOrEqual(1);
    await evidence.assertSameDocument();
    await expect(page).toHaveURL(`http://127.0.0.1:4173${path}`);
    await expect(heading).toHaveText(headingText);
    await expect(page.locator('[data-doc-topic="first-query"]')).toHaveCount(1);
    expect(await sidebar.locator('a[href]').evaluateAll(elements => elements.map(element => element.getAttribute('href')))).toEqual(sidebarHrefs);
    expect(await native.locator('a[href]').evaluateAll(elements => elements.map(element => element.getAttribute('href')))).toEqual(nativeHrefs);
    await expect(sidebar.locator('[aria-current="page"]')).toHaveAttribute('href', path);
    await expect(native.locator('[aria-current="page"]')).toHaveAttribute('href', path);
    await input.press('Escape');
    await expectHeaderControlsNotOverlapping(header, true);
  });

  test(`Docs real group filter ${lang} keeps mobile targets, menu Escape and include/exclude keyboard selection at 320 and 390px`, async ({ page, hasTouch }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await mockPublicNavigationSession(page);
    const path = localizedNavigationPath(lang, '/docs/first-query');
    await page.goto(path);
    await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
    await expect(page.locator('.public-docs')).toHaveAttribute('data-enhanced', 'true');
    await page.evaluate(() => document.fonts.ready);
    const evidence = await docsNavigationEvidence(page);
    const label = lang === 'vi' ? 'Bộ lọc' : 'Filter';
    const topics = lang === 'vi' ? 'chủ đề' : 'topics';
    const includeLabel = lang === 'vi' ? 'Chỉ hiển thị' : 'Include only';
    const excludeLabel = lang === 'vi' ? 'Loại trừ' : 'Exclude';
    const connectionTitle = lang === 'vi' ? 'Kết nối' : 'Connections';
    const header = page.locator('.pe-doc-header');
    const tools = header.locator('.pe-doc-search-tools');
    const wrapper = tools.locator('.pe-doc-search');
    const input = tools.getByRole('combobox');
    const filter = tools.locator('.pe-doc-filter');
    const summary = header.locator('.pe-doc-explore > summary');
    const menu = page.locator('.pe-doc-filter-menu');
    const catalog = menu.getByRole('group', { name: lang === 'vi' ? 'Nhóm tài liệu' : 'Documentation groups', exact: true });
    const modes = menu.getByRole('group', { name: lang === 'vi' ? 'Cách lọc' : 'Filter mode', exact: true });
    const clearFilter = menu.getByRole('menuitem', { name: lang === 'vi' ? 'Bỏ lọc' : 'Clear filter', exact: true });
    const include = modes.getByRole('menuitemradio', { name: includeLabel, exact: true });
    const exclude = modes.getByRole('menuitemradio', { name: excludeLabel, exact: true });
    const choices = catalog.getByRole('menuitemradio');
    const connections = catalog.getByRole('menuitemradio', { name: new RegExp(`^${connectionTitle}`) });
    const popover = page.locator('.pe-search-popover');
    const status = popover.getByRole('status');
    const heading = page.getByRole('heading', { level: 1 });
    const headingText = (await heading.textContent())!;
    for (const width of [320, 390]) {
      await test.step(`${width}px`, async () => {
        await page.setViewportSize({ width, height: 844 });
        const headerHeight = (await header.boundingBox())!.height;
        await expect(filter).toBeVisible();
        await expect(filter.locator('.pe-filter-label-mobile')).toBeVisible();
        await expect(filter.locator('.pe-filter-label-mobile')).toHaveText(lang === 'vi' ? 'Lọc' : 'Filter');
        await expect(summary).toBeVisible();
        await expect(summary).toHaveAccessibleName(lang === 'vi' ? 'Khám phá' : 'Explore');
        const [toolsBox, wrapperBox, inputBox, filterBox, summaryBox] = await Promise.all([tools.boundingBox(), wrapper.boundingBox(), input.boundingBox(), filter.boundingBox(), summary.boundingBox()]);
        expect(toolsBox!.width).toBeLessThanOrEqual(472);
        expect(wrapperBox!.width).toBeGreaterThanOrEqual(140);
        expect(wrapperBox!.width).toBeLessThanOrEqual(360);
        expect(inputBox!.width).toBeGreaterThanOrEqual(44);
        expect(inputBox!.height).toBeGreaterThanOrEqual(44);
        expect(filterBox!.width).toBeGreaterThanOrEqual(44);
        expect(filterBox!.height).toBeGreaterThanOrEqual(44);
        expect(summaryBox!.width).toBeGreaterThanOrEqual(44);
        expect(summaryBox!.height).toBeGreaterThanOrEqual(44);
        expect(wrapperBox!.x + wrapperBox!.width).toBeLessThanOrEqual(filterBox!.x);
        expect(toolsBox!.x + toolsBox!.width).toBeLessThanOrEqual(summaryBox!.x);
        await expectHeaderControlsNotOverlapping(header, true);
        await input.click();
        await expect(status).toHaveText(`8/43 ${topics}`);
        await expect(page.getByRole('option')).toHaveCount(8);
        if (hasTouch) await filter.tap();
        else await filter.click();
        await expect(menu).toBeVisible();
        await expect(menu.getByRole('group')).toHaveCount(2);
        await expect(choices).toHaveCount(9);
        await expect(modes.getByRole('menuitemradio')).toHaveCount(2);
        await expect(catalog.locator('[aria-checked="true"]')).toHaveCount(1);
        await expect(modes.locator('[aria-checked="true"]')).toHaveCount(1);
        await expect(clearFilter).toBeVisible();
        await expect(clearFilter).toHaveAttribute('aria-disabled', 'true');
        await expect(popover).toHaveCount(0);
        for (const row of await menu.locator('[role="menuitem"], [role="menuitemradio"]').all()) {
          const box = (await row.boundingBox())!;
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(Number(box.height.toFixed(3))).toBeGreaterThanOrEqual(44);
          await expect(row).toHaveCSS('min-height', '44px');
        }
        const menuBox = await menu.boundingBox();
        expect(menuBox!.x).toBeGreaterThanOrEqual(-1);
        expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(width + 1);
        expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(845);
        await page.keyboard.press('Escape');
        await expect(menu).toHaveCount(0);
        await expect(filter).toBeFocused();
        await expect(input).not.toBeFocused();
        await expect(input).toHaveAttribute('aria-expanded', 'false');
        await expect(popover).toHaveCount(0);
        await filter.press('ArrowDown');
        await expect(menu).toBeVisible();
        await expect(include).toBeFocused(); // The disabled Clear filter row is skipped.
        await page.keyboard.press('Home');
        await expect(include).toBeFocused();
        await page.keyboard.press('ArrowDown');
        await expect(exclude).toBeFocused();
        await page.keyboard.press('ArrowDown');
        await expect(choices.first()).toBeFocused();
        await page.keyboard.press('ArrowDown');
        await expect(choices.nth(1)).toBeFocused();
        await page.keyboard.press('ArrowDown');
        await expect(connections).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(menu).toHaveCount(0);
        await expect(input).toBeFocused();
        await expect(input).toHaveValue('');
        await expect(filter).toHaveAccessibleName(`${label}: ${includeLabel} · ${connectionTitle}`);
        await expect(filter).toHaveAttribute('data-active', 'true');
        await expect(status).toHaveText(`8/9 ${topics}`);
        await expect(page.getByRole('option')).toHaveCount(8);
        const first = page.getByRole('option').first();
        await expect(first).toHaveAttribute('href', localizedNavigationPath(lang, '/docs/postgres'));
        await expect(first).toHaveAttribute('aria-selected', 'true');
        await expect(input).toHaveAttribute('aria-activedescendant', (await first.getAttribute('id'))!);
        await expect(page).toHaveURL(`http://127.0.0.1:4173${path}`);
        await expect(heading).toHaveText(headingText);
        await filter.press('ArrowDown');
        await expect(clearFilter).toBeFocused();
        await expect(connections).toHaveAttribute('aria-checked', 'true');
        await expect(catalog.locator('[aria-checked="true"]')).toHaveCount(1);
        await expect(modes.locator('[aria-checked="true"]')).toHaveCount(1);
        await expect(include).toHaveAttribute('aria-checked', 'true');
        await expect(popover).toHaveCount(0);
        await page.keyboard.press('Home');
        await expect(clearFilter).toBeFocused();
        await page.keyboard.press('ArrowDown');
        await expect(include).toBeFocused();
        await page.keyboard.press('ArrowDown');
        await expect(exclude).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(menu).toHaveCount(0);
        await expect(input).toBeFocused();
        await expect(filter).toHaveAccessibleName(`${label}: ${excludeLabel} · ${connectionTitle}`);
        await expect(status).toHaveText(`8/34 ${topics}`);
        await expect(page.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
        await expect(input).toHaveAttribute('aria-activedescendant', (await page.getByRole('option').first().getAttribute('id'))!);
        await filter.click();
        await expect(exclude).toHaveAttribute('aria-checked', 'true');
        await page.keyboard.press('Escape');
        await expect(filter).toBeFocused();
        await expect(popover).toHaveCount(0);
        await input.focus();
        await input.fill('postgres');
        await expect(page.getByRole('option')).toHaveCount(0);
        await expect(status).toContainText(`0/0 ${topics}`);
        await input.press('Escape');
        await expect(popover).toHaveCount(0);
        await filter.press('ArrowDown');
        await expect(clearFilter).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(menu).toHaveCount(0);
        await expect(input).toBeFocused();
        await expect(input).toHaveValue('postgres');
        await expect(filter).toHaveAccessibleName(label);
        await expect(page.getByRole('option')).toHaveCount(1);
        await expect(page.getByRole('option')).toHaveAttribute('href', localizedNavigationPath(lang, '/docs/postgres'));
        await expect(page.getByRole('option')).toHaveAttribute('aria-selected', 'true');
        await expect(status).toHaveText(`1/1 ${topics}`);
        if (hasTouch) await filter.tap();
        else await filter.click();
        await expect(include).toHaveAttribute('aria-checked', 'true');
        if (hasTouch) await connections.tap();
        else await connections.click();
        await expect(input).toHaveValue('postgres');
        if (hasTouch) await filter.tap();
        else await filter.click();
        if (hasTouch) await exclude.tap();
        else await exclude.click();
        await expect(input).toBeFocused();
        await expect(input).toHaveValue('postgres');
        await expect(filter).toHaveAccessibleName(`${label}: ${excludeLabel} · ${connectionTitle}`);
        await expect(page.getByRole('option')).toHaveCount(0);
        await input.fill('Monaco');
        await expect(page.getByRole('option')).toHaveCount(1);
        await expect(page.getByRole('option')).toHaveAttribute('href', localizedNavigationPath(lang, '/docs/editor'));
        const clearSearch = page.getByRole('button', { name: lang === 'vi' ? 'Xóa tìm kiếm' : 'Clear search', exact: true });
        if (hasTouch) await clearSearch.tap();
        else await clearSearch.click();
        await expect(input).toBeFocused();
        await expect(input).toHaveValue('');
        await expect(filter).toHaveAccessibleName(`${label}: ${excludeLabel} · ${connectionTitle}`);
        await expect(status).toHaveText(`8/34 ${topics}`);
        await input.fill('postgres');
        await input.press('Escape');
        if (hasTouch) await filter.tap();
        else await filter.click();
        await expect(popover).toHaveCount(0);
        if (hasTouch) await clearFilter.tap();
        else await clearFilter.click();
        await expect(menu).toHaveCount(0);
        await expect(input).toBeFocused();
        await expect(input).toHaveValue('postgres');
        await expect(filter).toHaveAccessibleName(label);
        await expect(status).toHaveText(`1/1 ${topics}`);
        await filter.click();
        await expect(include).toHaveAttribute('aria-checked', 'true');
        await expect(choices.first()).toHaveAttribute('aria-checked', 'true');
        await connections.click();
        await popover.getByRole('button', { name: lang === 'vi' ? 'Đặt lại bộ lọc' : 'Reset filter', exact: true }).click();
        await expect(input).toBeFocused();
        await expect(input).toHaveValue('postgres');
        await expect(filter).toHaveAccessibleName(label);
        await expect(page.getByRole('option')).toHaveCount(1);
        await expect(page.getByRole('option')).toHaveAttribute('href', localizedNavigationPath(lang, '/docs/postgres'));
        await expect(status).toHaveText(`1/1 ${topics}`);
        await page.getByRole('button', { name: lang === 'vi' ? 'Xóa tìm kiếm' : 'Clear search', exact: true }).click();
        await expect(status).toHaveText(`8/43 ${topics}`);
        await input.press('Escape');
        await expect(input).toBeFocused();
        await expect(input).toHaveAttribute('aria-expanded', 'false');
        await expect(header.locator('.pe-doc-filter-menu')).toHaveCount(0);
        await expect(page.locator('.pe-doc-sidebar .doc-sidebar-nav a[href]')).toHaveCount(43);
        await expect(page.locator('.pe-doc-native-nav nav a[href]')).toHaveCount(43);
        await expect(heading).toHaveText(headingText);
        await expect(page).toHaveURL(`http://127.0.0.1:4173${path}`);
        await expectHeaderControlsNotOverlapping(header, true);
        expect((await filter.boundingBox())!.width).toBe(filterBox!.width);
        expect(Math.abs((await header.boundingBox())!.height - headerHeight)).toBeLessThanOrEqual(1);
        await evidence.assertSameDocument();
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      });
    }
  });

  test(`Docs compact toolbar ${lang} keeps landscape search, scrolling include/exclude filter and Explore within the viewport`, async ({ page, hasTouch }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await mockPublicNavigationSession(page);
    await page.goto(localizedNavigationPath(lang, '/docs/editor'));
    await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
    await expect(page.locator('.public-docs')).toHaveAttribute('data-enhanced', 'true');
    const evidence = await docsNavigationEvidence(page);
    const header = page.locator('.pe-doc-header');
    const explore = page.locator('.pe-doc-explore');
    const summary = explore.locator(':scope > summary');
    const panel = explore.locator('.pe-doc-explore-panel');
    const filter = header.locator('.pe-doc-filter');
    const menu = page.locator('.pe-doc-filter-menu');
    const catalog = menu.getByRole('group', { name: lang === 'vi' ? 'Nhóm tài liệu' : 'Documentation groups', exact: true });
    const modes = menu.getByRole('group', { name: lang === 'vi' ? 'Cách lọc' : 'Filter mode', exact: true });
    const clearFilter = menu.getByRole('menuitem', { name: lang === 'vi' ? 'Bỏ lọc' : 'Clear filter', exact: true });
    const include = modes.getByRole('menuitemradio', { name: lang === 'vi' ? 'Chỉ hiển thị' : 'Include only', exact: true });
    const exclude = modes.getByRole('menuitemradio', { name: lang === 'vi' ? 'Loại trừ' : 'Exclude', exact: true });
    const choices = catalog.getByRole('menuitemradio');
    const closedHeader = await header.boundingBox();
    const closedBody = await page.locator('.pe-doc-body').boundingBox();
    await expect(summary).toHaveText(lang === 'vi' ? 'Khám phá' : 'Explore');
    await summary.click();
    await expect(explore).toHaveAttribute('open', '');
    await expectPublicPageLinks(page.locator('.pe-doc-compact-pages'), lang, 'docs');
    await expect(explore.locator('.pe-doc-explore-workspace')).toHaveAttribute('href', '/login');
    await expect(explore.locator('.pe-doc-native-nav')).toBeHidden();
    await expect(panel).toBeVisible();
    const panelBox = await panel.boundingBox();
    expect(panelBox!.x).toBeGreaterThanOrEqual(-1);
    expect(panelBox!.y).toBeGreaterThanOrEqual(0);
    expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(845);
    expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(391);
    expect(Math.abs((await header.boundingBox())!.height - closedHeader!.height)).toBeLessThanOrEqual(1);
    expect(Math.abs((await page.locator('.pe-doc-body').boundingBox())!.y - closedBody!.y)).toBeLessThanOrEqual(1);
    await page.keyboard.press('Escape');
    await expect(explore).not.toHaveAttribute('open', '');
    await expect(summary).toBeFocused();
    await expectHeaderControlsNotOverlapping(header, true);
    const filterWidth = (await filter.boundingBox())!.width;
    const filterScrollBefore = await page.evaluate(() => ({ page: scrollY, article: document.querySelector('.pe-doc-scroll')!.scrollTop }));
    await filter.press('ArrowDown');
    await expect(menu).toBeVisible();
    await expect(menu).toHaveCSS('overflow-y', 'auto');
    await expect(choices).toHaveCount(9);
    await expect(modes.getByRole('menuitemradio')).toHaveCount(2);
    await expect(catalog.locator('[aria-checked="true"]')).toHaveCount(1);
    await expect(modes.locator('[aria-checked="true"]')).toHaveCount(1);
    await expect(clearFilter).toHaveAttribute('aria-disabled', 'true');
    await expect(include).toBeFocused();
    const filterMenuBox = (await menu.boundingBox())!;
    expect(filterMenuBox.x).toBeGreaterThanOrEqual(-1);
    expect(filterMenuBox.y).toBeGreaterThanOrEqual(0);
    expect(filterMenuBox.x + filterMenuBox.width).toBeLessThanOrEqual(845);
    expect(filterMenuBox.y + filterMenuBox.height).toBeLessThanOrEqual(391);
    for (const row of await menu.locator('[role="menuitem"], [role="menuitemradio"]').all()) {
      const box = (await row.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(Number(box.height.toFixed(3))).toBeGreaterThanOrEqual(44);
      await expect(row).toHaveCSS('min-height', '44px');
    }
    await expect.poll(() => menu.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
    await page.keyboard.press('End');
    const lastGroup = choices.last();
    await expect(lastGroup).toBeFocused();
    await expect.poll(() => lastGroup.evaluate(element => {
      const container = element.closest('.pe-doc-filter-menu')!;
      const box = container.getBoundingClientRect();
      const row = element.getBoundingClientRect();
      return { internallyScrolled: container.scrollTop > 0, fullyVisible: row.top >= box.top - 1 && row.bottom <= box.bottom + 1 };
    })).toEqual({ internallyScrolled: true, fullyVisible: true });
    expect(Math.abs((await header.boundingBox())!.height - closedHeader!.height)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => ({ page: scrollY, article: document.querySelector('.pe-doc-scroll')!.scrollTop }))).toEqual(filterScrollBefore);
    if (hasTouch) await lastGroup.tap();
    else await page.keyboard.press('Enter');
    await expect(menu).toHaveCount(0);
    await expect(page.getByRole('combobox')).toBeFocused();
    const lastCatalogGroup = DOCS_CATALOG[DOCS_CATALOG.length - 1];
    const lastTitle = lang === 'vi' ? lastCatalogGroup.title : lastCatalogGroup.titleEn;
    const filterLabel = lang === 'vi' ? 'Bộ lọc' : 'Filter';
    const includeLabel = lang === 'vi' ? 'Chỉ hiển thị' : 'Include only';
    const excludeLabel = lang === 'vi' ? 'Loại trừ' : 'Exclude';
    await expect(filter).toHaveAccessibleName(`${filterLabel}: ${includeLabel} · ${lastTitle}`);
    if (hasTouch) await filter.tap();
    else await filter.click();
    await page.keyboard.press('Home');
    await expect(clearFilter).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(include).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(exclude).toBeFocused();
    if (hasTouch) await exclude.tap();
    else await page.keyboard.press('Enter');
    await expect(menu).toHaveCount(0);
    await expect(filter).toHaveAccessibleName(`${filterLabel}: ${excludeLabel} · ${lastTitle}`);
    await expect(page.getByRole('combobox')).toBeFocused();
    await expect(page.getByRole('option')).toHaveCount(8);
    if (hasTouch) await filter.tap();
    else await filter.click();
    await page.keyboard.press('Home');
    await expect(clearFilter).toBeFocused();
    if (hasTouch) await clearFilter.tap();
    else await page.keyboard.press('Enter');
    await expect(menu).toHaveCount(0);
    await expect(filter).toHaveAccessibleName(filterLabel);
    await expect(filter).toHaveAttribute('data-active', 'false');
    await expect(page.getByRole('combobox')).toBeFocused();
    await page.getByRole('combobox').press('Escape');
    expect((await filter.boundingBox())!.width).toBe(filterWidth);
    expect(Math.abs((await header.boundingBox())!.height - closedHeader!.height)).toBeLessThanOrEqual(1);
    expect(Math.abs((await page.locator('.pe-doc-body').boundingBox())!.y - closedBody!.y)).toBeLessThanOrEqual(1);
    await evidence.assertSameDocument();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

    await summary.click();
    const search = page.getByRole('combobox');
    await search.click();
    await expect(explore).not.toHaveAttribute('open', '');
    await expect(search).toBeFocused();
    await summary.click();
    await search.focus(); // Focusing alone is not an outside pointer interaction.
    await search.fill('sql');
    await expect(page.getByRole('combobox')).toHaveCount(1);
    const results = page.getByRole('listbox');
    const options = results.getByRole('option');
    await expect(options).toHaveCount(8);
    const popover = page.locator('.pe-search-popover');
    await expect(popover).toHaveCSS('overflow-y', 'auto');
    const scrollBefore = await page.evaluate(() => ({ page: window.scrollY, article: document.querySelector('.pe-doc-scroll')!.scrollTop }));
    for (let index = 1; index < 8; index++) await search.press('ArrowDown');
    const selected = results.locator('[aria-selected="true"]');
    await expect(selected).toHaveAttribute('id', (await options.nth(7).getAttribute('id'))!);
    await expect(search).toHaveAttribute('aria-activedescendant', (await selected.getAttribute('id'))!);
    await expect.poll(() => popover.evaluate(element => {
      const active = element.querySelector('[aria-selected="true"]')!.getBoundingClientRect();
      const box = element.getBoundingClientRect();
      return { internallyScrolled: element.scrollTop > 0, fullyVisible: active.top >= box.top - 1 && active.bottom <= box.bottom + 1 };
    })).toEqual({ internallyScrolled: true, fullyVisible: true });
    const [headerBox, popoverBox] = await Promise.all([header.boundingBox(), popover.boundingBox()]);
    expect(popoverBox!.x).toBeGreaterThanOrEqual(headerBox!.x - 1);
    expect(popoverBox!.x + popoverBox!.width).toBeLessThanOrEqual(headerBox!.x + headerBox!.width + 1);
    const inlinePadding = await header.evaluate(element => {
      const style = getComputedStyle(element);
      return parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    });
    expect(Math.abs(popoverBox!.width - (headerBox!.width - inlinePadding))).toBeLessThanOrEqual(1);
    expect(popoverBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1);
    expect(popoverBox!.y + popoverBox!.height).toBeLessThanOrEqual(390);
    expect(popoverBox!.height).toBeLessThanOrEqual(390 - headerBox!.height - 19);
    expect(await page.evaluate(() => ({ page: window.scrollY, article: document.querySelector('.pe-doc-scroll')!.scrollTop }))).toEqual(scrollBefore);
    await search.press('Escape');
    await expect(search).toHaveAttribute('aria-expanded', 'false');
    await expect(search).toBeFocused();
    await expect(explore).toHaveAttribute('open', '');
    await summary.focus();
    await summary.press('Escape');
    await expect(explore).not.toHaveAttribute('open', '');
    await expect(summary).toBeFocused();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });

  test(`Docs no-JavaScript compact toolbar ${lang} keeps all topics, public links and Workspace native`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL: 'http://127.0.0.1:4173', viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    try {
      await page.goto(localizedNavigationPath(lang, '/docs/editor'));
      await expect(page.locator('.public-docs')).toHaveAttribute('data-enhanced', 'false');
      await expect(page.locator('.pe-doc-menu')).toBeHidden();
      await expect(page.locator('.pe-doc-workspace')).toBeHidden();
      const nav = await visiblePublicPageNavigation(page, 'docs');
      await expectPublicPageLinks(nav, lang, 'docs');
      const workspace = page.locator('.pe-doc-explore-workspace');
      await expect(workspace).toBeVisible();
      await expect(workspace).toHaveAttribute('href', '/login');
      const native = page.locator('.pe-doc-explore-panel .pe-doc-native-nav');
      await expect(native).toBeVisible();
      await native.locator(':scope > summary').click();
      await expect(native.locator('nav a[href]')).toHaveCount(43);
      const installation = native.getByRole('link', { name: lang === 'vi' ? 'Cài đặt' : 'Installation', exact: true });
      await expect(installation).toBeVisible();
      await expect(installation).toHaveAttribute('href', localizedNavigationPath(lang, '/docs/installation'));
      await installation.click();
      await expect(page).toHaveURL(`http://127.0.0.1:4173${localizedNavigationPath(lang, '/docs/installation')}`);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.getByRole('heading', { level: 1 })).toContainText(lang === 'vi' ? 'Cài đặt' : 'Installation');
      await visiblePublicPageNavigation(page, 'docs');
      await expect(page.locator('.pe-doc-explore')).toHaveAttribute('open', '');
      await expect(page.locator('.pe-doc-explore-workspace')).toBeVisible();
      await page.locator('.pe-doc-explore-workspace').click();
      await expect(page).toHaveURL('http://127.0.0.1:4173/login');
      await page.goBack();
      const publicNav = await visiblePublicPageNavigation(page, 'docs');
      await publicNav.getByRole('link', { name: navigationLabels[lang][2], exact: true }).click();
      await expect(page).toHaveURL(`http://127.0.0.1:4173${localizedNavigationPath(lang, '/changelog')}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    } finally {
      await context.close();
    }
  });
}

test('Docs topic search supports keyboard selection, empty state and mobile navigation focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAuthenticatedApi(page);
  await page.goto('/en/docs/introduction');
  await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
  await expect(page.locator('.public-docs')).toHaveAttribute('data-enhanced', 'true');
  const search = page.getByRole('combobox', { name: 'Search documentation...', exact: true });
  await search.fill('SQL');
  await expect(search).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('listbox')).toBeVisible();
  await search.press('ArrowDown');
  await expect(search).toHaveAttribute('aria-activedescendant', /.+/);
  await search.press('Escape');
  await expect(search).toHaveAttribute('aria-expanded', 'false');
  await search.fill('no-such-page');
  await expect(page.getByRole('status')).toContainText('No matching topics');
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(search).toHaveValue('');
  await expect(search).toBeFocused();
  await expect(search).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('option')).toHaveCount(8);
  await expect(page.getByRole('status')).toHaveText('8/43 topics');
  const menu = page.getByRole('button', { name: 'Open documentation menu', exact: true });
  await menu.click();
  const dialog = page.getByRole('dialog', { name: 'Documentation navigation', exact: true });
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(menu).toBeFocused();
});

for (const theme of ['light', 'dark'] as const) {
  test(`Changelog journal keeps latest updates readable and history searchable in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(value => localStorage.setItem('vite-ui-theme', value), theme);
    await mockAuthenticatedApi(page);
    await page.goto('/en/changelog');
    await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Changelog');
    await expect(page.locator('.pc-release')).toHaveCount(16);
    await expect(page.locator('.pc-deck,.pc-hero,.pc-deck-card')).toHaveCount(0);
    const latest = page.locator('#release-v1-6-7');
    await expect(latest.locator('.pc-feature').first()).toBeVisible();
    const firstFeature = await latest.locator('.pc-feature').first().boundingBox();
    expect(firstFeature!.y + Math.min(firstFeature!.height, 120)).toBeLessThan(900);
    const index = page.getByRole('navigation', { name: 'Versions', exact: true });
    await expect(index.getByRole('link')).toHaveCount(16);
    await index.getByRole('link', { name: /v1\.6\.6/ }).click();
    await expect(page).toHaveURL(/#release-v1-6-6$/);
    await expect(page.locator('#release-v1-6-6 details')).toHaveAttribute('open', '');
    const search = page.getByRole('searchbox', { name: 'Search releases and updates' });
    await search.fill('1.6.5');
    await expect(page.locator('.pc-release:not([hidden])')).toHaveCount(1);
    await expect(page.locator('#release-v1-6-5 details')).toHaveAttribute('open', '');
    await expect(page.getByRole('status')).toHaveText('1 matching releases');
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await expect(search).toHaveValue('');
    await expect(search).toBeFocused();
    await expect(page.locator('.pc-release:not([hidden])')).toHaveCount(16);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await expect(page.locator('.pc-index-mobile > summary')).toBeVisible();
  });
}

test('Changelog release navigation preserves hashes, language and Back/Forward history', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 900 });
  await page.goto('/en/changelog');
  await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
  const versions = page.getByRole('navigation', { name: 'Versions', exact: true });
  await versions.getByRole('link', { name: /v1\.6\.6/ }).click();
  await expect(page).toHaveURL(/\/en\/changelog#release-v1-6-6$/);
  await expect(page.locator('#release-v1-6-6 details')).toHaveAttribute('open', '');
  await expect(versions.getByRole('link', { name: /v1\.6\.6/ })).toHaveAttribute('aria-current', 'location');
  await versions.getByRole('link', { name: /v1\.6\.5/ }).click();
  await expect(page).toHaveURL(/#release-v1-6-5$/);
  await page.goBack();
  await expect(page).toHaveURL(/#release-v1-6-6$/);
  await expect(page.locator('#release-v1-6-6 details')).toHaveAttribute('open', '');
  await page.goForward();
  await expect(page).toHaveURL(/#release-v1-6-5$/);
  await expect(page.locator('#release-v1-6-5 details')).toHaveAttribute('open', '');
  const vietnamese = page.locator('.pe-header').getByRole('link', { name: 'VN', exact: true });
  await expect(vietnamese).toHaveAttribute('href', '/changelog#release-v1-6-5');
  await vietnamese.click();
  await expect(page).toHaveURL(/\/changelog#release-v1-6-5$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cập nhật sản phẩm');
  await expect(page.locator('#release-v1-6-5 details')).toHaveAttribute('open', '');
  await page.goBack();
  await expect(page).toHaveURL(/\/en\/changelog#release-v1-6-5$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#release-v1-6-5 details')).toHaveAttribute('open', '');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test('Changelog direct links, Vietnamese search and mobile empty state work without a decorative hero', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/changelog#release-v1-6-5');
  await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
  await expect(page.locator('#release-v1-6-5 details')).toHaveAttribute('open', '');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cập nhật sản phẩm');
  const search = page.getByRole('searchbox', { name: 'Tìm phiên bản hoặc nội dung cập nhật' });
  await search.fill('dau ra');
  await expect(page.locator('.pc-release:not([hidden])')).not.toHaveCount(0);
  await expect(page.locator('.pc-release:not([hidden]) details:not([open])')).toHaveCount(0);
  await search.fill('no-release-987654');
  await expect(page.getByRole('heading', { name: 'Không tìm thấy bản phát hành' })).toBeVisible();
  await page.getByRole('button', { name: 'Xem tất cả phiên bản', exact: true }).click();
  await expect(search).toHaveValue('');
  await page.setViewportSize({ width: 320, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test('Public 3D experiences preserve no-JavaScript links and reduced-motion content', async ({ browser, page }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL: 'http://127.0.0.1:4173', viewport: { width: 390, height: 844 } });
  const staticPage = await context.newPage();
  try {
    await staticPage.goto('/en/docs/introduction');
    await expect(staticPage.getByRole('heading', { level: 1 })).toBeVisible();
    await staticPage.locator('.pe-doc-explore > summary').click();
    await staticPage.locator('.pe-doc-native-nav > summary').click();
    await expect(staticPage.locator('.pe-doc-native-nav').getByRole('link', { name: 'Installation', exact: true })).toBeVisible();
    await staticPage.goto('/en/changelog');
    await expect(staticPage.getByRole('heading', { level: 1 })).toHaveText('Changelog');
    await expect(staticPage.locator('#release-v1-6-7')).toHaveCount(1);
    await expect(staticPage.locator('#release-v1-6-7')).toHaveCSS('border-radius', '11px');
    await expect(staticPage.locator('#release-v1-6-7 .pc-features')).toHaveCSS('list-style-type', 'none');
    await expect(staticPage.locator('.pc-search-tools')).toBeHidden();
    const history = staticPage.locator('#release-v1-6-6 details');
    await history.locator('summary').click();
    await expect(history).toHaveAttribute('open', '');
    await expect(history.locator('.pc-feature').first()).toBeVisible();
    await expect(staticPage.locator('.pe-header').getByRole('link', { name: 'Documentation', exact: true })).toHaveAttribute('href', '/en/docs');
  } finally { await context.close(); }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockAuthenticatedApi(page);
  await page.goto('/docs/introduction');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.kd-route-packet')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.pe-scene')).toHaveAttribute('data-depth-enabled', 'false');
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
    await expectDocsTopic(page, 'editor', 'Trình soạn thảo SQL', 'vi');
    await page.getByRole('button', { name: 'Mở menu tài liệu', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đóng menu tài liệu', exact: true })).toBeVisible();
    await page.locator('#public-docs-menu').getByRole('link', { name: 'Cài đặt', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expectDocsTopic(page, 'installation', 'Cài đặt', 'vi');
    await expectDocsReadingStart(page);
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

test('every documentation route has visible prerendered content, reviewed metadata, and reciprocal locales', async ({ request, browserName, isMobile }) => {
  test.skip(browserName !== 'chromium' || isMobile, 'One HTTP sweep covers the shared prerendered output.');
  const manifestResponse = await request.get('/public-routes.json');
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json() as Array<{ path: string; lang: string; title: string; canonical: string }>;
  const docs = manifest.filter(route => /^\/(?:en\/)?docs(?:\/|$)/.test(route.path));
  expect(docs).toHaveLength(88);
  for (const route of docs) {
    const response = await request.get(route.path);
    expect(response.status(), route.path).toBe(200);
    const html = await response.text();
    expect(html, route.path).toContain('data-public-rendered');
    expect(html, route.path).toContain(`lang="${route.lang}"`);
    expect(html.match(/<h1\b/g), route.path).toHaveLength(1);
    expect(html, route.path).not.toMatch(/Coming Soon|Đang cập nhật/);
    expect(html, route.path).toContain(route.canonical);
    expect(html, route.path).toContain('"@type":"TechArticle"');
    expect(html, route.path).toContain('"@type":"BreadcrumbList"');
  }
});

for (const [path, heading] of [
  ['/en/docs/first-query', 'Your first query'],
  ['/en/docs/sqlite', 'SQLite'],
  ['/en/docs/clickhouse', 'ClickHouse'],
  ['/en/docs/database-capabilities', 'Database capabilities'],
  ['/en/docs/operational-limits', 'Operational limits'],
  ['/en/docs/data-migration', 'Data migration'],
  ['/en/docs/data-handling', 'Data handling'],
] as const) {
  test(`${path} renders the new documentation and keeps a real edit link`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(new RegExp(heading, 'i'));
    await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
    await expect(page.locator('.pe-doc-footer a')).toHaveAttribute('href', /github\.com\/KasierBach\/Data-Explorer-Editor\/edit\/main\/client\/src\/presentation\/components\/docs\/sections\//);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://data-explorer-editor.vercel.app${path}`);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}

test('public footer shortcuts retain the current language', async ({ page }) => {
  await page.goto('/en/changelog');
  const footer = page.locator('.pe-footer');
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

// Reliability regressions use local fixtures only; browser execution is left to CI.
test.describe('Frontend startup and result recovery', () => {
  const draft = 'SELECT id, payload FROM reliability_fixture';
  const headers = { 'access-control-allow-origin': 'http://127.0.0.1:4173', 'access-control-allow-credentials': 'true' };

  async function guardFrontendRegression(page: Page) {
    await page.context().route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const staticRequest = request.method() === 'GET' && ['document', 'script', 'stylesheet', 'image', 'font', 'media', 'manifest', 'other'].includes(request.resourceType());
      if (url.origin === 'http://127.0.0.1:4173' && staticRequest && !url.pathname.startsWith('/api/')) await route.fallback();
      else await route.abort('blockedbyclient');
    });
  }

  async function seedRecoveryDraft(page: Page, lang: NavigationLanguage = 'en') {
    const state = {
      lang,
      connections: [{ id: 'connection-e2e', name: 'Protected Analytics', type: 'postgres', database: 'analytics', allowQueryExecution: true }],
      activeConnectionId: 'connection-e2e', activeDatabase: 'analytics',
      tabs: [{ id: 'recovery-query', title: 'Reliability fixture', type: 'query', metadata: { sql: draft, pageIndex: 0, pageSize: 1000, resultTab: 'data' } }],
      activeTabId: 'recovery-query', isSidebarOpen: false, isAiPanelOpen: false, isResultPanelOpen: true,
    };
    await page.addInitScript(({ state, lang }) => {
      if (sessionStorage.getItem('frontend-recovery-seeded')) return;
      localStorage.setItem('data-explorer-storage', JSON.stringify({ state, version: 0 }));
      localStorage.setItem('lang', lang);
      sessionStorage.setItem('frontend-recovery-note', 'preserved session');
      sessionStorage.setItem('frontend-recovery-seeded', 'true');
      // Init scripts can run before the parser creates the HTML element.
      if (document.documentElement) document.documentElement.lang = lang;
    }, { state, lang });
  }

  async function expectRecoveryDraft(page: Page) {
    await expect.poll(() => page.evaluate(() => {
      const raw = localStorage.getItem('data-explorer-storage');
      const stored = raw === null ? null : JSON.parse(raw);
      const tabs = Array.isArray(stored?.state?.tabs) ? stored.state.tabs : [];
      const tab = tabs.find((item: { id: string }) => item.id === 'recovery-query');
      return { present: raw !== null, version: stored?.version ?? null, sql: tab?.metadata?.sql ?? null, note: sessionStorage.getItem('frontend-recovery-note') };
    })).toEqual({ present: true, version: 0, sql: draft, note: 'preserved session' });
  }

  async function closeRecoveryContext(context: BrowserContext, preservePrimaryError: boolean) {
    try {
      await context.close();
    } catch (error) {
      if (!preservePrimaryError) throw error;
    }
  }

  for (const lang of ['vi', 'en'] as const) {
    test(`a blocked ${lang} public view keeps prerendered prose and recovers only on user reload`, async ({ page }) => {
      await guardFrontendRegression(page);
      // Keep a valid session: a denied refresh intentionally resets private workspace state.
      await mockAuthenticatedApi(page);
      await seedRecoveryDraft(page);
      const chunk = /\/assets\/DocumentationView-[^/]+\.js(?:\?.*)?$/;
      const blocked: string[] = [];
      await page.route(chunk, async route => { blocked.push(route.request().url()); await route.abort('blockedbyclient'); });
      let documents = 0;
      page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents += 1; });
      await page.goto(`${localizedNavigationPath(lang, '/docs/results')}?token=SYNTHETIC_URL_SECRET#SYNTHETIC_HASH_SECRET`);

      const fallback = page.getByRole('alert');
      await expect(fallback).toContainText(lang === 'vi' ? 'Không thể tải trang này' : 'This page could not be loaded');
      await expect(fallback).not.toContainText(/SYNTHETIC_|https?:\/\/|Failed to fetch/);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('main').first()).toBeVisible();
      await expect(page.locator('#root')).toHaveAttribute('data-public-rendered', '');
      await expect(page.locator('#root')).toHaveAttribute('data-public-path', localizedNavigationPath(lang, '/docs/results'));
      await expect(page.locator('#root')).not.toHaveAttribute('data-public-hydrated', 'true');
      await expect.poll(() => blocked.length).toBeGreaterThan(0);
      expect(documents).toBe(1);
      await expectRecoveryDraft(page);

      await page.unroute(chunk);
      await fallback.getByRole('button', { name: lang === 'vi' ? 'Tải lại trang' : 'Reload page' }).click();
      await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
      await expect(page.getByRole('alert')).toHaveCount(0);
      await expectRecoveryDraft(page);
      expect(documents).toBe(2);
    });
  }

  test('a blocked private App import exposes safe startup recovery before React mounts', async ({ page }) => {
    await guardFrontendRegression(page);
    await mockAuthenticatedApi(page);
    await seedRecoveryDraft(page);
    const chunk = /\/assets\/App-[^/]+\.js(?:\?.*)?$/;
    let blocked = 0;
    await page.route(chunk, async route => { blocked += 1; await route.abort('blockedbyclient'); });
    await page.goto('/login?token=SYNTHETIC_URL_SECRET#SYNTHETIC_HASH_SECRET');
    const fallback = page.getByRole('alert');
    await expect(fallback).toContainText('This page could not be loaded');
    await expect(fallback).not.toContainText(/SYNTHETIC_|https?:\/\//);
    await expect(page.locator('#main-content')).toHaveCount(0);
    await expect.poll(() => blocked).toBeGreaterThan(0);
    await expectRecoveryDraft(page);

    await page.unroute(chunk);
    await fallback.getByRole('button', { name: 'Reload page' }).click();
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.locator('[data-startup-fallback]')).toHaveCount(0);
    await expectRecoveryDraft(page);
  });

  test('a blocked lazy workspace chunk offers reload rather than a cached render retry', async ({ page }) => {
    await guardFrontendRegression(page);
    await mockAuthenticatedApi(page);
    await seedRecoveryDraft(page);
    const chunk = /\/assets\/AppShell-[^/]+\.js(?:\?.*)?$/;
    let blocked = 0;
    await page.route(chunk, async route => { blocked += 1; await route.abort('blockedbyclient'); });
    let documents = 0;
    page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents += 1; });
    await page.goto('/sql-explorer?token=SYNTHETIC_URL_SECRET#SYNTHETIC_HASH_SECRET');
    await expect.poll(() => blocked).toBeGreaterThan(0);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^(Try again|Thử lại)$/ })).toHaveCount(0);
    const recovery = page.getByRole('main').filter({ has: page.getByRole('heading', { name: 'Something went wrong', exact: true }) });
    await expect(recovery).toBeVisible();
    await expect(recovery).not.toContainText(/SYNTHETIC_|https?:\/\/|Failed to fetch/);
    await expect(page.locator('#main-content')).toHaveCount(0);
    expect(documents).toBe(1);
    await expectRecoveryDraft(page);

    await page.unroute(chunk);
    await page.getByRole('button', { name: 'Reload page' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('button', { name: /^(Run|Execute)$/ }).first()).toBeVisible();
    await expectRecoveryDraft(page);
    expect(documents).toBe(2);
  });

  test('query results window DOM rows, inspect with keyboard and touch, and export the whole loaded page', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173', hasTouch: true, acceptDownloads: true, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    let bodyFailed = false;
    try {
      await guardFrontendRegression(page);
      await mockAuthenticatedApi(page);
      await seedRecoveryDraft(page);
      const firstValue = `  raw first line\n${'long content '.repeat(300)}\nlast line  `;
      const longHeaders = [
        `reporting.statement.${'very_long_sql_identifier_'.repeat(24)}`,
        `reporting.adjacent.${'another_long_sql_identifier_'.repeat(24)}`,
      ];
      const contrastColumns = [...longHeaders, ...Array.from({ length: 4 }, (_, index) => `contrast_${index + 3}`)];
      const columns = ['id', 'payload', 'empty_value', ...contrastColumns];
      const calls: { limit?: number; offset?: number }[] = [];
      await page.route('http://localhost:3001/api/query', async route => {
        if (route.request().method() !== 'POST') return route.fallback();
        const payload = route.request().postDataJSON() as { limit?: number; offset?: number };
        calls.push(payload);
        const offset = payload.offset ?? 0;
        const rows = Array.from({ length: payload.limit ?? 1000 }, (_, index) => ({
          id: offset + index + 1,
          payload: offset + index === 0 ? firstValue : `row-${offset + index + 1}`,
          empty_value: offset + index === 0 ? '' : 'present',
          ...Object.fromEntries(contrastColumns.map(name => [name, index < 500 ? 'short' : `wide-${'x'.repeat(1200)}`])),
        }));
        await route.fulfill({ headers, json: { columns, fields: columns.map(name => ({ name, type: name === 'id' ? 'integer' : 'text' })), rows, rowCount: rows.length, totalCount: 500_000, countStatus: 'available', durationMs: 1 } });
      });
      await page.goto('/sql-explorer');
      await page.getByRole('button', { name: 'Execute', exact: true }).first().click();
      const region = page.locator('[role="region"][aria-label="Query result"]');
      await expect(region).toHaveCount(1);
      await expect(region).toHaveAccessibleName('Query result');
      await expect(page.getByText('1–1,000 / 500,000', { exact: true })).toBeVisible();
      await expect.poll(() => region.locator('tbody tr:not([aria-hidden="true"])').count()).toBeLessThan(100);
      await expect(region.locator('thead')).toHaveCSS('position', 'sticky');
      await expect(region.locator('table')).toHaveCSS('table-layout', 'fixed');
      for (const name of longHeaders) {
        const header = region.getByRole('columnheader', { name, exact: true });
        await expect(header).toHaveAccessibleName(name);
        const label = header.getByTitle(name, { exact: true });
        await expect(label).toHaveCSS('display', 'block');
        await expect(label).toHaveCSS('overflow-x', 'hidden');
        await expect(label).toHaveCSS('text-overflow', 'ellipsis');
        await expect(label).toHaveCSS('white-space', 'nowrap');
        await expect(label).toHaveAttribute('title', name);
        const bounds = await label.evaluate(element => {
          const labelBox = element.getBoundingClientRect();
          const headerBox = element.closest('th')!.getBoundingClientRect();
          return { left: labelBox.left, right: labelBox.right, headerLeft: headerBox.left, headerRight: headerBox.right, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth };
        });
        expect(bounds.scrollWidth).toBeGreaterThan(bounds.clientWidth);
        expect(bounds.left).toBeGreaterThanOrEqual(bounds.headerLeft);
        expect(bounds.right).toBeLessThanOrEqual(bounds.headerRight);
      }
      const headerHeight = await region.locator('thead tr').evaluate(element => element.getBoundingClientRect().height);
      expect(headerHeight).toBeGreaterThanOrEqual(28);
      expect(headerHeight).toBeLessThanOrEqual(30);

      const emptyOpener = region.getByRole('button', { name: 'empty_value, row 1: Inspect value' });
      await emptyOpener.scrollIntoViewIfNeeded();
      const [emptyCellBox, emptyButtonBox] = await Promise.all([emptyOpener.locator('..').boundingBox(), emptyOpener.boundingBox()]);
      expect(emptyCellBox).not.toBeNull();
      expect(emptyButtonBox).not.toBeNull();
      expect(emptyButtonBox!.height).toBeGreaterThanOrEqual(28);
      expect(emptyCellBox!.height).toBeLessThanOrEqual(30);
      expect(emptyCellBox!.width - emptyButtonBox!.width).toBeLessThanOrEqual(2);
      // Hit the cell's padding area, not an imaginary zero-height text glyph.
      await page.mouse.click(emptyCellBox!.x + 3, emptyCellBox!.y + 3);
      const emptyDialog = page.getByRole('dialog', { name: 'empty_value' });
      await expect(emptyDialog).toBeVisible();
      await expect.poll(() => emptyDialog.locator('pre').textContent()).toBe('');
      await page.keyboard.press('Escape');
      await expect(emptyOpener).toBeFocused();

      const opener = region.locator('button[data-result-column="payload"][data-result-row="0"]');
      await expect(opener).toHaveAccessibleName('payload, row 1: Inspect value');
      await opener.focus();
      await opener.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'payload' });
      await expect.poll(() => dialog.locator('pre').textContent()).toBe(firstValue);
      await expect(dialog.getByText('text', { exact: true })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Copy value' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(opener).toBeFocused();

      await region.evaluate(element => { element.scrollLeft = Math.min(160, element.scrollWidth - element.clientWidth); });
      const layoutSnapshot = () => region.evaluate(element => ({
        widths: Array.from(element.querySelectorAll('thead th'), header => Math.round(header.getBoundingClientRect().width * 100) / 100),
        scrollLeft: element.scrollLeft,
        scrollWidth: element.scrollWidth,
      }));
      const beforeScroll = await layoutSnapshot();
      expect(beforeScroll.scrollLeft).toBeGreaterThan(0);
      await region.evaluate(element => { element.scrollTop = element.scrollHeight - element.clientHeight; });
      await expect(opener).toHaveCount(0);
      await expect(region.getByRole('button', { name: `${longHeaders[0]}, row 1000: Inspect value` })).toContainText('wide-');
      await expect.poll(layoutSnapshot).toEqual(beforeScroll);
      await region.evaluate(element => { element.scrollTop = 0; });
      await expect(opener).toBeVisible();

      await page.setViewportSize({ width: 390, height: 844 });
      await emptyOpener.tap({ position: { x: 3, y: 3 } });
      await expect(emptyDialog).toBeVisible();
      await expect.poll(() => emptyDialog.locator('pre').textContent()).toBe('');
      await emptyDialog.getByRole('button', { name: 'Close' }).tap();
      await expect(emptyOpener).toBeFocused();
      await opener.tap();
      await expect(dialog).toBeVisible();
      await region.evaluate(element => { element.scrollTop = element.scrollHeight - element.clientHeight; });
      await expect(opener).toHaveCount(0);
      await dialog.getByRole('button', { name: 'Close' }).tap();
      await expect(region).toBeFocused();
      await expect.poll(() => region.locator('tbody tr:not([aria-hidden="true"])').count()).toBeLessThan(100);

      const downloadPromise = page.waitForEvent('download');
      await page.getByTitle('Export current page').click();
      const download = await downloadPromise;
      const stream = await download.createReadStream();
      expect(stream).not.toBeNull();
      let csv = '';
      for await (const chunk of stream!) csv += chunk.toString('utf8');
      const lines = csv.split('\r\n');
      expect(lines).toHaveLength(1001);
      expect(lines[0]).toBe(columns.join(','));
      expect(lines.at(-1)).toMatch(/^1000,row-1000,present,wide-/);
      expect(calls).toHaveLength(1);
      await page.getByTitle('Next page').click();
      await expect.poll(() => calls.at(-1)?.offset).toBe(1000);
      const pageRange = page.getByText('1,001–2,000 / 500,000', { exact: true });
      await expect(pageRange).toHaveCount(1);
      await expect(pageRange).toBeHidden();
      // The detailed range is intentionally hidden on mobile; verify it again at desktop size.
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect(pageRange).toBeVisible();
      await expect.poll(() => region.evaluate(element => element.scrollTop)).toBe(0);
      await expectRecoveryDraft(page);
    } catch (error) {
      bodyFailed = true;
      throw error;
    } finally {
      // Keep a body/runner failure primary; cleanup failures still fail a successful test.
      await closeRecoveryContext(context, bodyFailed || test.info().errors.length > 0);
    }
  });
});

// Legal refresh coverage is intentionally isolated from the existing public-page tests.
test.describe('Legal reading pages', () => {
  const documentKeys = ['legal', 'privacy', 'terms'] as const;
  const languages = ['vi', 'en'] as const;
  const sectionCounts = { legal: 4, privacy: 9, terms: 10 } as const;

  async function prepareLegalPage(page: Page) {
    await page.context().route('**/*', async route => {
      const url = new URL(route.request().url());
      if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) await route.fallback();
      else await route.abort('blockedbyclient');
    });
    // Page routes take precedence over the context guard; no live authentication is used.
    await mockPublicNavigationSession(page);
  }

  async function expectLegalReading(page: Page, lang: NavigationLanguage, key: LegalDocKey) {
    const doc = getLegalDocument(lang, key);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.locator('.public-legal-site')).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.locator('main.public-legal')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(doc.title);
    await expect(page.locator('.pe-header')).toBeVisible();
    await expect(page.locator('.pe-footer')).toBeVisible();
    await expect(page.locator('.landing-page, .lp-header, .lp-footer, .public-changelog-site, .pe-doc-header, #features, #workflows, #pricing, #demo')).toHaveCount(0);
    await expect(page.locator('.public-legal-site a[href*="#features"], .public-legal-site a[href*="#workflows"], .public-legal-site a[href*="#pricing"], .public-legal-site a[href*="#demo"]')).toHaveCount(0);

    const expectedSections = doc.sections.map(section => {
      const id = `${key}-${section.id}`;
      return { id, labelledBy: `${id}-title`, headingCount: 1, title: section.title, paragraphs: [...section.paragraphs], bullets: [...(section.bullets ?? [])], permalink: `#${id}` };
    });
    expect(expectedSections).toHaveLength(sectionCounts[key]);
    await expect.poll(() => page.locator('main.public-legal').evaluate(main => {
      const article = main.querySelector('.pl-article')!;
      const documents = main.querySelector('.pl-document-nav')!;
      return {
        subtitle: main.querySelector('.pl-subtitle')?.textContent?.trim(),
        date: main.querySelector('.pl-effective-date')?.textContent?.trim(),
        navigationLabel: documents.getAttribute('aria-label'),
        documentLinks: Array.from(documents.querySelectorAll(':scope > a'), link => ({ text: link.textContent?.trim(), href: link.getAttribute('href'), current: link.getAttribute('aria-current') })),
        articleLabel: article.getAttribute('aria-label'),
        sections: Array.from(article.querySelectorAll(':scope > .pl-section'), section => ({
          id: section.id,
          labelledBy: section.getAttribute('aria-labelledby'),
          headingCount: section.querySelectorAll('h2').length,
          title: section.querySelector('h2')?.textContent?.trim(),
          paragraphs: Array.from(section.querySelectorAll('.pl-prose > p'), paragraph => paragraph.textContent?.trim()),
          bullets: Array.from(section.querySelectorAll('.pl-prose > ul > li'), bullet => bullet.textContent?.trim()),
          permalink: section.querySelector('.pl-section-link')?.getAttribute('href'),
        })),
        cards: Array.from(main.querySelectorAll('.pl-document-card'), card => ({ href: card.getAttribute('href'), title: card.querySelector('h2')?.textContent?.trim(), subtitle: card.querySelector('p')?.textContent?.trim() })),
      };
    })).toEqual({
      subtitle: doc.subtitle,
      date: doc.effectiveDate,
      navigationLabel: lang === 'vi' ? 'Tài liệu pháp lý' : 'Legal documents',
      documentLinks: documentKeys.map(documentKey => ({ text: getLegalDocument(lang, documentKey).title, href: localizedNavigationPath(lang, `/${documentKey}`), current: documentKey === key ? 'page' : null })),
      articleLabel: doc.title,
      sections: expectedSections,
      cards: key === 'legal' ? (['privacy', 'terms'] as const).map(linkedKey => ({ href: localizedNavigationPath(lang, `/${linkedKey}`), title: getLegalDocument(lang, linkedKey).title, subtitle: getLegalDocument(lang, linkedKey).subtitle })) : [],
    });
    expect(doc.effectiveDate).toMatch(/28\/06\/2026|June 28, 2026|28 June 2026/);

    const footerLinks = await page.locator('.pe-footer a').evaluateAll(links => links.map(link => link.getAttribute('href')));
    for (const documentKey of documentKeys) {
      expect(footerLinks.filter(href => href === localizedNavigationPath(lang, `/${documentKey}`))).toHaveLength(1);
    }
    const headerLinks = await page.locator('.pe-header-nav .pe-nav-link').evaluateAll(links => links.map(link => ({ text: link.textContent?.trim(), href: link.getAttribute('href') })));
    expect(headerLinks).toEqual(navigationPages.map((kind, index) => ({ text: navigationLabels[lang][index], href: localizedNavigationPath(lang, navigationPaths[kind]) })));
  }

  async function expectLegalAnchorClear(page: Page, id: string) {
    await expect.poll(() => page.locator(`.pl-article section[id="${id}"]`).evaluate(section => {
      const heading = section.querySelector('h2')!.getBoundingClientRect();
      const header = document.querySelector('.pe-header')!.getBoundingClientRect();
      return heading.top >= Math.max(0, header.bottom) - 1 && heading.top < innerHeight - 16;
    })).toBe(true);
  }

  async function expectLegalHitTargets(links: Locator) {
    await expect.poll(() => links.evaluateAll(elements => elements.length > 0 && elements.every(element => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && box.width >= 44 && box.height >= 44;
    }))).toBe(true);
  }

  test.beforeEach(async ({ page }) => {
    await prepareLegalPage(page);
  });

  for (const lang of languages) {
    for (const key of documentKeys) {
      const path = localizedNavigationPath(lang, `/${key}`);
      for (const theme of ['light', 'dark'] as const) {
        test(`${path} ${theme} delivers full legal HTML and accessible reading chrome without changing workspace storage`, async ({ page, request }) => {
          const response = await request.get(path, { maxRedirects: 0 });
          expect(response.status()).toBe(200);
          expect(response.headers()['content-type']).toContain('text/html');
          const html = await response.text();
          expect(html).toContain('data-public-rendered');
          expect(html.match(/<h1\b/g)).toHaveLength(1);
          const workspaceLanguage = lang === 'vi' ? 'en' : 'vi';
          const workspaceState = {
            tabs: [], activeTabId: null, activeConnectionId: null, activeDatabase: null,
            isSidebarOpen: false, sidebarWidth: 24,
            defaultResultHeight: 340, isAiPanelOpen: false,
          };
          const storage = {
            'vite-ui-theme': theme,
            'data-explorer-landing-theme': theme === 'light' ? 'dark' : 'light',
            lang: workspaceLanguage,
            'data-explorer-storage': JSON.stringify({ state: workspaceState, version: 0 }),
          };
          // Seed once so a later navigation cannot hide an unintended storage write.
          await page.addInitScript(values => {
            if (sessionStorage.getItem('legal-reading-seeded')) return;
            for (const [name, value] of Object.entries(values)) localStorage.setItem(name, value);
            sessionStorage.setItem('legal-reading-seeded', 'true');
          }, storage);
          const errors: string[] = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.goto(path);
          await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
          await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`));
          await expectLegalReading(page, lang, key);

          // Parse the HTTP response, not hydrated DOM or a JSON copy of the document.
          const delivered = await page.evaluate(source => {
            const document = new DOMParser().parseFromString(source, 'text/html');
            return {
              lang: document.documentElement.lang,
              headings: Array.from(document.querySelectorAll('h1'), heading => heading.textContent?.trim()),
              mainCount: document.querySelectorAll('main.public-legal').length,
              legalShellCount: document.querySelectorAll('.public-legal-site').length,
              sections: Array.from(document.querySelectorAll('.pl-article > .pl-section'), section => ({
                id: section.id,
                title: section.querySelector('h2')?.textContent?.trim(),
                paragraphs: Array.from(section.querySelectorAll('.pl-prose > p'), paragraph => paragraph.textContent?.trim()),
                bullets: Array.from(section.querySelectorAll('.pl-prose > ul > li'), bullet => bullet.textContent?.trim()),
              })),
              documentLinks: Array.from(document.querySelectorAll('.pl-document-nav > a'), link => link.getAttribute('href')),
            };
          }, html);
          const doc = getLegalDocument(lang, key);
          expect(delivered.sections).toHaveLength(sectionCounts[key]);
          expect(delivered).toEqual({
            lang,
            headings: [doc.title],
            mainCount: 1,
            legalShellCount: 1,
            sections: doc.sections.map(section => ({ id: `${key}-${section.id}`, title: section.title, paragraphs: [...section.paragraphs], bullets: [...(section.bullets ?? [])] })),
            documentLinks: documentKeys.map(documentKey => localizedNavigationPath(lang, `/${documentKey}`)),
          });
          const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
          expect(accessibility.violations).toEqual([]);
          const currentStorage = await page.evaluate(names => Object.fromEntries(names.map(name => [name, localStorage.getItem(name)])), Object.keys(storage));
          expect(currentStorage['vite-ui-theme']).toBe(theme);
          expect(currentStorage['data-explorer-landing-theme']).toBe(theme === 'light' ? 'dark' : 'light');
          expect(currentStorage.lang).toBe(workspaceLanguage);
          const persisted = JSON.parse(currentStorage['data-explorer-storage']!);
          expect(persisted.version).toBe(0);
          expect(persisted.state).toEqual(expect.objectContaining(workspaceState));
          expect(persisted.state.lang).toBeUndefined();
          expect(persisted.state.connections).toEqual([]);
          expect(persisted.state.aiChats).toEqual([]);
          expect(errors).toEqual([]);
        });
      }

      test(`${path} keeps full prose, section anchors and native mobile contents without JavaScript`, async ({ browser, baseURL }) => {
        // Browser-level reduced-motion emulation engages the existing CSS
        // `scroll-behavior: auto !important` override, so scrollIntoView is
        // instant: hosted Linux WebKit stalls clicking cross-document links
        // while Playwright's actionability re-check races the global smooth
        // scroll (CI 44761876000 shard1, `element is outside of the viewport`).
        const context = await browser.newContext({ javaScriptEnabled: false, baseURL, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
        try {
          const staticPage = await context.newPage();
          await prepareLegalPage(staticPage);
          const response = await staticPage.goto(path);
          expect(response?.status()).toBe(200);
          await expect(staticPage.locator('#root')).not.toHaveAttribute('data-public-hydrated', 'true');
          await expectLegalReading(staticPage, lang, key);
          const doc = getLegalDocument(lang, key);
          const target = doc.sections[1];
          const id = `${key}-${target.id}`;
          const details = staticPage.locator('.pl-contents-mobile');
          await expect(staticPage.locator('.pl-outline')).toBeHidden();
          await details.locator(':scope > summary').click();
          await expect(details).toHaveAttribute('open', '');
          const contents = details.getByRole('navigation', { name: lang === 'vi' ? 'Mục lục trên mobile' : 'Mobile document contents', exact: true });
          await expect(contents.getByRole('link')).toHaveCount(sectionCounts[key]);
          for (const section of doc.sections) {
            await expect(contents.getByRole('link', { name: section.title, exact: true })).toHaveAttribute('href', `#${key}-${section.id}`);
          }
          await contents.getByRole('link', { name: target.title, exact: true }).click();
          await expect(staticPage).toHaveURL(url => url.pathname === path && url.hash === `#${id}`);
          await expectLegalAnchorClear(staticPage, id);
          await expect(staticPage.locator(`.pl-article section[id="${id}"] .pl-prose > p`)).toHaveText([...target.paragraphs]);
          const nextKey = key === 'privacy' ? 'terms' : 'privacy';
          await staticPage.locator('.pl-document-nav').getByRole('link', { name: getLegalDocument(lang, nextKey).title, exact: true }).click();
          await expect(staticPage).toHaveURL(url => url.pathname === localizedNavigationPath(lang, `/${nextKey}`) && !url.hash);
          await expect(staticPage.getByRole('heading', { level: 1 })).toHaveText(getLegalDocument(lang, nextKey).title);
          await staticPage.goBack();
          await expect(staticPage).toHaveURL(url => url.pathname === path && url.hash === `#${id}`);
          await expect(staticPage.locator(`.pl-article section[id="${id}"]`)).toBeAttached();
          await expect(staticPage.locator('#root')).not.toHaveAttribute('data-public-hydrated', 'true');
        } finally {
          await context.close();
        }
      });
    }
  }

  for (const { width, lang } of [{ width: 390, lang: 'vi' }, { width: 768, lang: 'en' }, { width: 1100, lang: 'vi' }, { width: 1440, lang: 'en' }, { width: 1920, lang: 'vi' }] as const) {
    test(`legal reading at ${width}px keeps readable widths, native keyboard contents, long headings and document cards`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(localizedNavigationPath(lang, '/privacy'));
      await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
      await expectLegalReading(page, lang, 'privacy');
      await page.evaluate(() => document.fonts.ready);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await expectHeaderControlsNotOverlapping(page.locator('.pe-header'));
      await expectLegalHitTargets(page.locator('.pl-document-nav > a'));
      const column = await page.locator('.pl-reading-column').boundingBox();
      expect(column!.width).toBeGreaterThanOrEqual(Math.min(width - 64, 360));
      const readingMeasure = await page.locator('.pl-reading-column').evaluate(element => {
        const style = getComputedStyle(element);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        context.font = style.font;
        return context.measureText('0').width * 72;
      });
      expect(column!.width).toBeLessThanOrEqual(readingMeasure + 1);
      const contextRail = page.locator('.pl-context-rail');
      if (width > 1320) {
        await expect(contextRail).toBeVisible();
        const railBox = await contextRail.boundingBox();
        const outlineBox = await page.locator('.pl-outline').boundingBox();
        expect(outlineBox!.x + outlineBox!.width).toBeLessThanOrEqual(column!.x - 20);
        expect(column!.x + column!.width).toBeLessThanOrEqual(railBox!.x - 20);
        expect(railBox!.x + railBox!.width).toBeLessThanOrEqual(width);
        await expect(contextRail.getByRole('navigation', { name: lang === 'vi' ? 'Tài liệu pháp lý liên quan' : 'Related legal documents' }).getByRole('link')).toHaveCount(2);
        await expect(contextRail.getByRole('navigation', { name: lang === 'vi' ? 'Hướng dẫn liên quan' : 'Related guides' }).getByRole('link')).toHaveCount(3);
      } else {
        await expect(contextRail).toBeHidden();
      }
      const prose = await page.locator('.pl-prose').first().evaluate(element => {
        const style = getComputedStyle(element);
        return { font: parseFloat(style.fontSize), line: parseFloat(style.lineHeight) };
      });
      expect(prose.font).toBeGreaterThanOrEqual(16);
      expect(prose.line).toBeGreaterThanOrEqual(prose.font * 1.6);
      const doc = getLegalDocument(lang, 'privacy');
      const longest = doc.sections.reduce((chosen, section) => section.title.length > chosen.title.length ? section : chosen);
      const longHeading = page.locator(`.pl-article section[id="privacy-${longest.id}"] h2`);
      await expect(longHeading).toHaveText(longest.title);
      const headingGeometry = await longHeading.evaluate(element => {
        const box = element.getBoundingClientRect();
        const link = element.parentElement!.querySelector('.pl-section-link')!.getBoundingClientRect();
        return { left: box.left, right: box.right, linkLeft: link.left, overflow: element.scrollWidth - element.clientWidth, height: box.height, line: parseFloat(getComputedStyle(element).lineHeight) };
      });
      expect(headingGeometry.left).toBeGreaterThanOrEqual(0);
      expect(headingGeometry.right).toBeLessThanOrEqual(width);
      expect(headingGeometry.right).toBeLessThanOrEqual(headingGeometry.linkLeft - 1);
      expect(headingGeometry.overflow).toBeLessThanOrEqual(1);
      if (width === 390) {
        expect(headingGeometry.height).toBeGreaterThan(headingGeometry.line + 1);
        await expectLegalHitTargets(page.locator('.pl-section-link'));
      }

      const mobile = page.locator('.pl-contents-mobile');
      const outline = page.locator('.pl-outline');
      let contents: Locator;
      if (width <= 800) {
        await expect(outline).toBeHidden();
        const summary = mobile.locator(':scope > summary');
        await expectLegalHitTargets(summary);
        await summary.focus();
        await summary.press('Enter');
        await expect(mobile).toHaveAttribute('open', '');
        await summary.press('Space');
        await expect(mobile).not.toHaveAttribute('open', '');
        await summary.press('Enter');
        await expect(mobile).toHaveAttribute('open', '');
        contents = mobile.getByRole('navigation', { name: lang === 'vi' ? 'Mục lục trên mobile' : 'Mobile document contents', exact: true });
        await summary.press('Tab');
        await expect(contents.getByRole('link').first()).toBeFocused();
      } else {
        await expect(mobile).toBeHidden();
        await expect(outline).toBeVisible();
        contents = outline.getByRole('navigation', { name: lang === 'vi' ? 'Trong tài liệu này' : 'On this page', exact: true });
      }
      await expect(contents.getByRole('link')).toHaveCount(9);
      await expectLegalHitTargets(contents.getByRole('link'));
      const anchor = contents.getByRole('link', { name: longest.title, exact: true });
      await anchor.focus();
      await anchor.press('Enter');
      await expect(page).toHaveURL(url => url.hash === `#privacy-${longest.id}`);
      await expect(anchor).toHaveAttribute('aria-current', 'location');
      await expectLegalAnchorClear(page, `privacy-${longest.id}`);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

      await page.goto(localizedNavigationPath(lang, '/legal'));
      await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
      await expectLegalReading(page, lang, 'legal');
      const cards = page.locator('.pl-document-card');
      await expectLegalHitTargets(cards);
      const centerOverview = page.locator('.pl-center-overview');
      const centerSummary = page.locator('.pl-center-summary');
      const centerOutline = page.locator('.pl-outline');
      const centerContext = page.locator('.pl-context-rail');
      if (width > 1320) {
        await expect(centerSummary).toBeVisible();
        await expect(centerOutline).toBeVisible();
        await expect(centerContext).toBeVisible();
        const [overviewBox, cardsBox, summaryBox, centerColumn, centerOutlineBox, centerContextBox] = await Promise.all([
          centerOverview.boundingBox(), page.locator('.pl-document-cards').boundingBox(), centerSummary.boundingBox(), page.locator('.pl-reading-column').boundingBox(), centerOutline.boundingBox(), centerContext.boundingBox(),
        ]);
        expect(cardsBox!.x + cardsBox!.width).toBeLessThanOrEqual(summaryBox!.x - 20);
        expect(Math.abs((overviewBox!.x + overviewBox!.width) - (summaryBox!.x + summaryBox!.width))).toBeLessThanOrEqual(1);
        expect(centerOutlineBox!.x + centerOutlineBox!.width).toBeLessThanOrEqual(centerColumn!.x - 20);
        expect(centerColumn!.x + centerColumn!.width).toBeLessThanOrEqual(centerContextBox!.x - 20);
      } else {
        await expect(centerSummary).toBeHidden();
        await expect(centerContext).toBeHidden();
      }
      const first = (await cards.nth(0).boundingBox())!;
      const second = (await cards.nth(1).boundingBox())!;
      if (width <= 600) expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
      else {
        expect(Math.abs(first.y - second.y)).toBeLessThanOrEqual(1);
        expect(second.x).toBeGreaterThanOrEqual(first.x + first.width);
      }
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    });
  }

  for (const lang of languages) {
    test(`legal ${lang} print removes both side rails and lets overview cards use the available width`, async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 900 });
      await page.goto(localizedNavigationPath(lang, '/legal'));
      await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
      await expectLegalReading(page, lang, 'legal');
      try {
        await page.emulateMedia({ media: 'print' });
        for (const selector of ['.pe-header', '.pe-footer', '.pl-center-summary', '.pl-outline', '.pl-context-rail', '.pl-contents-mobile']) {
          await expect(page.locator(selector)).toBeHidden();
        }
        await expect(page.locator('.pl-center-overview')).toHaveCSS('display', 'block');
        await expect(page.locator('.pl-reading-layout')).toHaveCSS('display', 'block');
        await expect(page.locator('.pl-reading-column')).toHaveCSS('max-width', 'none');
        for (const icon of await page.locator('.pl-document-mark,.pl-card-icon').all()) {
          await expect(icon).toHaveCSS('color', 'rgb(0, 0, 0)');
          await expect(icon).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        }
        const geometry = await page.locator('.pl-center-overview').evaluate(overview => {
          const cards = overview.querySelector('.pl-document-cards')!;
          const overviewBox = overview.getBoundingClientRect();
          const cardsBox = cards.getBoundingClientRect();
          return { left: Math.abs(cardsBox.left - overviewBox.left), right: Math.abs(cardsBox.right - overviewBox.right), overflow: document.documentElement.scrollWidth - innerWidth };
        });
        expect(geometry.left).toBeLessThanOrEqual(1);
        expect(geometry.right).toBeLessThanOrEqual(1);
        expect(geometry.overflow).toBeLessThanOrEqual(1);
        const doc = getLegalDocument(lang, 'legal');
        await expect(page.locator('.pl-article .pl-section > .pl-section-heading > h2')).toHaveText(doc.sections.map(section => section.title));
        await page.screenshot({ path: test.info().outputPath(`legal-print-${lang}-1920.png`), fullPage: true });
      } finally {
        await page.emulateMedia({ media: null });
      }
    });
  }

  for (const lang of languages) {
    test(`legal ${lang} locale links preserve the section and query across native navigation and Back`, async ({ page }) => {
      await page.setViewportSize({ width: lang === 'vi' ? 390 : 1100, height: 900 });
      const path = localizedNavigationPath(lang, '/privacy');
      const otherLanguage = lang === 'vi' ? 'en' : 'vi';
      const otherPath = localizedNavigationPath(otherLanguage, '/privacy');
      const suffix = '?reading=legal-e2e';
      const doc = getLegalDocument(lang, 'privacy');
      const first = doc.sections[1];
      const second = doc.sections[3];
      await page.goto(`${path}${suffix}`);
      await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
      const contents = lang === 'vi' ? page.locator('.pl-contents-mobile') : page.locator('.pl-outline');
      if (lang === 'vi') await contents.locator(':scope > summary').click();
      await contents.getByRole('link', { name: first.title, exact: true }).click();
      await expect(page).toHaveURL(url => url.pathname === path && url.search === suffix && url.hash === `#privacy-${first.id}`);
      await contents.getByRole('link', { name: second.title, exact: true }).click();
      await expect(page).toHaveURL(url => url.hash === `#privacy-${second.id}`);
      await page.goBack();
      await expect(page).toHaveURL(url => url.hash === `#privacy-${first.id}`);
      await expect(contents.getByRole('link', { name: first.title, exact: true })).toHaveAttribute('aria-current', 'location');
      await expectLegalAnchorClear(page, `privacy-${first.id}`);
      const locale = page.locator('.pe-header').getByRole('link', { name: otherLanguage === 'en' ? 'EN' : 'VN', exact: true });
      await expect(locale).toHaveAttribute('href', `${otherPath}${suffix}#privacy-${first.id}`);
      await locale.click();
      await expect(page).toHaveURL(url => url.pathname === otherPath && url.search === suffix && url.hash === `#privacy-${first.id}`);
      await expect(page.locator('#root')).toHaveAttribute('data-public-hydrated', 'true');
      await expectLegalReading(page, otherLanguage, 'privacy');
      await expectLegalAnchorClear(page, `privacy-${first.id}`);
      await expect(page.locator('.pe-header').getByRole('link', { name: lang === 'en' ? 'EN' : 'VN', exact: true })).toHaveAttribute('href', `${path}${suffix}#privacy-${first.id}`);
      await page.locator('.pl-document-nav').getByRole('link', { name: getLegalDocument(otherLanguage, 'terms').title, exact: true }).click();
      await expect(page).toHaveURL(url => url.pathname === localizedNavigationPath(otherLanguage, '/terms') && !url.search && !url.hash);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(getLegalDocument(otherLanguage, 'terms').title);
      await page.goBack();
      await expect(page).toHaveURL(url => url.pathname === otherPath && url.search === suffix && url.hash === `#privacy-${first.id}`);
      await expectLegalAnchorClear(page, `privacy-${first.id}`);
      await page.goBack();
      await expect(page).toHaveURL(url => url.pathname === path && url.search === suffix && url.hash === `#privacy-${first.id}`);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expectLegalAnchorClear(page, `privacy-${first.id}`);
    });
  }
});
