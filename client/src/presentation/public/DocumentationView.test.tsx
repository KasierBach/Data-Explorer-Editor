import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCS_CATALOG, DOCS_TOPICS, getDocTopic } from '@/core/docs/docsCatalog';
import { CURRENT_RELEASE, getReleaseDate } from '@/core/productRelease';
import { publicPath, resolvePublicRoute } from '@/core/seo/publicRoutes';
import { DocumentationView } from './DocumentationView';
import { PublicExperienceContext } from './PublicExperienceContext';
import { PUBLIC_DOCS_NAVIGATION_EVENT, PublicDocsNavigationContext, PublicNavigationContext } from './PublicNavigationContext';
import type { DocsNavigate } from './docsNavigation';

function view(path: string, isAuthenticated = false) {
  const route = resolvePublicRoute(path)!;
  return <PublicNavigationContext.Provider value={route}><PublicExperienceContext.Provider value={{ lang: route.lang, paused: true }}><DocumentationView route={route} isAuthenticated={isAuthenticated} /></PublicExperienceContext.Provider></PublicNavigationContext.Provider>;
}

describe('DocumentationView catalog integration', () => {
  it.each(['vi', 'en'] as const)('keeps approved chrome, real content and edit/release links in %s', lang => {
    const { container } = render(view(publicPath(lang, '/docs/first-query')));
    expect(container.querySelector('.pe-doc-header')).toBeInTheDocument();
    expect(container.querySelector('.pe-doc-native-nav')).toBeInTheDocument();
    expect(container.querySelector('.pe-doc-sidebar')).toBeInTheDocument();
    expect(container.querySelector('.pe-doc-scroll')).toBeInTheDocument();
    expect(container.querySelector('.pe-doc-outline')).toBeInTheDocument();
    expect(container.querySelector('.public-docs')).toHaveAttribute('data-motion', 'paused');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const sidebar = container.querySelector('.pe-doc-sidebar .doc-sidebar-nav')!;
    expect(sidebar.querySelectorAll('a[href]')).toHaveLength(DOCS_TOPICS.length);
    expect(sidebar.querySelector('a[aria-current="page"]')).toHaveAttribute('href', publicPath(lang, '/docs/first-query'));
    const footer = container.querySelector('.pe-doc-footer')!;
    expect(footer.querySelector('a')).toHaveAttribute('href', `https://github.com/KasierBach/Data-Explorer-Editor/edit/main/${getDocTopic('first-query')!.sourcePath}`);
    expect(footer.querySelectorAll('a')).toHaveLength(1);
    expect(footer.querySelector('time[datetime="2026-11-07"]')).toBeInTheDocument();
    expect(footer.querySelector(`time[datetime="${CURRENT_RELEASE.date}"]`)).toHaveTextContent(getReleaseDate(lang));
    expect(footer).toHaveTextContent(CURRENT_RELEASE.tag);
    const releaseHref = `${publicPath(lang, '/changelog')}#release-v1-6-7`;
    expect(container.querySelector('.pe-outline-release')).toHaveAttribute('href', releaseHref);
    expect(container.querySelectorAll(`a[href="${releaseHref}"]`)).toHaveLength(2);
    expect(container.querySelectorAll('a[href$="#v1.6.7"]')).toHaveLength(0);
    expect(container.querySelector('.pe-doc-workspace')).toHaveAttribute('href', '/login');
    const native = container.querySelector('.pe-doc-native-nav nav')!;
    expect(native.querySelectorAll('a')).toHaveLength(43);
    expect(native.querySelector('a[aria-current="page"]')).toHaveAttribute('href', publicPath(lang, '/docs/first-query'));
  });

  it.each(['vi', 'en'] as const)('adds three public pages and separate footer shortcuts without replacing topic navigation in %s', lang => {
    const { container } = render(view(publicPath(lang, '/docs/first-query')));
    const explore = container.querySelector<HTMLDetailsElement>('.pe-doc-explore')!;
    fireEvent.click(explore.querySelector('summary')!);
    expect(explore).toHaveAttribute('open');
    expect(container.querySelectorAll('.pe-doc-pages')).toHaveLength(2);
    for (const selector of ['.pe-doc-desktop-pages', '.pe-doc-compact-pages']) {
      const pageNavigation = container.querySelector<HTMLElement>(selector)!;
      expect(pageNavigation.tagName).toBe('NAV');
      expect(pageNavigation).toHaveAccessibleName(lang === 'vi' ? 'Điều hướng chính' : 'Main navigation');
      const links = within(pageNavigation).getAllByRole('link');
      expect(links.map(link => link.textContent)).toEqual(lang === 'vi' ? ['Trang chủ', 'Tài liệu', 'Cập nhật'] : ['Home', 'Documentation', 'Changelog']);
      expect(links.map(link => link.getAttribute('href'))).toEqual(['/', '/docs', '/changelog'].map(path => publicPath(lang, path)));
      expect(pageNavigation.querySelectorAll('[aria-current]')).toHaveLength(1);
      expect(links[1]).toHaveAttribute('aria-current', 'page');
      expect(links[0]).not.toHaveAttribute('aria-current');
      expect(links[2]).not.toHaveAttribute('aria-current');
    }
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    expect(explore.querySelector('.pe-doc-explore-panel .pe-doc-native-nav')).toBeInTheDocument();
    expect(container.querySelectorAll('.pe-doc-native-nav nav a[href]')).toHaveLength(43);
    const menu = screen.getByRole('button', { name: lang === 'vi' ? 'Mở menu tài liệu' : 'Open documentation menu' });
    expect(menu).toHaveAttribute('aria-controls', 'public-docs-menu');
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    const footer = container.querySelector('.pe-doc-footer')!;
    const shortcuts = container.querySelector<HTMLElement>('.pe-doc-page-shortcuts')!;
    expect(footer.querySelectorAll('a')).toHaveLength(1);
    expect(footer.nextElementSibling).toBe(shortcuts);
    expect(shortcuts.tagName).toBe('NAV');
    expect(shortcuts).toHaveAccessibleName(lang === 'vi' ? 'Khám phá Data Explorer' : 'Explore Data Explorer');
    expect(within(shortcuts).getAllByRole('link')).toHaveLength(2);
    expect(within(shortcuts).getByRole('link', { name: lang === 'vi' ? 'Trang chủ' : 'Home' })).toHaveAttribute('href', publicPath(lang, '/'));
    expect(within(shortcuts).getByRole('link', { name: lang === 'vi' ? 'Cập nhật sản phẩm' : 'Product updates' })).toHaveAttribute('href', publicPath(lang, '/changelog'));
    expect(shortcuts.querySelector('a[href="/login"], a[href="/sql-explorer"]')).not.toBeInTheDocument();
  });

  it('keeps the drawer topic links localized and returns focus when dismissed', async () => {
    render(view('/en/docs/first-query'));
    const menu = screen.getByRole('button', { name: 'Open documentation menu' });
    fireEvent.click(menu);
    const drawer = await screen.findByRole('dialog');
    expect(drawer).toHaveAttribute('id', 'public-docs-menu');
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    const topics = within(drawer).getByRole('navigation', { name: 'Documentation navigation' });
    const links = within(topics).getAllByRole('link');
    expect(links).toHaveLength(43);
    expect(links.every(link => link.getAttribute('href')?.startsWith('/en/docs/'))).toBe(true);
    expect(topics.querySelectorAll('[aria-current]')).toHaveLength(1);
    expect(topics.querySelector('[aria-current="page"]')).toHaveAttribute('href', '/en/docs/first-query');
    fireEvent.keyDown(drawer, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(menu).toHaveFocus());
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
  });

  it('searches new topics with locale-preserving anchors', () => {
    render(view('/en/docs/first-query'));
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'ClickHouse' } });
    const results = screen.getByRole('listbox');
    expect(within(results).getByRole('option', { name: /ClickHouse/ })).toHaveAttribute('href', '/en/docs/clickhouse');
  });

  it.each(['vi', 'en'] as const)('filters all eight catalog groups without changing the article, sidebar or native anchors in %s', async lang => {
    const user = userEvent.setup();
    const path = publicPath(lang, '/docs/first-query');
    const { container } = render(view(path));
    const input = screen.getByRole('combobox');
    const label = lang === 'vi' ? 'Bộ lọc' : 'Filter';
    const topics = lang === 'vi' ? 'chủ đề' : 'topics';
    const heading = screen.getByRole('heading', { level: 1 });
    const headingText = heading.textContent;
    const article = container.querySelector('[data-doc-topic="first-query"]');
    const sidebar = container.querySelector('.pe-doc-sidebar .doc-sidebar-nav')!;
    const native = container.querySelector('.pe-doc-native-nav nav')!;
    const sidebarHrefs = Array.from(sidebar.querySelectorAll('a[href]'), link => link.getAttribute('href'));
    const nativeHrefs = Array.from(native.querySelectorAll('a[href]'), link => link.getAttribute('href'));
    const url = window.location.href;
    expect(container.querySelectorAll('.pe-doc-search-tools')).toHaveLength(1);
    expect(sidebarHrefs).toHaveLength(43);
    expect(nativeHrefs).toHaveLength(43);
    await user.click(input);
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(8);
    expect(screen.getByRole('status')).toHaveTextContent(`8/43 ${topics}`);
    const filter = screen.getByRole('button', { name: label });
    await user.click(filter);
    const menu = await screen.findByRole('menu');
    expect(menu).toHaveClass('public-experience', 'pe-doc-filter-menu');
    expect(container.contains(menu)).toBe(false);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    const choices = within(within(menu).getByRole('group', { name: lang === 'vi' ? 'Nhóm tài liệu' : 'Documentation groups' })).getAllByRole('menuitemradio');
    const modes = within(within(menu).getByRole('group', { name: lang === 'vi' ? 'Cách lọc' : 'Filter mode' })).getAllByRole('menuitemradio');
    expect(modes).toHaveLength(2);
    expect(modes[0]).toHaveAttribute('aria-checked', 'true');
    expect(modes[1]).toHaveAttribute('aria-checked', 'false');
    expect(within(menu).getByRole('menuitem', { name: lang === 'vi' ? 'Bỏ lọc' : 'Clear filter' })).toHaveAttribute('aria-disabled', 'true');
    expect(choices).toHaveLength(9);
    expect(choices[0]).toHaveTextContent(lang === 'vi' ? 'Tất cả chủ đề' : 'All topics');
    expect(within(choices[0]).getByText('43', { exact: true })).toBeInTheDocument();
    for (const [index, group] of DOCS_CATALOG.entries()) {
      expect(choices[index + 1]).toHaveTextContent(lang === 'vi' ? group.title : group.titleEn);
      expect(within(choices[index + 1]).getByText(String(group.items.length), { exact: true })).toBeInTheDocument();
    }
    const connections = DOCS_CATALOG.find(group => group.id === 'connections')!;
    const connectionTitle = lang === 'vi' ? connections.title : connections.titleEn;
    await user.click(within(menu).getByRole('menuitemradio', { name: new RegExp(`^${connectionTitle}`) }));
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveValue('');
    expect(filter).toHaveAttribute('aria-label', `${label}: ${lang === 'vi' ? 'Chỉ hiển thị' : 'Include only'} · ${connectionTitle}`);
    expect(filter).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(`8/9 ${topics}`);
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options.map(option => option.getAttribute('href'))).toEqual(connections.items.slice(0, 8).map(topic => publicPath(lang, `/docs/${topic.id}`)));
    expect(options.every(option => option.tagName === 'A')).toBe(true);
    fireEvent.change(input, { target: { value: 'postgres' } });
    expect(screen.getByRole('option')).toHaveAttribute('href', publicPath(lang, '/docs/postgres'));
    expect(screen.getByRole('status')).toHaveTextContent(`1/1 ${topics}`);
    fireEvent.change(input, { target: { value: 'Monaco' } });
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(lang === 'vi' ? 'Không tìm thấy' : 'No matching topics');
    expect(screen.getByRole('status')).toHaveTextContent(`0/0 ${topics}`);
    await user.click(screen.getByRole('button', { name: lang === 'vi' ? 'Xóa tìm kiếm' : 'Clear search' }));
    expect(input).toHaveFocus();
    expect(input).toHaveValue('');
    expect(filter).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(`8/9 ${topics}`);
    await user.click(screen.getByRole('button', { name: lang === 'vi' ? 'Đặt lại bộ lọc' : 'Reset filter' }));
    expect(input).toHaveFocus();
    expect(input).toHaveValue('');
    expect(filter).toHaveAccessibleName(label);
    expect(screen.getByRole('status')).toHaveTextContent(`8/43 ${topics}`);
    expect(heading).toHaveTextContent(headingText!);
    expect(container.querySelector('[data-doc-topic="first-query"]')).toBe(article);
    expect(Array.from(sidebar.querySelectorAll('a[href]'), link => link.getAttribute('href'))).toEqual(sidebarHrefs);
    expect(Array.from(native.querySelectorAll('a[href]'), link => link.getAttribute('href'))).toEqual(nativeHrefs);
    expect(sidebar.querySelector('[aria-current="page"]')).toHaveAttribute('href', path);
    expect(native.querySelector('[aria-current="page"]')).toHaveAttribute('href', path);
    expect(window.location.href).toBe(url);
  });

  it('preserves the introduction Knowledge Hub rather than adding a new overview', () => {
    const { container } = render(view('/docs'));
    expect(container.querySelector('.pe-doc-intro')).toBeInTheDocument();
    expect(container.querySelector('.pe-doc-intro .pe-scene')).toBeInTheDocument();
    expect(container.querySelector('[data-doc-topic="introduction"]')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('supports static output for each new route without a browser-only fallback', () => {
    for (const id of ['first-query', 'sqlite', 'clickhouse', 'database-capabilities', 'operational-limits', 'data-migration', 'data-handling']) for (const lang of ['vi', 'en'] as const) {
      const html = renderToStaticMarkup(view(publicPath(lang, `/docs/${id}`)));
      expect(html).toContain('<main');
      expect(html).toContain(`data-doc-topic="${id}"`);
      expect(html.match(/<h1\b/g)).toHaveLength(1);
      expect(html).not.toMatch(/Coming Soon|data-static-content/);
      expect(html).toContain(`href="${publicPath(lang, '/docs/editor')}"`);
    }
  });

  it.each(['vi', 'en'] as const)('uses an uncontrolled localized Explore disclosure and preserves search Escape in %s', lang => {
    const { container } = render(view(publicPath(lang, '/docs/first-query')));
    const explore = container.querySelector<HTMLDetailsElement>('.pe-doc-explore')!;
    const summary = explore.querySelector('summary')!;
    expect(summary).toHaveTextContent(lang === 'vi' ? 'Khám phá' : 'Explore');
    expect(summary).toHaveAccessibleName(lang === 'vi' ? 'Khám phá' : 'Explore');
    expect(explore.open).toBe(false);
    fireEvent.click(summary);
    expect(explore.open).toBe(true);
    fireEvent.click(summary);
    expect(explore.open).toBe(false);
    fireEvent.click(summary);
    const input = screen.getByRole('combobox');
    act(() => input.focus());
    fireEvent.change(input, { target: { value: 'SQL' } });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(fireEvent.keyDown(input, { key: 'Escape' })).toBe(false);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(explore.open).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(explore.open).toBe(false);
    expect(summary).toHaveFocus();
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
  });

  it('closes Explore on an outside pointer without stealing focus', () => {
    const { container } = render(view('/en/docs/first-query'));
    const explore = container.querySelector<HTMLDetailsElement>('.pe-doc-explore')!;
    fireEvent.click(explore.querySelector('summary')!);
    const input = screen.getByRole('combobox');
    act(() => input.focus());
    fireEvent.pointerDown(input);
    expect(explore.open).toBe(false);
    expect(input).toHaveFocus();
  });

  it('closes Explore on a public link without preventing native navigation', () => {
    const { container } = render(view('/en/docs/first-query'));
    const explore = container.querySelector<HTMLDetailsElement>('.pe-doc-explore')!;
    fireEvent.click(explore.querySelector('summary')!);
    const nav = within(container.querySelector<HTMLElement>('.pe-doc-compact-pages')!);
    const link = nav.getByRole('link', { name: 'Documentation' });
    expect(link).toHaveAttribute('href', '/en/docs');
    let navigationPrevented: boolean | undefined;
    container.addEventListener('click', event => {
      navigationPrevented = event.defaultPrevented;
      event.preventDefault(); // Avoid jsdom navigation only after the component's handler ran.
    }, { once: true });
    fireEvent.click(link);
    expect(navigationPrevented).toBe(false);
    expect(explore.open).toBe(false);
  });

  it.each(['vi', 'en'] as const)('keeps the native Explore, public links and all 43 topics in static %s output', lang => {
    const container = document.createElement('div');
    container.innerHTML = renderToStaticMarkup(view(publicPath(lang, '/docs/first-query')));
    const root = container.querySelector('.public-docs')!;
    const header = container.querySelector('.pe-doc-header')!;
    const explore = header.querySelector<HTMLDetailsElement>('.pe-doc-explore')!;
    expect(root).toHaveAttribute('data-enhanced', 'false');
    expect(explore.open).toBe(false);
    expect(explore.querySelector('summary')).toHaveTextContent(lang === 'vi' ? 'Khám phá' : 'Explore');
    expect(explore.querySelector('summary')).toHaveAccessibleName(lang === 'vi' ? 'Khám phá' : 'Explore');
    const tools = header.querySelector('.pe-doc-search-tools')!;
    expect(tools.querySelector('[role="combobox"]')).toHaveAttribute('aria-expanded', 'false');
    expect(tools.querySelector('.pe-doc-filter')).toHaveAccessibleName(lang === 'vi' ? 'Bộ lọc' : 'Filter');
    expect(container.querySelector('.pe-doc-filter-menu')).toBeNull();
    const panel = explore.querySelector('.pe-doc-explore-panel')!;
    const publicLinks = panel.querySelectorAll('.pe-doc-compact-pages a[href]');
    expect(Array.from(publicLinks, link => link.getAttribute('href'))).toEqual(['/', '/docs', '/changelog'].map(path => publicPath(lang, path)));
    const native = panel.querySelector<HTMLDetailsElement>('.pe-doc-native-nav')!;
    expect(native.open).toBe(false);
    expect(native.querySelectorAll('nav a[href]')).toHaveLength(43);
    expect(native.querySelector('a[aria-current="page"]')).toHaveAttribute('href', publicPath(lang, '/docs/first-query'));
    expect(panel.querySelector('.pe-doc-explore-workspace')).toHaveAttribute('href', '/login');
    expect(header.querySelectorAll('[role="combobox"]')).toHaveLength(1);
    expect(header.querySelector('.pe-doc-word, .pe-button-primary')).toBeNull();
    expect(header.querySelector('.pe-doc-workspace')).toHaveClass('pe-button');
    expect(container.querySelector('.pe-doc-next-step .pe-button-primary')).not.toBeNull();
  });

  it('keeps authenticated workspace navigation outside localized public routes', () => {
    const { container } = render(view('/en/docs/editor', true));
    expect(container.querySelector('.pe-doc-workspace')).toHaveAttribute('href', '/sql-explorer');
    expect(container.querySelector('.pe-doc-explore-workspace')).toHaveAttribute('href', '/sql-explorer');
    expect(container.querySelector('.pe-doc-next-step a')).toHaveAttribute('href', '/sql-explorer');
  });
});

function navigationView(path: string, navigateDocs?: DocsNavigate) {
  return <PublicDocsNavigationContext.Provider value={navigateDocs}>{view(path)}</PublicDocsNavigationContext.Provider>;
}

function observeDocsClick(target: HTMLElement, options: MouseEventInit = {}) {
  let prevented: boolean | undefined;
  document.addEventListener('click', event => {
    prevented = event.defaultPrevented;
    event.preventDefault(); // Suppress jsdom navigation after React handled the event.
  }, { once: true });
  fireEvent.click(target, options);
  return prevented;
}

function stubDocsLocationAssign() {
  // jsdom's Location wrapper is non-configurable; mock its delegate, not window.
  const implementationKey = Object.getOwnPropertySymbols(window.location).find(key => key.description === 'impl');
  if (!implementationKey) throw new Error('Expected jsdom Location implementation');
  const implementation = Reflect.get(window.location, implementationKey) as { assign: (href: string) => void };
  return vi.spyOn(implementation, 'assign').mockImplementation(() => {});
}

const originalDocsUrl = window.location.href;
const originalDocsHistoryState = window.history.state;
const originalDocsScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');

describe('DocumentationView in-place navigation', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/en/docs/editor');
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, writable: true, value: vi.fn() });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (originalDocsScrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalDocsScrollIntoView);
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
    window.history.replaceState(originalDocsHistoryState, '', originalDocsUrl);
  });

  it('prevents an accepted primary docs link from a nested span and closes Explore', () => {
    const navigateDocs = vi.fn<DocsNavigate>(() => true);
    const { container } = render(navigationView('/en/docs/editor', navigateDocs));
    const explore = container.querySelector<HTMLDetailsElement>('.pe-doc-explore')!;
    fireEvent.click(explore.querySelector('summary')!);
    expect(explore.open).toBe(true);
    const sidebar = within(container.querySelector<HTMLElement>('.pe-doc-sidebar .doc-sidebar-nav')!);
    const link = sidebar.getByRole('link', { name: getDocTopic('results')!.titleEn });
    expect(observeDocsClick(link.querySelector('span')!)).toBe(true);
    expect(navigateDocs).toHaveBeenCalledOnce();
    expect(new URL(navigateDocs.mock.calls[0][0]).pathname).toBe('/en/docs/results');
    expect(explore.open).toBe(false);
    expect(link).toHaveAttribute('href', '/en/docs/results');
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
  });

  it('handles a portaled drawer link through React bubbling and dismisses the drawer', async () => {
    const navigateDocs = vi.fn<DocsNavigate>(() => true);
    const { container } = render(navigationView('/en/docs/editor', navigateDocs));
    fireEvent.click(screen.getByRole('button', { name: 'Open documentation menu' }));
    const drawer = await screen.findByRole('dialog');
    expect(container.contains(drawer)).toBe(false);
    const topics = within(drawer).getByRole('navigation', { name: 'Documentation navigation' });
    const link = within(topics).getByRole('link', { name: getDocTopic('results')!.titleEn });
    expect(observeDocsClick(link)).toBe(true);
    expect(navigateDocs).toHaveBeenCalledOnce();
    expect(new URL(navigateDocs.mock.calls[0][0]).pathname).toBe('/en/docs/results');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Open documentation menu' })).toHaveAttribute('aria-expanded', 'false');
  });

  it.each(['declined', 'unavailable'])('preserves native anchor navigation when the callback is %s', availability => {
    const navigateDocs = availability === 'declined' ? vi.fn(() => false) : undefined;
    const { container } = render(navigationView('/en/docs/editor', navigateDocs));
    const sidebar = within(container.querySelector<HTMLElement>('.pe-doc-sidebar .doc-sidebar-nav')!);
    const link = sidebar.getByRole('link', { name: getDocTopic('results')!.titleEn });
    expect(observeDocsClick(link)).toBe(false);
    expect(link).toHaveAttribute('href', '/en/docs/results');
    if (navigateDocs) expect(navigateDocs).toHaveBeenCalledOnce();
  });

  it.each([
    { label: 'Ctrl', options: { ctrlKey: true } },
    { label: 'Meta', options: { metaKey: true } },
    { label: 'Shift', options: { shiftKey: true } },
    { label: 'Alt', options: { altKey: true } },
    { label: 'middle button', options: { button: 1 } },
    { label: 'download', attribute: 'download', value: '' },
    { label: 'new target', attribute: 'target', value: '_blank' },
    { label: 'fragment only', attribute: 'href', value: '#query' },
  ])('does not intercept $label docs anchors', ({ options, attribute, value }) => {
    const navigateDocs = vi.fn<DocsNavigate>(() => true);
    const { container } = render(navigationView('/en/docs/editor', navigateDocs));
    const sidebar = within(container.querySelector<HTMLElement>('.pe-doc-sidebar .doc-sidebar-nav')!);
    const link = sidebar.getByRole('link', { name: getDocTopic('results')!.titleEn });
    if (attribute) link.setAttribute(attribute, value!);
    expect(observeDocsClick(link, options)).toBe(false);
    expect(navigateDocs).not.toHaveBeenCalled();
  });

  it('allows an explicit self target but respects an already prevented event', () => {
    const navigateDocs = vi.fn<DocsNavigate>(() => true);
    const { container, rerender } = render(navigationView('/en/docs/editor', navigateDocs));
    const sidebar = within(container.querySelector<HTMLElement>('.pe-doc-sidebar .doc-sidebar-nav')!);
    const link = sidebar.getByRole('link', { name: getDocTopic('results')!.titleEn });
    link.setAttribute('target', '_self');
    expect(observeDocsClick(link)).toBe(true);
    expect(navigateDocs).toHaveBeenCalledOnce();
    navigateDocs.mockClear();
    rerender(<div onClickCapture={event => event.preventDefault()}>{navigationView('/en/docs/editor', navigateDocs)}</div>);
    const protectedSidebar = within(container.querySelector<HTMLElement>('.pe-doc-sidebar .doc-sidebar-nav')!);
    fireEvent.click(protectedSidebar.getByRole('link', { name: getDocTopic('results')!.titleEn }));
    expect(navigateDocs).not.toHaveBeenCalled();
  });

  it.each(['accepted', 'declined', 'unavailable'])('uses the breadcrumb callback before its assignment fallback when %s', availability => {
    const assign = stubDocsLocationAssign();
    const navigateDocs = availability === 'unavailable' ? undefined : vi.fn<DocsNavigate>(() => availability === 'accepted');
    const { container } = render(navigationView('/en/docs/editor', navigateDocs));
    const breadcrumb = within(container.querySelector<HTMLElement>('.pe-doc-breadcrumb')!);
    fireEvent.click(breadcrumb.getByRole('button', { name: 'Documentation' }));
    if (navigateDocs) expect(navigateDocs).toHaveBeenCalledWith('/en/docs/introduction');
    if (availability === 'accepted') expect(assign).not.toHaveBeenCalled();
    else {
      expect(assign).toHaveBeenCalledWith('/en/docs/introduction');
      if (navigateDocs) expect(navigateDocs.mock.invocationCallOrder[0]).toBeLessThan(assign.mock.invocationCallOrder[0]);
    }
  });

  it.each(['include', 'exclude'] as const)('resets only article scrolling and focuses the H1 after topic or language changes while preserving %s filters', async mode => {
    const user = userEvent.setup();
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    const windowScroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const navigateDocs = vi.fn<DocsNavigate>(() => true);
    const { container, rerender } = render(navigationView('/en/docs/editor', navigateDocs));
    await waitFor(() => expect(container.querySelector('.public-docs')).toHaveAttribute('data-enhanced', 'true'));
    const firstHeading = screen.getByRole('heading', { level: 1 });
    expect(focus.mock.contexts).not.toContain(firstHeading);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'postgres' } });
    await user.click(screen.getByRole('button', { name: 'Filter' }));
    await user.click(within(await screen.findByRole('menu')).getByRole('menuitemradio', { name: /^Connections/ }));
    await waitFor(() => expect(input).toHaveFocus());
    if (mode === 'exclude') {
      await user.click(screen.getByRole('button', { name: 'Filter: Include only · Connections' }));
      await user.click(within(await screen.findByRole('menu')).getByRole('menuitemradio', { name: 'Exclude' }));
      await waitFor(() => expect(input).toHaveFocus());
      expect(screen.getByRole('status')).toHaveTextContent('0/0 topics');
    }
    const articleScroll = container.querySelector<HTMLElement>('.pe-doc-scroll')!;
    const sidebarScroll = container.querySelector<HTMLElement>('.pe-doc-sidebar .doc-sidebar-nav')!;
    const resetArticleScroll = vi.fn((options: ScrollToOptions) => {
      expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
      articleScroll.scrollTop = options.top ?? articleScroll.scrollTop;
    });
    Object.defineProperty(articleScroll, 'scrollTo', { configurable: true, value: resetArticleScroll });
    articleScroll.scrollTop = 420;
    sidebarScroll.scrollTop = 87;
    rerender(navigationView('/en/docs/results', navigateDocs));
    const nextHeading = screen.getByRole('heading', { level: 1 });
    await waitFor(() => expect(nextHeading).toHaveFocus());
    expect(nextHeading).toHaveAttribute('tabindex', '-1');
    const focusIndex = focus.mock.contexts.lastIndexOf(nextHeading);
    expect(focus.mock.calls[focusIndex]).toEqual([{ preventScroll: true }]);
    expect(resetArticleScroll).toHaveBeenCalledOnce();
    expect(resetArticleScroll).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' });
    expect(articleScroll.scrollTop).toBe(0);
    expect(sidebarScroll.scrollTop).toBe(87);
    expect(screen.getByRole('combobox')).toBe(input);
    expect(input).toHaveValue('postgres');
    expect(screen.getByRole('button', { name: `Filter: ${mode === 'include' ? 'Include only' : 'Exclude'} · Connections` })).toHaveAttribute('data-active', 'true');
    articleScroll.scrollTop = 230;
    rerender(navigationView('/docs/results', navigateDocs));
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
      expect(resetArticleScroll).toHaveBeenCalledTimes(2);
    });
    expect(resetArticleScroll).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' });
    expect(articleScroll.scrollTop).toBe(0);
    expect(sidebarScroll.scrollTop).toBe(87);
    expect(input).toHaveValue('postgres');
    expect(screen.getByRole('button', { name: `Bộ lọc: ${mode === 'include' ? 'Chỉ hiển thị' : 'Loại trừ'} · Kết nối` })).toHaveAttribute('data-active', 'true');
    expect(windowScroll).not.toHaveBeenCalled();
  });

  it('honors a changed article hash without refocusing the H1 or resetting scroll containers', async () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    const { container } = render(navigationView('/en/docs/editor', vi.fn(() => true)));
    await waitFor(() => expect(container.querySelector('.public-docs')).toHaveAttribute('data-enhanced', 'true'));
    const target = container.querySelector<HTMLElement>('.pe-doc-article h2')!;
    await waitFor(() => expect(target.id).not.toBe(''));
    const scroll = container.querySelector<HTMLElement>('.pe-doc-scroll')!;
    const resetArticleScroll = vi.fn();
    Object.defineProperty(scroll, 'scrollTo', { configurable: true, value: resetArticleScroll });
    scroll.scrollTop = 310;
    const scrollIntoView = vi.mocked(HTMLElement.prototype.scrollIntoView);
    scrollIntoView.mockClear();
    act(() => {
      window.history.replaceState(null, '', `/en/docs/editor#${encodeURIComponent(target.id)}`);
      window.dispatchEvent(new Event(PUBLIC_DOCS_NAVIGATION_EVENT));
    });
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' }));
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(target);
    expect(scroll.scrollTop).toBe(310);
    expect(resetArticleScroll).not.toHaveBeenCalled();
    expect(focus.mock.contexts).not.toContain(screen.getByRole('heading', { level: 1 }));
  });
});
