import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publicPath } from '@/core/seo/publicRoutes';
import { LandingHeaderView } from './LandingHeaderView';

function desktopMedia(matches = false) {
    return {
        matches,
        media: '(min-width: 1101px)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
    };
}

beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => desktopMedia()));
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

for (const appearance of ['default', 'landing'] as const) {
    describe(`${appearance} header logout`, () => {
        it('lets the logout callback finish before any document navigation', async () => {
            let finish!: () => void;
            const logout = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
            const navigate = vi.fn();
            render(<LandingHeaderView lang="en" isAuthenticated logout={logout} isMobileNavOpen={appearance === 'landing'} setIsMobileNavOpen={vi.fn()} language={null} navigate={navigate} appearance={appearance} />);
            fireEvent.click(screen.getByRole('button', { name: /^Logout$/ }));
            expect(logout).toHaveBeenCalledOnce();
            expect(navigate).not.toHaveBeenCalled();
            finish();
            await Promise.resolve();
            expect(navigate).not.toHaveBeenCalled();
        });
    });
}

describe('landing public-page navigation', () => {
    it.each(['vi', 'en'] as const)('keeps the same three localized pages on desktop and mobile in %s', lang => {
        const navigate = vi.fn();
        const closeMenu = vi.fn();
        const { container } = render(<LandingHeaderView lang={lang} isAuthenticated={false} logout={vi.fn()} isMobileNavOpen setIsMobileNavOpen={closeMenu} language={<span>Language utility</span>} navigate={navigate} appearance="landing" />);
        const desktop = screen.getByRole('navigation', { name: lang === 'vi' ? 'Điều hướng chính' : 'Main navigation' });
        const mobile = screen.getByRole('navigation', { name: lang === 'vi' ? 'Điều hướng di động' : 'Mobile navigation' });
        const labels = lang === 'vi' ? ['Trang chủ', 'Tài liệu', 'Cập nhật'] : ['Home', 'Documentation', 'Changelog'];
        const hrefs = ['/', '/docs', '/changelog'].map(path => publicPath(lang, path));
        const desktopLinks = within(desktop).getAllByRole('link');
        expect(desktopLinks.map(link => link.textContent)).toEqual(labels);
        expect(desktopLinks.map(link => link.getAttribute('href'))).toEqual(hrefs);
        const mobileLinks = mobile.querySelectorAll<HTMLAnchorElement>('a.lp-header-link');
        expect(Array.from(mobileLinks, link => link.textContent)).toEqual(labels);
        expect(Array.from(mobileLinks, link => link.getAttribute('href'))).toEqual(hrefs);
        for (const navigation of [desktop, mobile]) {
            expect(navigation.querySelectorAll('[aria-current]')).toHaveLength(1);
            expect(within(navigation).getByRole('link', { name: labels[0] })).toHaveAttribute('aria-current', 'page');
            for (const label of labels.slice(1)) expect(within(navigation).getByRole('link', { name: label })).not.toHaveAttribute('aria-current');
        }
        expect(container.querySelector('header a[href="#features"], header a[href="#demo"], header a[href="#pricing"]')).not.toBeInTheDocument();
        expect(within(mobile).getByRole('link', { name: lang === 'vi' ? 'Chạy local' : 'Run locally' })).toHaveAttribute('href', '#get-started');
        expect(screen.getAllByText('Language utility')).toHaveLength(2);
        expect(container.querySelector('.lp-header-actions .lp-header-cta')).toHaveAttribute('href', '/login');
        expect(container.querySelector('.lp-mobile-utilities a')).toHaveAttribute('href', '/login');
        expect(screen.getByRole('button', { name: lang === 'vi' ? 'Bật/tắt menu' : 'Toggle menu' })).toHaveAttribute('aria-expanded', 'true');
        expect(closeMenu).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
    });

    it('closes the mobile menu without canceling native page-link navigation', () => {
        const closeMenu = vi.fn();
        const navigate = vi.fn();
        render(<LandingHeaderView lang="en" isAuthenticated={false} logout={vi.fn()} isMobileNavOpen setIsMobileNavOpen={closeMenu} language={null} navigate={navigate} hrefFor={path => `#${path === '/en' ? 'home' : path.slice(4)}`} appearance="landing" />);
        const mobile = screen.getByRole('navigation', { name: 'Mobile navigation' });
        const link = within(mobile).getByRole('link', { name: 'Documentation' });
        const click = new MouseEvent('click', { bubbles: true, cancelable: true });
        expect(fireEvent(link, click)).toBe(true);
        expect(click.defaultPrevented).toBe(false);
        expect(link).toHaveAttribute('href', '#docs');
        expect(closeMenu).toHaveBeenCalledExactlyOnceWith(false);
        expect(navigate).not.toHaveBeenCalled();
    });

    it('keeps authenticated workspace destinations outside the localized public pages', () => {
        const { container } = render(<LandingHeaderView lang="en" isAuthenticated logout={vi.fn()} isMobileNavOpen setIsMobileNavOpen={vi.fn()} language={null} navigate={vi.fn()} appearance="landing" />);
        expect(container.querySelector('.lp-header-cta')).toHaveAttribute('href', '/sql-explorer');
        expect(container.querySelector('.lp-mobile-utilities a')).toHaveAttribute('href', '/sql-explorer');
        expect(screen.getByRole('navigation', { name: 'Main navigation' }).querySelector('a[href="/sql-explorer"]')).not.toBeInTheDocument();
    });

    it('resets an open menu at the desktop breakpoint and removes its listeners on unmount', () => {
        const desktop = desktopMedia(true);
        vi.stubGlobal('matchMedia', vi.fn(() => desktop));
        const closeMenu = vi.fn();
        const removeKeyDown = vi.spyOn(window, 'removeEventListener');
        const { unmount } = render(<LandingHeaderView lang="en" isAuthenticated={false} logout={vi.fn()} isMobileNavOpen setIsMobileNavOpen={closeMenu} language={null} navigate={vi.fn()} appearance="landing" />);
        expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 1101px)');
        expect(closeMenu).toHaveBeenCalledExactlyOnceWith(false);
        expect(desktop.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
        const onChange = desktop.addEventListener.mock.calls[0][1] as () => void;
        closeMenu.mockClear();
        desktop.matches = false;
        onChange();
        expect(closeMenu).not.toHaveBeenCalled();
        desktop.matches = true;
        onChange();
        expect(closeMenu).toHaveBeenCalledExactlyOnceWith(false);
        unmount();
        expect(desktop.removeEventListener).toHaveBeenCalledWith('change', onChange);
        expect(removeKeyDown).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
});
