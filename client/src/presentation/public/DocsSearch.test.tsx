import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOCS_CATALOG } from '@/core/docs/docsCatalog';
import { DocsSearch } from './DocsSearch';
import { PublicDocsNavigationContext } from './PublicNavigationContext';

const groups = [
    { id: 'sql-workspace', title: 'SQL Workspace' },
    { id: 'connections', title: 'Connections' },
];
const entries = [
    { id: 'editor', title: 'Monaco Editor', sectionTitle: 'SQL Workspace', groupId: 'sql-workspace' },
    { id: 'results', title: 'Result Grid', sectionTitle: 'SQL Workspace', groupId: 'sql-workspace' },
    { id: 'mongodb', title: 'MongoDB', sectionTitle: 'Connections', groupId: 'connections' },
];

const copy = {
    vi: { filter: 'Bộ lọc', all: 'Tất cả chủ đề', connections: 'Kết nối', clear: 'Xóa tìm kiếm', reset: 'Đặt lại bộ lọc', clearFilter: 'Bỏ lọc', modes: 'Cách lọc', include: 'Chỉ hiển thị', exclude: 'Loại trừ', groups: 'Nhóm tài liệu', topics: 'chủ đề', empty: 'Không tìm thấy' },
    en: { filter: 'Filter', all: 'All topics', connections: 'Connections', clear: 'Clear search', reset: 'Reset filter', clearFilter: 'Clear filter', modes: 'Filter mode', include: 'Include only', exclude: 'Exclude', groups: 'Documentation groups', topics: 'topics', empty: 'No matching topics' },
};

