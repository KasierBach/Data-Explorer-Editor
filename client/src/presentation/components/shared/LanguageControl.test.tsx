import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LanguageControl } from './LanguageControl';

// The compact workspace control remains the default; public pages opt into touch targets.
describe('LanguageControl', () => {
    it('keeps compact controls by default', () => {
        render(<LanguageControl lang="vi" onChange={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'VN' })).not.toHaveClass('min-h-11');
        expect(screen.getByRole('button', { name: 'VN' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('uses real locale links and larger hit targets on public pages', () => {
        render(<LanguageControl lang="en" onChange={vi.fn()} touch hrefs={{ vi: '/docs/editor', en: '/en/docs/editor' }} />);
        expect(screen.getByRole('link', { name: 'VN' })).toHaveAttribute('href', '/docs/editor');
        expect(screen.getByRole('link', { name: 'EN' })).toHaveClass('min-h-11', 'min-w-11');
        expect(screen.getByRole('link', { name: 'EN' })).toHaveAttribute('aria-current', 'page');
    });

    it('opts into pill styling without changing button locale values', () => {
        const onChange = vi.fn();
        const { container } = render(<LanguageControl lang="vi" onChange={onChange} appearance="pill" />);
        const vietnamese = screen.getByRole('button', { name: 'VN' });
        const english = screen.getByRole('button', { name: 'EN' });

        expect(container.firstElementChild).toHaveAttribute('data-appearance', 'pill');
        expect(vietnamese).toHaveClass('[box-shadow:none]', 'min-h-11', 'min-w-11');
        expect(vietnamese).toHaveClass('sm:[@media(hover:hover)_and_(pointer:fine)]:min-h-0');
        expect(vietnamese).toHaveAttribute('aria-pressed', 'true');
        expect(english).toHaveAttribute('aria-pressed', 'false');
        fireEvent.click(english);
        fireEvent.click(vietnamese);
        expect(onChange.mock.calls).toEqual([['en'], ['vi']]);
    });

    it('keeps real links and explicit touch sizing for the pill opt-in', () => {
        render(<LanguageControl lang="en" onChange={vi.fn()} touch appearance="pill" hrefs={{ vi: '/docs/editor#query', en: '/en/docs/editor#query' }} />);
        const vietnamese = screen.getByRole('link', { name: 'VN' });
        const english = screen.getByRole('link', { name: 'EN' });

        expect(vietnamese).toHaveAttribute('href', '/docs/editor#query');
        expect(vietnamese).toHaveAttribute('hreflang', 'vi');
        expect(vietnamese).not.toHaveAttribute('aria-current');
        expect(english).toHaveAttribute('href', '/en/docs/editor#query');
        expect(english).toHaveAttribute('hreflang', 'en');
        expect(english).toHaveAttribute('aria-current', 'page');
        expect(english).toHaveClass('min-h-11', 'min-w-11');
        expect(english).not.toHaveClass('sm:[@media(hover:hover)_and_(pointer:fine)]:min-h-0');
    });
});
