import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PublicReadingFooter, PublicReadingHeader } from './PublicReadingChrome';
import { PublicNavigationContext } from './PublicNavigationContext';
import { resolvePublicRoute } from '@/core/seo/publicRoutes';

const route = resolvePublicRoute('/en/changelog')!;

describe('PublicReadingChrome', () => {
    it('keeps locale-aware native navigation and the auth-aware workspace link', () => {
        const onLogout = vi.fn();
        const { container, rerender } = render(<PublicNavigationContext.Provider value={route}><PublicReadingHeader lang="en" isAuthenticated={false} /></PublicNavigationContext.Provider>);
        const navigation = container.querySelector<HTMLElement>('.pe-header-nav')!;
        expect(within(navigation).getAllByRole('link')).toHaveLength(3);
        expect(within(navigation).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/en');
        expect(screen.getByRole('link', { name: 'Documentation' })).toHaveAttribute('href', '/en/docs');
        expect(screen.getByRole('link', { name: /Changelog/ })).toHaveAttribute('aria-current', 'page');
        expect(navigation.querySelectorAll('[aria-current]')).toHaveLength(1);
        const workspace = screen.getByRole('link', { name: 'Workspace' });
        expect(workspace).toHaveAttribute('href', '/login');
        expect(workspace).toHaveClass('pe-header-workspace');
        expect(workspace.closest('.pe-header-actions')).toBeInTheDocument();
        expect(workspace).not.toHaveAttribute('hidden');
        expect(workspace.className).not.toMatch(/(?:^|\s)(?:(?:sm|md|lg|xl|2xl):)?hidden(?:\s|$)/);
        expect(within(navigation).queryByRole('link', { name: 'Workspace' })).not.toBeInTheDocument();
        expect(container.querySelector('.pe-mobile-workspace')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
        rerender(<PublicNavigationContext.Provider value={route}><PublicReadingHeader lang="en" isAuthenticated onLogout={onLogout} /></PublicNavigationContext.Provider>);
        expect(screen.getAllByRole('link', { name: 'Workspace' })).toHaveLength(1);
        expect(screen.getByRole('link', { name: 'Workspace' })).toHaveAttribute('href', '/sql-explorer');
        const logout = screen.getByRole('button', { name: 'Logout' });
        expect(logout).toBeInTheDocument();
        fireEvent.click(logout);
        expect(onLogout).toHaveBeenCalledOnce();
    });

    it.each([
        { path: '/changelog', lang: 'vi', active: 'Cập nhật', labels: ['Trang chủ', 'Tài liệu', 'Cập nhật'], hrefs: ['/', '/docs', '/changelog'] },
        { path: '/docs/editor', lang: 'vi', active: 'Tài liệu', labels: ['Trang chủ', 'Tài liệu', 'Cập nhật'], hrefs: ['/', '/docs', '/changelog'] },
        { path: '/en/docs/editor', lang: 'en', active: 'Documentation', labels: ['Home', 'Documentation', 'Changelog'], hrefs: ['/en', '/en/docs', '/en/changelog'] },
    ] as const)('marks exactly the active public page for $path', ({ path, lang, active, labels, hrefs }) => {
        const currentRoute = resolvePublicRoute(path)!;
        const { container } = render(<PublicNavigationContext.Provider value={currentRoute}><PublicReadingHeader lang={lang} isAuthenticated={false} /></PublicNavigationContext.Provider>);
        const navigation = container.querySelector<HTMLElement>('.pe-header-nav')!;
        const links = within(navigation).getAllByRole('link');
        expect(links.map(link => link.textContent)).toEqual(labels);
        expect(links.map(link => link.getAttribute('href'))).toEqual(hrefs);
        expect(navigation.querySelectorAll('[aria-current]')).toHaveLength(1);
        expect(within(navigation).getByRole('link', { name: active })).toHaveAttribute('aria-current', 'page');
        expect(within(navigation).queryByRole('button')).not.toBeInTheDocument();
    });

    it('preserves footer shortcuts without fake live status', () => {
        render(<PublicNavigationContext.Provider value={route}><PublicReadingFooter lang="en" /></PublicNavigationContext.Provider>);
        for (const link of screen.getAllByRole('link', { name: 'Documentation' })) expect(link).toHaveAttribute('href', '/en/docs');
        expect(screen.queryByText(/Status: Ready/)).not.toBeInTheDocument();
    });
});
