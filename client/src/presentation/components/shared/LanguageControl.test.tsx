import { render, screen } from '@testing-library/react';
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
});