describe('DocsSearch', () => {
    it('provides real localized result links and keyboard selection', () => {
        render(<DocsSearch groups={groups} entries={entries} lang="en" hrefFor={id => `/en/docs/${id}`} />);
        const input = screen.getByRole('combobox');
        expect(input).toHaveAttribute('aria-expanded', 'false');
        act(() => input.focus());
        expect(screen.getAllByRole('combobox')).toHaveLength(1);
        expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(3);
        expect(screen.getByRole('status')).toHaveTextContent('3/3 topics');
        fireEvent.change(input, { target: { value: 'SQL' } });
        expect(input).toHaveAttribute('aria-expanded', 'true');
        const results = screen.getByRole('listbox');
        const options = within(results).getAllByRole('option');
        expect(options).toHaveLength(2);
        expect(options[0]).toHaveAttribute('href', '/en/docs/editor');
        expect(options[0]).toHaveAttribute('aria-selected', 'true');
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        expect(options[1]).toHaveAttribute('aria-selected', 'true');
        expect(input).toHaveAttribute('aria-activedescendant', options[1].id);
        expect(fireEvent.keyDown(input, { key: 'Escape' })).toBe(false);
        expect(input).toHaveAttribute('aria-expanded', 'false');
        expect(input).toHaveFocus();
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        fireEvent.click(input);
        expect(input).toHaveAttribute('aria-expanded', 'true');
        expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(2);
        expect(input).toHaveFocus();
    });

    it('scrolls the active result into view with instant nearest scrolling and retains the eight-result keyboard wrap', () => {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
        const scrollIntoView = vi.fn();
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, writable: true, value: scrollIntoView });
        try {
            const manyEntries = Array.from({ length: 10 }, (_, index) => ({ id: `sql-${index}`, title: `SQL topic ${index}`, sectionTitle: 'SQL Workspace', groupId: 'sql-workspace' }));
            render(<DocsSearch groups={groups} entries={manyEntries} lang="en" hrefFor={id => `/en/docs/${id}`} />);
            const input = screen.getByRole('combobox');
            act(() => input.focus());
            expect(screen.getByRole('status')).toHaveTextContent('8/10 topics');
            fireEvent.change(input, { target: { value: 'sql' } });
            const options = within(screen.getByRole('listbox')).getAllByRole('option');
            expect(options).toHaveLength(8);
            expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'nearest', behavior: 'instant' });
            expect(scrollIntoView.mock.contexts.at(-1)).toBe(options[0]);
            for (let index = 1; index < options.length; index++) fireEvent.keyDown(input, { key: 'ArrowDown' });
            expect(options[7]).toHaveAttribute('aria-selected', 'true');
            expect(input).toHaveAttribute('aria-activedescendant', options[7].id);
            expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'nearest', behavior: 'instant' });
            expect(scrollIntoView.mock.contexts.at(-1)).toBe(options[7]);
            fireEvent.keyDown(input, { key: 'ArrowDown' });
            expect(options[0]).toHaveAttribute('aria-selected', 'true');
            fireEvent.keyDown(input, { key: 'ArrowUp' });
            expect(options[7]).toHaveAttribute('aria-selected', 'true');
            expect(scrollIntoView.mock.contexts.at(-1)).toBe(options[7]);
            expect(input).toHaveFocus();
        } finally {
            if (descriptor) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', descriptor);
            else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
        }
    });

    it('shows a localized empty state and clears to suggestions without navigating', () => {
        const hrefFor = vi.fn((id: string) => `/docs/${id}`);
        const url = window.location.href;
        render(<DocsSearch groups={groups} entries={entries} lang="vi" hrefFor={hrefFor} />);
        const input = screen.getByRole('combobox');
        fireEvent.change(input, { target: { value: 'no-such-topic' } });
        expect(screen.getByRole('status')).toHaveTextContent('Không tìm thấy');
        expect(screen.getByRole('status')).toHaveTextContent('0/0 chủ đề');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Xóa tìm kiếm' }));
        expect(input).toHaveValue('');
        expect(input).toHaveFocus();
        expect(input).toHaveAttribute('aria-expanded', 'true');
        const suggestions = within(screen.getByRole('listbox')).getAllByRole('option');
        expect(suggestions.map(option => option.getAttribute('href'))).toEqual(['/docs/editor', '/docs/results', '/docs/mongodb']);
        expect(screen.getByRole('status')).toHaveTextContent('3/3 chủ đề');
        expect(window.location.href).toBe(url);
    });

    it('clamps the active descendant when supplied results shrink or become empty', () => {
        const manyEntries = Array.from({ length: 10 }, (_, index) => ({ id: `sql-${index}`, title: `SQL topic ${index}`, sectionTitle: 'SQL Workspace', groupId: 'sql-workspace' }));
        const hrefFor = (id: string) => `/en/docs/${id}`;
        const { rerender } = render(<DocsSearch groups={groups} entries={manyEntries} lang="en" hrefFor={hrefFor} />);
        const input = screen.getByRole('combobox');
        act(() => input.focus());
        for (let index = 0; index < 7; index++) fireEvent.keyDown(input, { key: 'ArrowDown' });
        rerender(<DocsSearch groups={groups} entries={manyEntries.slice(0, 2)} lang="en" hrefFor={hrefFor} />);
        const options = within(screen.getByRole('listbox')).getAllByRole('option');
        expect(options).toHaveLength(2);
        expect(options[0]).toHaveAttribute('aria-selected', 'true');
        expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
        expect(options.filter(option => option.getAttribute('aria-selected') === 'true')).toHaveLength(1);
        rerender(<DocsSearch groups={groups} entries={[]} lang="en" hrefFor={hrefFor} />);
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(input).not.toHaveAttribute('aria-activedescendant');
        expect(input).not.toHaveAttribute('aria-controls');
        expect(screen.getByRole('status')).toHaveTextContent('No matching topics');
        expect(screen.getByRole('status')).toHaveTextContent('0/0 topics');
        expect(input).toHaveFocus();
    });

    it.each(['group', 'mode'])('returns to the search when the already active %s choice is selected again', async choice => {
        const user = userEvent.setup();
        render(<DocsSearch groups={groups} entries={entries} lang="en" hrefFor={id => `/en/docs/${id}`} />);
        const input = screen.getByRole('combobox');
        const filter = screen.getByRole('button', { name: 'Filter' });
        await user.click(filter);
        await user.click(within(await screen.findByRole('menu')).getByRole('menuitemradio', { name: /^Connections/ }));
        await waitFor(() => expect(input).toHaveFocus());
        await user.click(filter);
        await user.click(within(await screen.findByRole('menu')).getByRole('menuitemradio', { name: choice === 'mode' ? 'Include only' : /^Connections/ }));
        await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
        await waitFor(() => expect(input).toHaveFocus());
        expect(filter).toHaveAccessibleName('Filter: Include only · Connections');
        expect(screen.getByRole('option')).toHaveAttribute('href', '/en/docs/mongodb');
    });

    for (const lang of ['vi', 'en'] as const) {
        const text = copy[lang];
        const catalogGroups = DOCS_CATALOG.map(group => ({ id: group.id, title: lang === 'vi' ? group.title : group.titleEn }));
        const catalogEntries = DOCS_CATALOG.flatMap(group => group.items.map(entry => ({
            id: entry.id, title: lang === 'vi' ? entry.title : entry.titleEn,
            sectionTitle: lang === 'vi' ? group.title : group.titleEn, groupId: group.id,
        })));
        const hrefFor = (id: string) => `${lang === 'en' ? '/en' : ''}/docs/${id}`;

        it(`offers eight blank-query suggestions and filters the full catalog before the cap in ${lang}`, async () => {
            const user = userEvent.setup();
            render(<DocsSearch groups={catalogGroups} entries={catalogEntries} lang={lang} hrefFor={hrefFor} />);
            const input = screen.getByRole('combobox');
            const filter = screen.getByRole('button', { name: text.filter });
            expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
            await user.click(input);
            const initial = within(screen.getByRole('listbox')).getAllByRole('option');
            expect(initial).toHaveLength(8);
            expect(initial.map(option => option.getAttribute('href'))).toEqual(catalogEntries.slice(0, 8).map(entry => hrefFor(entry.id)));
            expect(screen.getByRole('status')).toHaveTextContent(`8/43 ${text.topics}`);
            await user.keyboard('{ArrowDown}{ArrowDown}');
            await user.click(filter);
            const menu = await screen.findByRole('menu');
            expect(menu).toHaveClass('public-experience', 'pe-doc-filter-menu');
            expect(menu.closest('.pe-doc-search-tools')).toBeNull();
            expect(input).toHaveAttribute('aria-expanded', 'false');
            expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
            const choices = within(within(menu).getByRole('group', { name: text.groups })).getAllByRole('menuitemradio');
            const modeChoices = within(within(menu).getByRole('group', { name: text.modes })).getAllByRole('menuitemradio');
            expect(modeChoices).toHaveLength(2);
            expect(modeChoices[0]).toHaveTextContent(text.include);
            expect(modeChoices[0]).toHaveAttribute('aria-checked', 'true');
            expect(modeChoices[1]).toHaveTextContent(text.exclude);
            expect(modeChoices[1]).toHaveAttribute('aria-checked', 'false');
            expect(within(menu).getByRole('menuitem', { name: text.clearFilter })).toHaveAttribute('aria-disabled', 'true');
            expect(choices).toHaveLength(9);
            expect(choices[0]).toHaveTextContent(text.all);
            expect(choices[0]).toHaveAttribute('aria-checked', 'true');
            expect(within(choices[0]).getByText('43', { exact: true })).toBeInTheDocument();
            DOCS_CATALOG.forEach((group, index) => {
                expect(choices[index + 1]).toHaveTextContent(catalogGroups[index].title);
                expect(within(choices[index + 1]).getByText(String(group.items.length), { exact: true })).toBeInTheDocument();
                expect(choices[index + 1]).toHaveAttribute('aria-checked', 'false');
            });
            await user.click(within(menu).getByRole('menuitemradio', { name: new RegExp(`^${text.connections}`) }));
            await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
            await waitFor(() => expect(input).toHaveFocus());
            expect(input).toHaveValue('');
            expect(filter).toHaveAttribute('aria-label', `${text.filter}: ${text.include} · ${text.connections}`);
            expect(filter).toHaveAttribute('data-active', 'true');
            const scoped = within(screen.getByRole('listbox')).getAllByRole('option');
            expect(scoped).toHaveLength(8);
            expect(scoped.map(option => option.getAttribute('href'))).toEqual(catalogEntries.filter(entry => entry.groupId === 'connections').slice(0, 8).map(entry => hrefFor(entry.id)));
            expect(scoped[0]).toHaveAttribute('aria-selected', 'true');
            expect(input).toHaveAttribute('aria-activedescendant', scoped[0].id);
            expect(screen.getByRole('status')).toHaveTextContent(`8/9 ${text.topics}`);
            fireEvent.change(input, { target: { value: 'postgres' } });
            expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(1);
            expect(screen.getByRole('option')).toHaveAttribute('href', hrefFor('postgres'));
            expect(screen.getByRole('status')).toHaveTextContent(`1/1 ${text.topics}`);
            fireEvent.change(input, { target: { value: 'Monaco' } });
            expect(screen.queryByRole('option')).not.toBeInTheDocument();
            expect(screen.getByRole('status')).toHaveTextContent(text.empty);
            expect(screen.getByRole('status')).toHaveTextContent(`0/0 ${text.topics}`);
            await user.click(screen.getByRole('button', { name: text.clear }));
            expect(input).toHaveValue('');
            expect(input).toHaveFocus();
            expect(filter).toHaveAttribute('data-active', 'true');
            expect(screen.getByRole('status')).toHaveTextContent(`8/9 ${text.topics}`);
            await user.click(screen.getByRole('button', { name: text.reset }));
            expect(input).toHaveValue('');
            expect(input).toHaveFocus();
            expect(filter).toHaveAccessibleName(text.filter);
            expect(filter).not.toHaveAttribute('data-active', 'true');
            expect(screen.getByRole('status')).toHaveTextContent(`8/43 ${text.topics}`);
            expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(8);
            expect(screen.queryByRole('button', { name: text.reset })).not.toBeInTheDocument();
        });

        it(`preserves the query across group selection and reset, and cancels the menu to its trigger in ${lang}`, async () => {
            const user = userEvent.setup();
            render(<DocsSearch groups={catalogGroups} entries={catalogEntries} lang={lang} hrefFor={hrefFor} />);
            const input = screen.getByRole('combobox');
            const filter = screen.getByRole('button', { name: text.filter });
            await user.click(input);
            fireEvent.change(input, { target: { value: 'postgres' } });
            await user.click(filter);
            expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
            await user.keyboard('{Escape}');
            await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
            await waitFor(() => expect(filter).toHaveFocus());
            expect(input).not.toHaveFocus();
            expect(input).toHaveAttribute('aria-expanded', 'false');
            expect(input).toHaveValue('postgres');
            await user.keyboard('{ArrowDown}{Home}');
            await waitFor(() => expect(screen.getByRole('menuitemradio', { name: text.include })).toHaveFocus());
            await user.keyboard('{ArrowDown}');
            expect(screen.getByRole('menuitemradio', { name: text.exclude })).toHaveFocus();
            await user.keyboard('{ArrowDown}');
            expect(screen.getByRole('menuitemradio', { name: new RegExp(`^${text.all}`) })).toHaveFocus();
            await user.keyboard('{ArrowDown}{ArrowDown}');
            expect(screen.getByRole('menuitemradio', { name: new RegExp(`^${text.connections}`) })).toHaveFocus();
            await user.keyboard('{Enter}');
            await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
            await waitFor(() => expect(input).toHaveFocus());
            expect(input).toHaveValue('postgres');
            expect(filter).toHaveAttribute('aria-label', `${text.filter}: ${text.include} · ${text.connections}`);
            expect(screen.getByRole('option')).toHaveAttribute('href', hrefFor('postgres'));
            await user.click(screen.getByRole('button', { name: text.reset }));
            expect(input).toHaveValue('postgres');
            expect(input).toHaveFocus();
            expect(filter).toHaveAccessibleName(text.filter);
            expect(screen.getByRole('option')).toHaveAttribute('href', hrefFor('postgres'));
            expect(screen.getByRole('status')).toHaveTextContent(`1/1 ${text.topics}`);
            expect(fireEvent.keyDown(input, { key: 'Escape' })).toBe(false);
            expect(input).toHaveFocus();
            expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        });

        it(`excludes a group before text matching and preserves mode across group and query changes in ${lang}`, async () => {
            const user = userEvent.setup();
            render(<DocsSearch groups={catalogGroups} entries={catalogEntries} lang={lang} hrefFor={hrefFor} />);
            const input = screen.getByRole('combobox');
            const filter = screen.getByRole('button', { name: text.filter });
            await user.click(filter);
            await user.click(within(await screen.findByRole('menu')).getByRole('menuitemradio', { name: new RegExp(`^${text.connections}`) }));
            await waitFor(() => expect(input).toHaveFocus());
            await user.keyboard('{ArrowDown}{ArrowDown}');
            await user.click(filter);
            await user.click(within(await screen.findByRole('menu')).getByRole('menuitemradio', { name: text.exclude }));
            await waitFor(() => expect(input).toHaveFocus());
            const scopeLabel = `${text.exclude} · ${text.connections}`;
            expect(filter).toHaveAccessibleName(`${text.filter}: ${scopeLabel}`);
            expect(filter).toHaveAttribute('title', scopeLabel);
            expect(screen.getByText(scopeLabel)).toHaveClass('pe-search-caption');
            expect(screen.getByRole('status')).toHaveTextContent(`8/34 ${text.topics}`);
            const complement = within(screen.getByRole('listbox')).getAllByRole('option');
            expect(complement.map(option => option.getAttribute('href'))).toEqual(catalogEntries.filter(entry => entry.groupId !== 'connections').slice(0, 8).map(entry => hrefFor(entry.id)));
            expect(complement[0]).toHaveAttribute('aria-selected', 'true');
            expect(input).toHaveAttribute('aria-activedescendant', complement[0].id);
            fireEvent.change(input, { target: { value: 'postgres' } });
            expect(screen.queryByRole('option')).not.toBeInTheDocument();
            expect(screen.getByRole('status')).toHaveTextContent(`0/0 ${text.topics}`);
            fireEvent.change(input, { target: { value: 'Monaco' } });
            expect(screen.getByRole('option')).toHaveAttribute('href', hrefFor('editor'));
            expect(screen.getByRole('status')).toHaveTextContent(`1/1 ${text.topics}`);
            await user.click(filter);
            await user.click(within(await screen.findByRole('menu')).getByRole('menuitemradio', { name: text.include }));
            await waitFor(() => expect(input).toHaveFocus());
            expect(input).toHaveValue('Monaco');
            expect(filter).toHaveAccessibleName(`${text.filter}: ${text.include} · ${text.connections}`);
            expect(screen.queryByRole('option')).not.toBeInTheDocument();
            await user.click(filter);
            await user.click(within(await screen.findByRole('menu')).getByRole('menuitemradio', { name: text.exclude }));
            await waitFor(() => expect(input).toHaveFocus());
            expect(screen.getByRole('option')).toHaveAttribute('href', hrefFor('editor'));
            const sqlGroup = catalogGroups.find(group => group.id === 'sql-workspace')!;
            await user.click(filter);
            await user.click(within(await screen.findByRole('menu')).getByRole('menuitemradio', { name: new RegExp(`^${sqlGroup.title}`) }));
            await waitFor(() => expect(input).toHaveFocus());
            expect(input).toHaveValue('Monaco');
            expect(filter).toHaveAccessibleName(`${text.filter}: ${text.exclude} · ${sqlGroup.title}`);
            expect(screen.queryByRole('option')).not.toBeInTheDocument();
            await user.click(screen.getByRole('button', { name: text.clear }));
            expect(input).toHaveValue('');
            expect(input).toHaveFocus();
            expect(filter).toHaveAccessibleName(`${text.filter}: ${text.exclude} · ${sqlGroup.title}`);
            const excludedCount = catalogEntries.filter(entry => entry.groupId !== sqlGroup.id).length;
            expect(screen.getByRole('status')).toHaveTextContent(`8/${excludedCount} ${text.topics}`);
            expect(within(screen.getByRole('listbox')).getAllByRole('option').map(option => option.getAttribute('href'))).toEqual(catalogEntries.filter(entry => entry.groupId !== sqlGroup.id).slice(0, 8).map(entry => hrefFor(entry.id)));
        });

        it(`clears an excluded filter directly from its menu while preserving a hidden query in ${lang}`, async () => {
            const user = userEvent.setup();
            render(<DocsSearch groups={catalogGroups} entries={catalogEntries} lang={lang} hrefFor={hrefFor} />);
            const input = screen.getByRole('combobox');
            const filter = screen.getByRole('button', { name: text.filter });
            fireEvent.change(input, { target: { value: 'postgres' } });
            await user.click(filter);
            await user.click(within(await screen.findByRole('menu')).getByRole('menuitemradio', { name: new RegExp(`^${text.connections}`) }));
            await waitFor(() => expect(input).toHaveFocus());
            await user.click(filter);
            await user.click(within(await screen.findByRole('menu')).getByRole('menuitemradio', { name: text.exclude }));
            await waitFor(() => expect(input).toHaveFocus());
            expect(screen.queryByRole('option')).not.toBeInTheDocument();
            await user.keyboard('{Escape}');
            expect(input).toHaveAttribute('aria-expanded', 'false');
            await user.click(filter);
            const menu = await screen.findByRole('menu');
            expect(input).toHaveValue('postgres');
            expect(screen.queryByRole('button', { name: text.reset })).not.toBeInTheDocument();
            expect(within(menu).getByRole('menuitem', { name: text.clearFilter })).not.toHaveAttribute('aria-disabled', 'true');
            await user.click(within(menu).getByRole('menuitem', { name: text.clearFilter }));
            await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
            await waitFor(() => expect(input).toHaveFocus());
            expect(input).toHaveValue('postgres');
            expect(filter).toHaveAccessibleName(text.filter);
            expect(filter).toHaveAttribute('data-active', 'false');
            expect(screen.getByRole('option')).toHaveAttribute('href', hrefFor('postgres'));
            expect(screen.getByRole('status')).toHaveTextContent(`1/1 ${text.topics}`);
            await user.click(filter);
            expect(screen.getByRole('menuitemradio', { name: text.include })).toHaveAttribute('aria-checked', 'true');
            expect(screen.getByRole('menuitemradio', { name: text.exclude })).toHaveAttribute('aria-checked', 'false');
            expect(screen.getByRole('menuitemradio', { name: new RegExp(`^${text.all}`) })).toHaveAttribute('aria-checked', 'true');
            expect(screen.getByRole('menuitem', { name: text.clearFilter })).toHaveAttribute('aria-disabled', 'true');
            await user.keyboard('{Escape}');
            await waitFor(() => expect(filter).toHaveFocus());
            expect(input).toHaveAttribute('aria-expanded', 'false');
        });

        it(`never excludes all topics and resets a preselected exclusion mode through All topics in ${lang}`, async () => {
            const user = userEvent.setup();
            render(<DocsSearch groups={catalogGroups} entries={catalogEntries} lang={lang} hrefFor={hrefFor} />);
            const input = screen.getByRole('combobox');
            const filter = screen.getByRole('button', { name: text.filter });
            await user.click(filter);
            await user.click(within(await screen.findByRole('menu')).getByRole('menuitemradio', { name: text.exclude }));
            await waitFor(() => expect(input).toHaveFocus());
            expect(filter).toHaveAccessibleName(text.filter);
            expect(filter).toHaveAttribute('data-active', 'false');
            expect(screen.getByRole('status')).toHaveTextContent(`8/43 ${text.topics}`);
            await user.click(filter);
            expect(screen.getByRole('menuitem', { name: text.clearFilter })).toHaveAttribute('aria-disabled', 'true');
            expect(screen.getByRole('menuitemradio', { name: text.exclude })).toHaveAttribute('aria-checked', 'true');
            await user.click(screen.getByRole('menuitemradio', { name: new RegExp(`^${text.all}`) }));
            await waitFor(() => expect(input).toHaveFocus());
            expect(screen.getByRole('status')).toHaveTextContent(`8/43 ${text.topics}`);
            await user.click(filter);
            expect(screen.getByRole('menuitemradio', { name: text.include })).toHaveAttribute('aria-checked', 'true');
            await user.click(screen.getByRole('menuitemradio', { name: new RegExp(`^${text.connections}`) }));
            await waitFor(() => expect(input).toHaveFocus());
            expect(filter).toHaveAccessibleName(`${text.filter}: ${text.include} · ${text.connections}`);
            expect(screen.getByRole('status')).toHaveTextContent(`8/9 ${text.topics}`);
            await user.click(filter);
            await user.click(screen.getByRole('menuitemradio', { name: text.exclude }));
            await waitFor(() => expect(input).toHaveFocus());
            fireEvent.change(input, { target: { value: 'postgres' } });
            expect(screen.queryByRole('option')).not.toBeInTheDocument();
            await user.click(screen.getByRole('button', { name: text.reset }));
            expect(input).toHaveValue('postgres');
            expect(input).toHaveFocus();
            expect(filter).toHaveAccessibleName(text.filter);
            expect(screen.getByRole('option')).toHaveAttribute('href', hrefFor('postgres'));
            await user.click(filter);
            expect(screen.getByRole('menuitemradio', { name: text.include })).toHaveAttribute('aria-checked', 'true');
            expect(screen.getByRole('menuitemradio', { name: new RegExp(`^${text.all}`) })).toHaveAttribute('aria-checked', 'true');
        });
    }
});

