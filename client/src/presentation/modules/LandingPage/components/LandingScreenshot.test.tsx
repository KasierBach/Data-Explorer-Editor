import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LandingScreenshot } from './LandingScreenshot';

const src = '/images/landing/workspace.webp';

describe('LandingScreenshot', () => {
    it('keeps the full screenshot dimensions without a fixed crop', () => {
        render(<LandingScreenshot src={src} alt="Full workspace" lang="en" priority />);

        const image = screen.getByAltText('Full workspace');
        expect(image).toHaveAttribute('width', '2880');
        expect(image).toHaveAttribute('height', '1800');
        expect(image).toHaveAttribute('loading', 'eager');
        expect(image).toHaveAttribute('fetchpriority', 'high');
        expect(image).not.toHaveAttribute('class');
    });

    it('opens the same uncropped asset at full size', () => {
        render(<LandingScreenshot src={src} alt="Full workspace" lang="en" />);

        const link = screen.getByRole('link', { name: /View full image/ });
        expect(link).toHaveAttribute('href', src);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        expect(screen.getByAltText('Full workspace')).toHaveAttribute('loading', 'lazy');
    });

    it('opens a full-image dialog, closes with Escape and restores the exact opener', async () => {
        const user = userEvent.setup();
        render(<LandingScreenshot src={src} alt="Full workspace" lang="en" />);
        const opener = screen.getByRole('link', { name: /View full image/ });

        await user.click(opener);
        const dialog = screen.getByRole('dialog', { name: 'Product interface' });
        expect(within(dialog).getByRole('img')).toHaveAttribute('src', src);
        expect(within(dialog).getByRole('img')).toHaveAttribute('width', '2880');
        expect(within(dialog).getByRole('img')).toHaveAttribute('height', '1800');
        expect(within(dialog).getByRole('link', { name: 'Open original image' })).toHaveAttribute('href', src);
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(opener).toHaveFocus();
    });

    it('provides a Vietnamese full-image action', () => {
        render(<LandingScreenshot src={src} alt="Toàn bộ workspace" lang="vi" />);

        expect(screen.getByRole('link', { name: /Xem ảnh đầy đủ/ })).toHaveAttribute('href', src);
    });
});
