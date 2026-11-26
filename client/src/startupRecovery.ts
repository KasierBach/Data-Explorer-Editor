// Keep pre-mount recovery independent of React, providers and persisted workspace state.
export function getRecoveryText(lang: string) {
    return lang.toLowerCase().split('-')[0] === 'en'
        ? {
            startupHeading: 'This page could not be loaded',
            startupMessage: 'Reload the page to try again. Your saved work will not be cleared.',
            heading: 'Something went wrong',
            renderMessage: 'This view could not be loaded. Try again to continue.',
            chunkMessage: 'This view could not be loaded. Reload the page to get the latest version.',
            retry: 'Try again',
            reload: 'Reload page',
        }
        : {
            startupHeading: 'Không thể tải trang này',
            startupMessage: 'Tải lại trang để thử lại. Dữ liệu đã lưu của bạn sẽ không bị xóa.',
            heading: 'Đã xảy ra lỗi',
            renderMessage: 'Không thể hiển thị nội dung này. Hãy thử lại để tiếp tục.',
            chunkMessage: 'Không thể tải nội dung này. Hãy tải lại trang để nhận phiên bản mới nhất.',
            retry: 'Thử lại',
            reload: 'Tải lại trang',
        };
}

export function isChunkLoadError(error: unknown): boolean {
    if (error instanceof Error && error.name === 'ChunkLoadError') return true;
    const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
    return /Loading (?:CSS )?chunk .+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|Failed to load module script/i.test(message);
}

export function reloadPage(location: Pick<Location, 'href' | 'replace'> = window.location) {
    const url = new URL(location.href);
    const marker = Date.now().toString(36);
    const previous = url.searchParams.get('_recovery');
    const sameMoment = previous === marker || previous?.startsWith(`${marker}_`);
    const previousAttempt = sameMoment ? Number.parseInt(previous?.slice(marker.length + 1) ?? '0', 36) : 0;
    const attempt = Number.isSafeInteger(previousAttempt) ? previousAttempt + 1 : 1;
    url.searchParams.set('_recovery', sameMoment ? `${marker}_${attempt.toString(36)}` : marker);
    location.replace(url.href);
}

export function showStartupFallback(root: HTMLElement, lang: string) {
    if (root.querySelector('[data-startup-fallback]')) return;
    const text = getRecoveryText(lang);
    const fallback = document.createElement('section');
    fallback.setAttribute('data-startup-fallback', 'true');
    fallback.setAttribute('role', 'alert');
    fallback.tabIndex = -1;
    fallback.className = 'space-y-4 bg-background p-6 text-center text-foreground';
    const heading = document.createElement('h2');
    heading.className = 'text-xl font-semibold';
    heading.textContent = text.startupHeading;
    const message = document.createElement('p');
    message.className = 'text-sm text-muted-foreground';
    message.textContent = text.startupMessage;
    const reload = document.createElement('button');
    reload.type = 'button';
    reload.className = 'min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground';
    reload.textContent = text.reload;
    reload.addEventListener('click', () => reloadPage());
    fallback.append(heading, message, reload);
    // A failed enhancement must never replace the crawlable public document.
    if (root.hasAttribute('data-public-rendered')) root.prepend(fallback);
    else root.replaceChildren(fallback);
    fallback.focus();
}
