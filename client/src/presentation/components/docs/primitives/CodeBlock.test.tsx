import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CodeBlock, CodeLine } from './CodeBlock';

describe('CodeBlock keyboard scrolling', () => {
    it('keeps its code and appearance while making the scroll container focusable', () => {
        const { container } = render(<CodeBlock title="Local setup"><CodeLine>npm run dev</CodeLine></CodeBlock>);
        const block = container.firstElementChild as HTMLElement;
        expect(block).toHaveAttribute('tabindex', '0');
        expect(block).toHaveClass('overflow-x-auto', 'bg-slate-950', 'font-mono', 'focus-visible:ring-2');
        expect(screen.getByText('Local setup')).toHaveClass('text-slate-400');
        expect(screen.getByText('npm run dev')).toBeInTheDocument();
        block.focus();
        expect(block).toHaveFocus();
    });
});
