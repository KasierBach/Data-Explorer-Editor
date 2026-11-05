import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LandingHeader } from './LandingHeader';
import { LandingFooter } from './LandingFooter';

const props = {
    lang: 'vi',
    isAuthenticated: false,
    logout: vi.fn(),
    isMobileNavOpen: false,
    setIsMobileNavOpen: vi.fn(),
};

const sectionLinkClass = 'hover:text-white text-muted-foreground/80 transition-colors uppercase tracking-[0.15em] text-[10px] font-semibold';

describe('landing appearance opt-in', () => {
    it('keeps the original default header labels, typography, and chrome', () => {
        const { container } = render(<MemoryRouter><LandingHeader {...props} /></MemoryRouter>);

        expect(container.querySelector('header')).toHaveClass('bg-background/40', 'backdrop-blur-2xl');
        expect(container.querySelector('header')).not.toHaveClass('lp-chrome');
        for (const label of ['Tính năng', 'Bản demo', 'Giá cả']) {
            expect(screen.getByRole('link', { name: label })).toHaveAttribute('class', sectionLinkClass);
        }
        expect(screen.getByRole('button', { name: 'Tài liệu' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Cập nhật/ })).toBeInTheDocument();
    });

    it('uses the new chrome and interface labels only for the landing appearance', () => {
        const { container } = render(<MemoryRouter><LandingHeader {...props} appearance="landing" /></MemoryRouter>);

        expect(container.querySelector('header')).toHaveClass('lp-chrome');
        expect(screen.getByRole('link', { name: 'Giao diện' })).toHaveClass('lp-header-link');
        expect(screen.getByRole('link', { name: 'Bảng giá' })).toHaveAttribute('href', '#pricing');
        expect(screen.getByRole('link', { name: 'Tài liệu' })).toHaveAttribute('href', '/docs');
        expect(screen.queryByRole('button', { name: /Cập nhật/ })).not.toBeInTheDocument();
    });

    it('leaves a dialog-handled Escape alone and restores menu focus only for its own Escape', () => {
        const closeMenu = vi.fn();
        render(<MemoryRouter><LandingHeader {...props} appearance="landing" isMobileNavOpen setIsMobileNavOpen={closeMenu} /></MemoryRouter>);
        const menu = screen.getByRole('button', { name: 'Bật/tắt menu' });
        const dialogEscape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        dialogEscape.preventDefault();
        fireEvent(window, dialogEscape);
        expect(closeMenu).not.toHaveBeenCalled();

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(closeMenu).toHaveBeenCalledOnce();
        expect(closeMenu).toHaveBeenCalledWith(false);
        expect(menu).toHaveFocus();
    });

    it('keeps the original default footer instead of opting shared pages into landing styles', () => {
        const { container } = render(<LandingFooter lang="en" />);

        expect(container.querySelector('footer')).toHaveClass('bg-background/50', 'backdrop-blur-xl');
        expect(container.querySelector('.lp-container')).not.toBeInTheDocument();
        expect(screen.getByText('Status: Ready')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'DataExplorer' })).toBeInTheDocument();
    });
});
