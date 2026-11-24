import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseValue } from '@/core/domain/entities';
import type { VirtualizerOptions } from '@tanstack/react-virtual';
import { ResultTable } from './ResultTable';
import { QueryResults } from './QueryResults';

const layout = vi.hoisted(() => ({ lang: 'en', isCompactMobileLayout: false }));
vi.mock('@/core/services/store', () => ({ useAppStore: () => ({ lang: layout.lang }) }));
vi.mock('@/presentation/hooks/useResponsiveLayoutMode', () => ({
    useResponsiveLayoutMode: () => ({ isCompactMobileLayout: layout.isCompactMobileLayout }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('./QueryPlanVisualizer', () => ({ QueryPlanVisualizer: () => null }));
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

// Keep the real virtualizer; supply the layout and scroll observations a DOM test lacks.
vi.mock('@tanstack/react-virtual', async importOriginal => {
    const actual = await importOriginal<typeof import('@tanstack/react-virtual')>();
    return {
        ...actual,
        useVirtualizer: (options: VirtualizerOptions<HTMLDivElement, HTMLTableRowElement>) => actual.useVirtualizer({
            ...options,
            initialRect: { width: 1024, height: 280 },
            observeElementRect: (_instance, callback) => {
                callback({ width: 1024, height: 280 });
                return () => undefined;
            },
            observeElementOffset: (instance, callback) => {
                const element = instance.scrollElement!;
                const onScroll = () => callback(element.scrollTop, false);
                onScroll();
                element.addEventListener('scroll', onScroll);
                return () => element.removeEventListener('scroll', onScroll);
            },
            scrollToFn: (offset, { adjustments = 0 }, instance) => {
                const element = instance.scrollElement!;
                element.scrollTop = offset + adjustments;
                element.dispatchEvent(new Event('scroll'));
            },
        }),
    };
});

const results = {
    columns: ['id'],
    rows: Array.from({ length: 100 }, (_, index) => ({ id: index + 1 })),
};

beforeEach(() => {
    layout.lang = 'en';
    layout.isCompactMobileLayout = false;
});

describe('ResultTable server pagination', () => {
    it('changes page size and resets the page in one controlled update', async () => {
        const onPaginationChange = vi.fn();
        const user = userEvent.setup();

        render(
            <ResultTable
                results={results}
                pageIndex={1}
                pageSize={100}
                totalCount={500_000}
                onPaginationChange={onPaginationChange}
            />,
        );

        await user.selectOptions(screen.getByRole('combobox'), '500');

        expect(onPaginationChange).toHaveBeenLastCalledWith(0, 500);
    });

    it('requests the next server page instead of paginating the loaded rows', async () => {
        const onPaginationChange = vi.fn();
        const user = userEvent.setup();

        render(
            <ResultTable
                results={results}
                pageIndex={0}
                pageSize={100}
                totalCount={500_000}
                onPaginationChange={onPaginationChange}
            />,
        );

        await user.click(screen.getByTitle('Next page'));

        expect(onPaginationChange).toHaveBeenCalledWith(1, 100);
        expect(screen.getByText('1–100 / 500,000')).toBeInTheDocument();
    });

    it.each([false, true])('windows large loaded pages without changing counts or server offsets (compact=%s)', compact => {
        layout.isCompactMobileLayout = compact;
        const largeResults = { columns: ['id'], rows: Array.from({ length: 1000 }, (_, index) => ({ id: index + 1 })) };
        const onPaginationChange = vi.fn();
        render(<ResultTable results={largeResults} pageIndex={4} pageSize={1000} totalCount={500_000} onPaginationChange={onPaginationChange} />);

        const region = screen.getByRole('region', { name: 'Query result' });
        const renderedRows = region.querySelectorAll('tbody tr:not([aria-hidden="true"])');
        expect(renderedRows.length).toBeGreaterThan(0);
        expect(renderedRows.length).toBeLessThan(50);
        expect(within(region).getByRole('columnheader', { name: 'id' })).toBeInTheDocument();
        expect(within(region).getByRole('cell', { name: '4001' })).toBeInTheDocument();
        expect(screen.getByText('1000 rows')).toBeInTheDocument();
        expect(screen.getByText('4,001–5,000 / 500,000')).toBeInTheDocument();
        expect(largeResults.rows).toHaveLength(1000);
        expect(onPaginationChange).not.toHaveBeenCalled();
    });

    it('updates the virtual window on scroll and returns to the top on a server page change', async () => {
        const largeResults = { columns: ['id'], rows: Array.from({ length: 1000 }, (_, index) => ({ id: index + 1 })) };
        const onPaginationChange = vi.fn();
        const { rerender } = render(<ResultTable results={largeResults} pageIndex={0} pageSize={1000} totalCount={5000} onPaginationChange={onPaginationChange} />);
        const region = screen.getByRole('region', { name: 'Query result' });
        region.scrollTop = 14_500;
        fireEvent.scroll(region);
        await waitFor(() => expect(screen.getByRole('button', { name: 'id, row 501: Inspect value' })).toBeInTheDocument());
        expect(screen.queryByRole('button', { name: 'id, row 1: Inspect value' })).not.toBeInTheDocument();
        expect(region.querySelectorAll('tbody tr:not([aria-hidden="true"])').length).toBeLessThan(50);

        rerender(<ResultTable results={largeResults} pageIndex={1} pageSize={1000} totalCount={5000} onPaginationChange={onPaginationChange} />);
        await waitFor(() => expect(region.scrollTop).toBe(0));
        expect(screen.getByRole('button', { name: 'id, row 1001: Inspect value' })).toBeInTheDocument();
        expect(onPaginationChange).not.toHaveBeenCalled();
    });

    it('keeps unknown totals and disables server controls while fetching', () => {
        render(<ResultTable results={results} pageIndex={2} pageSize={100} isFetching onPaginationChange={vi.fn()} />);
        expect(screen.getByText('201–300 / 300+')).toBeInTheDocument();
        expect(screen.getByTitle('Previous page')).toBeDisabled();
        expect(screen.getByTitle('Next page')).toBeDisabled();
        expect(screen.getByRole('combobox')).toBeDisabled();
    });
});

describe('ResultTable read-only cell inspector', () => {
    it('opens the raw full value from a touch-style click and restores focus on close', async () => {
        const user = userEvent.setup();
        const value = `  first line\n${'long content '.repeat(300)}\nlast line  `;
        render(<ResultTable results={{ columns: ['payload'], fields: [{ name: 'payload', type: 'text' }], rows: [{ payload: value }] }} pageIndex={2} pageSize={100} totalCount={301} onPaginationChange={vi.fn()} />);
        const opener = screen.getByRole('button', { name: 'payload, row 201: Inspect value' });
        await user.click(opener);

        const dialog = screen.getByRole('dialog', { name: 'payload' });
        expect(dialog.querySelector('pre')?.textContent).toBe(value);
        expect(within(dialog).getByText('text')).toBeInTheDocument();
        expect(within(dialog).getByText('row 201')).toBeInTheDocument();
        expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
        await user.click(within(dialog).getByRole('button', { name: 'Close' }));
        await waitFor(() => expect(opener).toHaveFocus());
    });

    it.each(['{Enter}', ' '])('opens from the keyboard with %s and copies nested driver values without mutation', async key => {
        const user = userEvent.setup();
        const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
        const date = new Date('2026-11-23T10:20:30.000Z');
        const binary = new Uint8Array([1, 2, 3]);
        const value = { nested: { large: 9007199254740993n, date, binary }, nothing: null, empty: '' };
        render(<ResultTable results={{ columns: ['payload'], rows: [{ payload: value as unknown as DatabaseValue }] }} pageIndex={0} pageSize={100} onPaginationChange={vi.fn()} />);
        const opener = screen.getByRole('button', { name: 'payload, row 1: Inspect value' });
        opener.focus();
        await user.keyboard(key);

        const dialog = screen.getByRole('dialog', { name: 'payload' });
        expect(within(dialog).getByText('unknown')).toBeInTheDocument();
        expect(dialog.querySelector('pre')?.textContent).toContain('"large": "9007199254740993"');
        expect(dialog.querySelector('pre')?.textContent).toContain(date.toISOString());
        expect(dialog.querySelector('pre')?.textContent).toContain('[binary 3 bytes]');
        await user.click(within(dialog).getByRole('button', { name: 'Copy value' }));
        expect(writeText).toHaveBeenCalledWith(dialog.querySelector('pre')!.textContent);
        expect(value.nested.large).toBe(9007199254740993n);
        expect(value.nested.date).toBe(date);
        expect(Array.from(binary)).toEqual([1, 2, 3]);
        await user.keyboard('{Escape}');
        await waitFor(() => expect(opener).toHaveFocus());
    });

    it('uses Vietnamese inspector controls and focuses the region when the virtual opener unmounts', async () => {
        layout.lang = 'vi';
        const user = userEvent.setup();
        const largeResults = { columns: ['payload'], rows: Array.from({ length: 1000 }, (_, index) => ({ payload: `value ${index}` })) };
        render(<ResultTable results={largeResults} pageIndex={0} pageSize={1000} onPaginationChange={vi.fn()} />);
        const region = screen.getByRole('region', { name: 'Kết quả truy vấn' });
        const opener = screen.getByRole('button', { name: 'payload, dòng 1: Xem giá trị' });
        await user.click(opener);
        const dialog = screen.getByRole('dialog', { name: 'payload' });
        expect(within(dialog).getByRole('button', { name: 'Sao chép giá trị' })).toBeInTheDocument();
        region.scrollTop = 14_500;
        fireEvent.scroll(region);
        await waitFor(() => expect(opener.isConnected).toBe(false));
        await user.click(within(dialog).getByRole('button', { name: 'Đóng' }));
        await waitFor(() => expect(region).toHaveFocus());
    });

    it('uses literal field names and their returned metadata for inspection', async () => {
        const user = userEvent.setup();
        render(<ResultTable results={{ columns: ['payload.value'], fields: [{ name: 'payload.value', type: 'jsonb' }], rows: [{ 'payload.value': { literal: true } }] }} pageIndex={0} pageSize={100} onPaginationChange={vi.fn()} />);
        await user.click(screen.getByRole('button', { name: 'payload.value, row 1: Inspect value' }));
        const dialog = screen.getByRole('dialog', { name: 'payload.value' });
        expect(within(dialog).getByText('jsonb')).toBeInTheDocument();
        expect(dialog.querySelector('pre')?.textContent).toBe('{\n  "literal": true\n}');
    });
});

describe('ResultTable export preservation', () => {
    it('exports every loaded row through the unchanged QueryResults handler, not only virtual DOM rows', async () => {
        const user = userEvent.setup();
        let exportedBlob!: Blob;
        const createObjectURL = vi.fn((blob: unknown) => {
            exportedBlob = blob as Blob;
            return 'blob:query-export-fixture';
        });
        const revokeObjectURL = vi.fn();
        vi.stubGlobal('URL', class extends URL {
            static createObjectURL = createObjectURL;
            static revokeObjectURL = revokeObjectURL;
        });
        const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
        const rows = Array.from({ length: 1000 }, (_, index) => ({ id: index + 1, payload: index === 0 ? 'ordinary,"text"' : `row-${index + 1}` }));
        render(<QueryResults results={{ columns: ['id', 'payload'], rows }} isLoading={false} error={null} executedQuery="SELECT * FROM fixture" dataUpdatedAt={0} activeTab="data" onTabChange={vi.fn()} pageIndex={0} pageSize={1000} totalCount={500_000} onPaginationChange={vi.fn()} />);
        expect(screen.getByRole('region', { name: 'Query result' }).querySelectorAll('tbody tr:not([aria-hidden="true"])').length).toBeLessThan(50);

        await user.click(screen.getByTitle('Export current page'));
        expect(createObjectURL).toHaveBeenCalledTimes(1);
        expect(anchorClick).toHaveBeenCalledTimes(1);
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:query-export-fixture');
        const csv = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsText(exportedBlob);
        });
        const lines = csv.split('\r\n');
        expect(lines).toHaveLength(1001);
        expect(lines[0]).toBe('id,payload');
        expect(lines[1]).toBe('1,"ordinary,""text"""');
        expect(lines.at(-1)).toBe('1000,row-1000');
        expect(rows).toHaveLength(1000);
        expect(rows[0].payload).toBe('ordinary,"text"');
    });
});

describe('ResultTable review regressions', () => {
    it.each(['', '   \n  '])('keeps the entire empty/whitespace cell %j usable for click and touch-style opening', async value => {
        const user = userEvent.setup();
        render(<ResultTable results={{ columns: ['payload'], rows: [{ payload: value }] }} pageIndex={0} pageSize={100} onPaginationChange={vi.fn()} />);
        const opener = screen.getByRole('button', { name: 'payload, row 1: Inspect value' });
        expect(opener.closest('td')).toHaveClass('p-0');
        expect(opener).toHaveClass('w-full', 'min-h-7', 'px-3', 'py-1.5');
        await user.click(opener);
        expect(screen.getByRole('dialog', { name: 'payload' }).querySelector('pre')?.textContent).toBe(value);
        await user.keyboard('{Escape}');
        await waitFor(() => expect(opener).toHaveFocus());
        fireEvent.pointerDown(opener, { pointerType: 'touch' });
        fireEvent.pointerUp(opener, { pointerType: 'touch' });
        fireEvent.click(opener);
        expect(screen.getByRole('dialog', { name: 'payload' }).querySelector('pre')?.textContent).toBe(value);
    });

    it.each([false, true])('keeps fixed column widths and horizontal position across contrasting virtual windows (compact=%s)', async compact => {
        layout.isCompactMobileLayout = compact;
        const largeResults = {
            columns: ['id', 'payload'],
            fields: [{ name: 'id', type: 'integer' }, { name: 'payload', type: 'text' }],
            rows: Array.from({ length: 1000 }, (_, index) => ({ id: index + 1, payload: index < 500 ? 'short' : 'wide content '.repeat(500) })),
        };
        render(<ResultTable results={largeResults} pageIndex={0} pageSize={1000} onPaginationChange={vi.fn()} />);
        const region = screen.getByRole('region', { name: 'Query result' });
        const table = within(region).getByRole('table');
        expect(table).toHaveClass('table-fixed');
        const widths = Array.from(table.querySelectorAll('col'), column => column.style.width);
        expect(widths).toHaveLength(3);
        expect(widths.at(-1)).toBe('auto');
        for (const width of widths.slice(1, -1)) {
            expect(Number.parseFloat(width)).toBeGreaterThanOrEqual(96);
            expect(Number.parseFloat(width)).toBeLessThanOrEqual(compact ? 200 : 400);
        }
        const tableWidth = table.style.width;
        const fixedWidth = widths.slice(0, -1).reduce((total, width) => total + Number.parseFloat(width), 0);
        const lastColumnBudget = Number.parseFloat(tableWidth) - fixedWidth;
        expect(lastColumnBudget).toBeGreaterThanOrEqual(96);
        expect(lastColumnBudget).toBeLessThanOrEqual(compact ? 200 : 400);
        region.scrollLeft = 123;
        region.scrollTop = 14_500;
        fireEvent.scroll(region);
        await waitFor(() => expect(screen.getByRole('button', { name: 'payload, row 501: Inspect value' })).toBeInTheDocument());
        expect(Array.from(table.querySelectorAll('col'), column => column.style.width)).toEqual(widths);
        expect(table.style.width).toBe(tableWidth);
        expect(region.scrollLeft).toBe(123);
        expect(largeResults.rows).toHaveLength(1000);
    });

    it.each(['response', 'page', 'page size', 'fetching'])('invalidates an open cell on %s replacement without focusing a reused index node', async change => {
        const user = userEvent.setup();
        const previous = { columns: ['payload'], rows: [{ payload: 'old response' }] };
        const replacement = { columns: ['payload'], rows: [{ payload: 'new response' }] };
        const onPaginationChange = vi.fn();
        const { rerender } = render(<ResultTable results={previous} pageIndex={0} pageSize={100} totalCount={5000} onPaginationChange={onPaginationChange} />);
        const region = screen.getByRole('region', { name: 'Query result' });
        const opener = screen.getByRole('button', { name: 'payload, row 1: Inspect value' });
        await user.click(opener);
        expect(screen.getByRole('dialog', { name: 'payload' }).querySelector('pre')?.textContent).toBe('old response');

        rerender(<ResultTable results={change === 'response' ? replacement : previous} pageIndex={change === 'page' ? 1 : 0} pageSize={change === 'page size' ? 500 : 100} isFetching={change === 'fetching'} totalCount={5000} onPaginationChange={onPaginationChange} />);
        expect(screen.queryByRole('dialog', { name: 'payload' })).not.toBeInTheDocument();
        expect(opener.isConnected).toBe(true);
        await waitFor(() => expect(region).toHaveFocus());
        expect(onPaginationChange).not.toHaveBeenCalled();
    });

    it('does not open retained rows under a new page label while fetching and opens the replacement value afterwards', async () => {
        const user = userEvent.setup();
        const previous = { columns: ['payload'], rows: [{ payload: 'old response' }] };
        const replacement = { columns: ['payload'], fields: [{ name: 'payload', type: 'text' }], rows: [{ payload: 'new response' }] };
        const onPaginationChange = vi.fn();
        const { rerender } = render(<ResultTable results={previous} pageIndex={0} pageSize={100} totalCount={5000} onPaginationChange={onPaginationChange} />);
        rerender(<ResultTable results={previous} pageIndex={1} pageSize={100} isFetching totalCount={5000} onPaginationChange={onPaginationChange} />);
        const retained = screen.getByRole('button', { name: 'payload, row 101: Inspect value' });
        expect(retained).toBeDisabled();
        await user.click(retained);
        expect(screen.queryByRole('dialog', { name: 'payload' })).not.toBeInTheDocument();

        rerender(<ResultTable results={replacement} pageIndex={1} pageSize={100} totalCount={5000} onPaginationChange={onPaginationChange} />);
        await user.click(screen.getByRole('button', { name: 'payload, row 101: Inspect value' }));
        const dialog = screen.getByRole('dialog', { name: 'payload' });
        expect(dialog.querySelector('pre')?.textContent).toBe('new response');
        expect(within(dialog).getByText('row 101')).toBeInTheDocument();
        expect(within(dialog).getByText('text')).toBeInTheDocument();
        expect(onPaginationChange).not.toHaveBeenCalled();
    });

    it('returns close focus to the region if the response changes during the close event', async () => {
        const user = userEvent.setup();
        const previous = { columns: ['payload'], rows: [{ payload: 'old response' }] };
        const replacement = { columns: ['payload'], rows: [{ payload: 'new response' }] };
        const onPaginationChange = vi.fn();
        const { rerender } = render(<ResultTable results={previous} pageIndex={0} pageSize={100} onPaginationChange={onPaginationChange} />);
        const region = screen.getByRole('region', { name: 'Query result' });
        const opener = screen.getByRole('button', { name: 'payload, row 1: Inspect value' });
        await user.click(opener);
        act(() => {
            fireEvent.click(screen.getByRole('button', { name: 'Close' }));
            rerender(<ResultTable results={replacement} pageIndex={0} pageSize={100} onPaginationChange={onPaginationChange} />);
        });
        expect(opener.isConnected).toBe(true);
        await waitFor(() => expect(region).toHaveFocus());
        expect(opener).not.toHaveFocus();
    });

    it('contains adjacent long SQL headers without shortening their accessible names or tooltips', () => {
        const names = [
            `reporting.statement.${'very_long_sql_identifier_'.repeat(24)}`,
            `reporting.adjacent.${'another_long_sql_identifier_'.repeat(24)}`,
        ];
        render(<ResultTable results={{ columns: names, rows: [{ [names[0]]: 'first', [names[1]]: 'second' }] }} pageIndex={0} pageSize={100} onPaginationChange={vi.fn()} />);
        for (const name of names) {
            const header = screen.getByRole('columnheader', { name });
            expect(header).toHaveAccessibleName(name);
            expect(header).toHaveClass('p-1.5', 'px-3');
            const label = within(header).getByTitle(name);
            expect(label).toHaveClass('block', 'truncate');
            expect(label.textContent).toBe(name);
        }
        expect(screen.getByRole('table')).toHaveClass('table-fixed');
    });
});
