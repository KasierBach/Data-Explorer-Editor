import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { RefObject } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicLanguage } from '@/core/seo/publicRoutes';
import { LandingBackToTop } from './LandingBackToTop';
import { LandingBody } from './LandingBody';

interface ObservedSentinel {
    callback: IntersectionObserverCallback;
    instance: IntersectionObserver;
}

let observers: ObservedSentinel[];
let frames: Map<number, FrameRequestCallback>;

beforeEach(() => {
    observers = [];
    frames = new Map();
    let nextFrame = 0;
    vi.stubGlobal('scrollY', 0);
    vi.stubGlobal('innerHeight', 800);
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
        const id = ++nextFrame;
        frames.set(id, callback);
        return id;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => { frames.delete(id); }));
    vi.stubGlobal('IntersectionObserver', vi.fn(function (callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        const instance: IntersectionObserver = {
            root: options?.root ?? null,
            rootMargin: '0px',
            thresholds: [0],
            observe: vi.fn(),
            unobserve: vi.fn(),
            disconnect: vi.fn(),
            takeRecords: vi.fn(() => []),
        };
        observers.push({ callback, instance });
        return instance;
    }));
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

function mount(lang: PublicLanguage = 'en') {
    const targetRef: RefObject<HTMLDivElement | null> = { current: null };
    const result = render(<><div id="landing-top" ref={targetRef} tabIndex={-1} /><LandingBackToTop lang={lang} targetRef={targetRef} /></>);
    return {
        ...result,
        target: targetRef.current!,
        link: result.container.querySelector<HTMLAnchorElement>('.lp-back-to-top')!,
    };
}

function flushFrames() {
    act(() => {
        for (const [id, callback] of frames) {
            frames.delete(id);
            callback(0);
        }
    });
}

function intersect(target: Element, isIntersecting: boolean, top: number) {
    const entry: IntersectionObserverEntry = {
        target,
        isIntersecting,
        boundingClientRect: new DOMRect(0, top, 1, 800),
        intersectionRect: new DOMRect(),
        intersectionRatio: isIntersecting ? 1 : 0,
        rootBounds: null,
        time: 0,
    };
    act(() => observers[0].callback([entry], observers[0].instance));
}

const locales = [
    { lang: 'vi', label: 'Quay lên đầu trang' },
    { lang: 'en', label: 'Back to top' },
] as const;

