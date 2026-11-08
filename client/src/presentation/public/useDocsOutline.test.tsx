import { act, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useDocsOutline } from './useDocsOutline';

vi.stubGlobal('IntersectionObserver', undefined);

describe('useDocsOutline', () => {
    it('keeps the outline local to article headings and excludes discovery controls', async () => {
        const article = document.createElement('article');
        article.innerHTML = '<h2 id="query">Queries</h2><h3>Examples</h3><section data-doc-outline-exclude><h2>Discovery</h2></section>';
        const scroll = document.createElement('main');
        scroll.append(article);
        document.body.append(scroll);
        const { result, unmount } = renderHook(() => useDocsOutline(useRef(article), useRef(scroll), 'editor'));
        await act(() => new Promise(resolve => requestAnimationFrame(resolve)));
        expect(result.current.headings.map(heading => heading.id)).toEqual(['query', 'heading-1']);
        expect(result.current.headings.map(heading => heading.text)).toEqual(['Queries', 'Examples']);
        unmount();
        scroll.remove();
    });
});