function stubSearchLocationAssign() {
    // jsdom's Location wrapper is non-configurable; mock its delegate, not window.
    const implementationKey = Object.getOwnPropertySymbols(window.location).find(key => key.description === 'impl');
    if (!implementationKey) throw new Error('Expected jsdom Location implementation');
    const implementation = Reflect.get(window.location, implementationKey) as { assign: (href: string) => void };
    return vi.spyOn(implementation, 'assign').mockImplementation(() => {});
}

describe('DocsSearch navigation callback', () => {
    afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

    it('accepts plain Enter on the selected result, closes suggestions and retains query and group', async () => {
        const assign = stubSearchLocationAssign();
        const navigateDocs = vi.fn(() => true);
        const user = userEvent.setup();
        render(<PublicDocsNavigationContext.Provider value={navigateDocs}><DocsSearch groups={groups} entries={entries} lang="en" hrefFor={id => `/en/docs/${id}`} /></PublicDocsNavigationContext.Provider>);
        const input = screen.getByRole('combobox');
        fireEvent.change(input, { target: { value: 'SQL' } });
        await user.click(screen.getByRole('button', { name: 'Filter' }));
        await user.click(within(await screen.findByRole('menu')).getByRole('menuitemradio', { name: /^SQL Workspace/ }));
        await waitFor(() => expect(input).toHaveFocus());
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        expect(screen.getByRole('option', { name: /Result Grid/ })).toHaveAttribute('aria-selected', 'true');
        expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(false);
        expect(navigateDocs).toHaveBeenCalledOnce();
        expect(navigateDocs).toHaveBeenCalledWith('/en/docs/results');
        expect(assign).not.toHaveBeenCalled();
        expect(input).toHaveAttribute('aria-expanded', 'false');
        expect(input).toHaveValue('SQL');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Filter: Include only · SQL Workspace' })).toHaveAttribute('data-active', 'true');
        fireEvent.click(input);
        expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(2);
        expect(input).toHaveValue('SQL');
    });

    it('retains an excluded group and query after navigating the selected search result', async () => {
        const assign = stubSearchLocationAssign();
        const navigateDocs = vi.fn(() => true);
        const user = userEvent.setup();
        render(<PublicDocsNavigationContext.Provider value={navigateDocs}><DocsSearch groups={groups} entries={entries} lang="en" hrefFor={id => `/en/docs/${id}`} /></PublicDocsNavigationContext.Provider>);
        const input = screen.getByRole('combobox');
        const filter = screen.getByRole('button', { name: 'Filter' });
        fireEvent.change(input, { target: { value: 'SQL' } });
        await user.click(filter);
        await user.click(within(await screen.findByRole('menu')).getByRole('menuitemradio', { name: /^Connections/ }));
        await waitFor(() => expect(input).toHaveFocus());
        await user.click(filter);
        await user.click(within(await screen.findByRole('menu')).getByRole('menuitemradio', { name: 'Exclude' }));
        await waitFor(() => expect(input).toHaveFocus());
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        expect(screen.getByRole('option', { name: /Result Grid/ })).toHaveAttribute('aria-selected', 'true');
        expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(false);
        expect(navigateDocs).toHaveBeenCalledWith('/en/docs/results');
        expect(assign).not.toHaveBeenCalled();
        expect(input).toHaveValue('SQL');
        expect(input).toHaveAttribute('aria-expanded', 'false');
        expect(filter).toHaveAccessibleName('Filter: Exclude · Connections');
        fireEvent.click(input);
        expect(screen.getByRole('status')).toHaveTextContent('2/2 topics');
        expect(screen.getByText('Exclude · Connections')).toHaveClass('pe-search-caption');
        await user.click(filter);
        expect(screen.getByRole('menuitemradio', { name: 'Exclude' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('menuitemradio', { name: /^Connections/ })).toHaveAttribute('aria-checked', 'true');
    });

    it.each(['declined', 'unavailable'])('uses location.assign only when navigation is %s and still closes suggestions', availability => {
        const assign = stubSearchLocationAssign();
        const navigateDocs = availability === 'declined' ? vi.fn(() => false) : undefined;
        render(<PublicDocsNavigationContext.Provider value={navigateDocs}><DocsSearch groups={groups} entries={entries} lang="en" hrefFor={id => `/en/docs/${id}`} /></PublicDocsNavigationContext.Provider>);
        const input = screen.getByRole('combobox');
        fireEvent.change(input, { target: { value: 'MongoDB' } });
        expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(false);
        expect(assign).toHaveBeenCalledOnce();
        expect(assign).toHaveBeenCalledWith('/en/docs/mongodb');
        if (navigateDocs) {
            expect(navigateDocs).toHaveBeenCalledWith('/en/docs/mongodb');
            expect(navigateDocs.mock.invocationCallOrder[0]).toBeLessThan(assign.mock.invocationCallOrder[0]);
        }
        expect(input).toHaveValue('MongoDB');
        expect(input).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it.each(['ctrlKey', 'metaKey', 'shiftKey', 'altKey'])('leaves %s+Enter untouched rather than replacing modified native behavior', modifier => {
        const assign = stubSearchLocationAssign();
        const navigateDocs = vi.fn(() => true);
        render(<PublicDocsNavigationContext.Provider value={navigateDocs}><DocsSearch groups={groups} entries={entries} lang="en" hrefFor={id => `/en/docs/${id}`} /></PublicDocsNavigationContext.Provider>);
        const input = screen.getByRole('combobox');
        fireEvent.change(input, { target: { value: 'SQL' } });
        expect(fireEvent.keyDown(input, { key: 'Enter', [modifier]: true })).toBe(true);
        expect(navigateDocs).not.toHaveBeenCalled();
        expect(assign).not.toHaveBeenCalled();
        expect(input).toHaveAttribute('aria-expanded', 'true');
        expect(input).toHaveValue('SQL');
    });
});