describe('LandingBackToTop progressive enhancement', () => {
    it.each(locales)('renders a visible native SSR fallback in $lang without running browser effects', ({ lang, label }) => {
        const html = renderToStaticMarkup(<LandingBackToTop lang={lang} targetRef={{ current: null }} />);
        const document = new DOMParser().parseFromString(html, 'text/html');
        const link = document.querySelector('a')!;
        expect(document.querySelectorAll('a')).toHaveLength(1);
        expect(link.getAttribute('href')).toBe('#landing-top');
        expect(link.getAttribute('aria-label')).toBe(label);
        expect(link.textContent).toBe(label);
        expect(link.classList.contains('lp-back-to-top')).toBe(true);
        expect(link.getAttribute('data-enhanced')).toBe('false');
        expect(link.hasAttribute('hidden')).toBe(false);
        expect(window.requestAnimationFrame).not.toHaveBeenCalled();
        expect(IntersectionObserver).not.toHaveBeenCalled();
    });

    it.each(locales)('pairs the SSR link with the actual focusable LandingBody top sentinel in $lang', ({ lang, label }) => {
        const html = renderToStaticMarkup(<LandingBody lang={lang} paused />);
        const document = new DOMParser().parseFromString(html, 'text/html');
        const main = document.querySelector('main')!;
        const target = document.querySelector('#landing-top')!;
        expect(document.querySelectorAll('#landing-top')).toHaveLength(1);
        expect(main.firstElementChild).toBe(target);
        expect(target.tagName).toBe('DIV');
        expect(target.getAttribute('tabindex')).toBe('-1');
        expect(target.classList.contains('lp-top-target')).toBe(true);
        const link = main.querySelector('.lp-back-to-top')!;
        expect(link.getAttribute('href')).toBe(`#${target.id}`);
        expect(link.getAttribute('aria-label')).toBe(label);
        expect(link.hasAttribute('hidden')).toBe(false);
    });

    it('preserves the pre-enhancement link and then hides it within the first viewport', () => {
        const addListener = vi.spyOn(window, 'addEventListener');
        const { link, target } = mount();
        expect(screen.getByRole('link', { name: 'Back to top' })).toBe(link);
        expect(link).toHaveAttribute('data-enhanced', 'false');
        expect(link).toBeVisible();
        expect(IntersectionObserver).toHaveBeenCalledWith(expect.any(Function), { threshold: 0 });
        expect(observers[0].instance.observe).toHaveBeenCalledExactlyOnceWith(target);
        expect(addListener).not.toHaveBeenCalledWith('scroll', expect.any(Function), expect.anything());
        expect(addListener).toHaveBeenCalledWith('resize', expect.any(Function));
        flushFrames();
        expect(link).toHaveAttribute('data-enhanced', 'true');
        expect(link).toHaveAttribute('hidden');
        expect(link).not.toBeVisible();
    });

    it('is visible after enhancement when an initial restored scroll exceeds one viewport', () => {
        vi.stubGlobal('scrollY', 801);
        const { link } = mount();
        flushFrames();
        expect(link).toHaveAttribute('data-enhanced', 'true');
        expect(link).not.toHaveAttribute('hidden');
        expect(link).toBeVisible();
    });

    it('uses sentinel intersection and position to show only below the first viewport', () => {
        const { link, target } = mount();
        flushFrames();
        intersect(target, true, 0);
        expect(link).not.toBeVisible();
        intersect(target, false, -801);
        expect(link).toBeVisible();
        expect(screen.getByRole('link', { name: 'Back to top' })).toBe(link);
        intersect(target, true, -200);
        expect(link).not.toBeVisible();
        intersect(target, false, 800);
        expect(link).not.toBeVisible();
        intersect(target, false, 0);
        expect(link).not.toBeVisible();
    });

    it('disconnects the observer, cancels pending enhancement and removes resize work on unmount', () => {
        const addListener = vi.spyOn(window, 'addEventListener');
        const removeListener = vi.spyOn(window, 'removeEventListener');
        const { unmount } = mount();
        const resize = addListener.mock.calls.find(([event]) => event === 'resize')![1];
        expect(frames.size).toBe(1);
        unmount();
        expect(observers[0].instance.disconnect).toHaveBeenCalledOnce();
        expect(window.cancelAnimationFrame).toHaveBeenCalledExactlyOnceWith(1);
        expect(frames.size).toBe(0);
        expect(removeListener).toHaveBeenCalledWith('resize', resize);
    });

    it('uses a passive scroll fallback without IntersectionObserver and respects the viewport boundary', () => {
        vi.stubGlobal('IntersectionObserver', undefined);
        const addListener = vi.spyOn(window, 'addEventListener');
        const { link } = mount();
        expect(addListener).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
        flushFrames();
        expect(link).not.toBeVisible();
        vi.stubGlobal('scrollY', 800);
        fireEvent.scroll(window);
        expect(link).not.toBeVisible();
        vi.stubGlobal('scrollY', 801);
        fireEvent.scroll(window);
        expect(link).toBeVisible();
        vi.stubGlobal('innerHeight', 900);
        fireEvent(window, new Event('resize'));
        expect(link).not.toBeVisible();
        vi.stubGlobal('innerHeight', 700);
        fireEvent(window, new Event('resize'));
        expect(link).toBeVisible();
        vi.stubGlobal('scrollY', 0);
        fireEvent.scroll(window);
        expect(link).not.toBeVisible();
    });

    it('removes the same fallback scroll and resize handler and cancels its pending frame on unmount', () => {
        vi.stubGlobal('IntersectionObserver', undefined);
        const addListener = vi.spyOn(window, 'addEventListener');
        const removeListener = vi.spyOn(window, 'removeEventListener');
        const { unmount } = mount();
        const scroll = addListener.mock.calls.find(([event]) => event === 'scroll')![1];
        expect(addListener).toHaveBeenCalledWith('resize', scroll);
        unmount();
        expect(removeListener).toHaveBeenCalledWith('scroll', scroll);
        expect(removeListener).toHaveBeenCalledWith('resize', scroll);
        expect(window.cancelAnimationFrame).toHaveBeenCalledExactlyOnceWith(1);
        expect(frames.size).toBe(0);
    });

    it('keeps the native link functional when a target ref is temporarily absent', () => {
        const addListener = vi.spyOn(window, 'addEventListener');
        vi.stubGlobal('scrollY', 801);
        render(<LandingBackToTop lang="en" targetRef={{ current: null }} />);
        flushFrames();
        const link = screen.getByRole('link', { name: 'Back to top' });
        expect(IntersectionObserver).not.toHaveBeenCalled();
        expect(addListener).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
        const click = new MouseEvent('click', { bubbles: true, cancelable: true });
        expect(fireEvent(link, click)).toBe(true);
        expect(click.defaultPrevented).toBe(false);
        expect(link).toHaveAttribute('href', '#landing-top');
    });

    it.each(locales)('focuses the top target without canceling native navigation in $lang', ({ lang, label }) => {
        vi.stubGlobal('scrollY', 801);
        const { link, target } = mount(lang);
        flushFrames();
        expect(screen.getByRole('link', { name: label })).toBe(link);
        const focus = vi.spyOn(target, 'focus');
        const scrollTo = vi.spyOn(window, 'scrollTo');
        const click = new MouseEvent('click', { bubbles: true, cancelable: true });
        expect(fireEvent(link, click)).toBe(true);
        expect(click.defaultPrevented).toBe(false);
        expect(link).toHaveAttribute('href', '#landing-top');
        expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
        expect(target).toHaveFocus();
        expect(scrollTo).not.toHaveBeenCalled();
    });
});
