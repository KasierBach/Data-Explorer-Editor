import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@/core/services/store/slices/authSlice';
import { LegalConsentPage } from './LegalPages';

const mocks = vi.hoisted(() => ({
    useAppStore: vi.fn(),
    patch: vi.fn(),
    updateUser: vi.fn(),
    logout: vi.fn(),
    navigate: vi.fn(),
    seo: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
}));

vi.mock('@/core/services/store', () => ({ useAppStore: mocks.useAppStore }));
vi.mock('@/core/services/api.service', () => ({ apiService: { patch: mocks.patch } }));
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
    return { ...actual, useNavigate: () => mocks.navigate };
});
vi.mock('@/presentation/components/shared/Seo', () => ({
    SEO: (props: unknown) => {
        mocks.seo(props);
        return null;
    },
}));
vi.mock('@/presentation/public/PublicRoutePage', () => ({ PublicRoutePage: () => null }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));

const localeCases = [
    {
        lang: 'vi',
        title: 'Xác nhận trước khi vào workspace',
        seoTitle: 'Chấp thuận pháp lý',
        agree: 'Tôi đồng ý và tiếp tục',
        saving: 'Đang lưu...',
        back: 'Quay lại đăng nhập',
        success: 'Đã lưu chấp thuận pháp lý.',
        failure: 'Không thể lưu chấp thuận pháp lý.',
        terms: 'Điều khoản dịch vụ',
        privacy: 'Chính sách riêng tư',
        legal: 'Trung tâm pháp lý',
        prefix: '',
    },
    {
        lang: 'en',
        title: 'Confirm before entering the workspace',
        seoTitle: 'Legal consent',
        agree: 'I agree and continue',
        saving: 'Saving...',
        back: 'Back to sign in',
        success: 'Legal consent saved.',
        failure: 'Could not save legal consent.',
        terms: 'Terms of Service',
        privacy: 'Privacy Policy',
        legal: 'Legal Center',
        prefix: '/en',
    },
] as const;

const unacceptedUser: AuthUser = {
    id: 'legal-user',
    email: 'legal-user@example.test',
    name: 'Consent test user',
    legalAcceptedAt: null,
};

const acceptedUser: AuthUser = {
    ...unacceptedUser,
    name: 'Server-confirmed user',
    role: 'MEMBER',
    legalAcceptedAt: '2026-11-18T08:30:00.000Z',
};

function deferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    const promise = new Promise<T>((resolvePromise) => {
        resolve = resolvePromise;
    });
    return { promise, resolve };
}

function renderConsentPage() {
    return render(
        <MemoryRouter initialEntries={['/legal-consent']}>
            <LegalConsentPage />
        </MemoryRouter>,
    );
}

describe.each(localeCases)('LegalConsentPage ($lang)', (text) => {
    let currentUser: AuthUser;

    beforeEach(() => {
        vi.resetAllMocks();
        currentUser = { ...unacceptedUser };
        mocks.useAppStore.mockImplementation(() => ({
            lang: text.lang,
            user: currentUser,
            updateUser: mocks.updateUser,
            logout: mocks.logout,
        }));
    });

    afterEach(() => cleanup());

    it('renders localized titles, actions, and new-tab document links without submitting consent', () => {
        renderConsentPage();

        expect(screen.getByRole('heading', { level: 1, name: text.title })).toBeInTheDocument();
        expect(mocks.seo).toHaveBeenCalledWith(expect.objectContaining({
            title: text.seoTitle,
            lang: text.lang,
            robots: 'noindex, nofollow',
        }));
        expect(screen.getByRole('button', { name: text.agree })).toBeEnabled();
        expect(screen.getByRole('button', { name: text.back })).toBeEnabled();

        for (const [label, path] of [
            [text.terms, '/terms'],
            [text.privacy, '/privacy'],
            [text.legal, '/legal'],
        ]) {
            const link = screen.getByRole('link', { name: label });
            expect(link).toHaveAttribute('href', `${text.prefix}${path}`);
            expect(link).toHaveAttribute('target', '_blank');
            expect(link.getAttribute('rel')?.split(/\s+/)).toEqual(expect.arrayContaining(['noreferrer']));
        }

        expect(mocks.patch).not.toHaveBeenCalled();
        expect(mocks.updateUser).not.toHaveBeenCalled();
        expect(mocks.navigate).not.toHaveBeenCalled();
        expect(mocks.success).not.toHaveBeenCalled();
        expect(mocks.error).not.toHaveBeenCalled();
        expect(currentUser.legalAcceptedAt).toBeNull();
    });

    it('disables both actions while saving and only accepts the server-returned user after success', async () => {
        const request = deferred<AuthUser>();
        mocks.patch.mockReturnValueOnce(request.promise);
        const user = userEvent.setup();
        renderConsentPage();
        const agreeButton = screen.getByRole('button', { name: text.agree });
        const backButton = screen.getByRole('button', { name: text.back });
        expect(mocks.patch).not.toHaveBeenCalled();

        await user.click(agreeButton);

        expect(mocks.patch).toHaveBeenCalledTimes(1);
        expect(mocks.patch).toHaveBeenCalledWith('/users/legal-consent', {});
        expect(screen.getByRole('button', { name: text.saving })).toBeDisabled();
        expect(backButton).toBeDisabled();
        await user.click(agreeButton);
        await user.click(backButton);
        expect(mocks.patch).toHaveBeenCalledTimes(1);
        expect(mocks.updateUser).not.toHaveBeenCalled();
        expect(mocks.navigate).not.toHaveBeenCalled();
        expect(mocks.success).not.toHaveBeenCalled();
        expect(mocks.error).not.toHaveBeenCalled();
        expect(mocks.logout).not.toHaveBeenCalled();
        expect(currentUser.legalAcceptedAt).toBeNull();

        await act(async () => {
            request.resolve(acceptedUser);
            await request.promise;
        });

        await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledWith(acceptedUser));
        expect(mocks.updateUser).toHaveBeenCalledTimes(1);
        expect(mocks.success).toHaveBeenCalledTimes(1);
        expect(mocks.success).toHaveBeenCalledWith(text.success);
        expect(mocks.navigate).toHaveBeenCalledTimes(1);
        expect(mocks.navigate).toHaveBeenCalledWith('/sql-explorer', { replace: true });
        expect(mocks.error).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: text.agree })).toBeEnabled();
        expect(screen.getByRole('button', { name: text.back })).toBeEnabled();
    });

    it.each([
        { kind: 'Error', rejection: new Error('Consent service unavailable'), message: 'Consent service unavailable' },
        { kind: 'non-Error', rejection: { message: 'Not an Error instance' }, message: text.failure },
    ])('reports an $kind rejection without accepting consent and allows a successful retry', async ({ rejection, message }) => {
        mocks.patch.mockRejectedValueOnce(rejection).mockResolvedValueOnce(acceptedUser);
        const user = userEvent.setup();
        renderConsentPage();

        await user.click(screen.getByRole('button', { name: text.agree }));

        await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(message));
        expect(mocks.error).toHaveBeenCalledTimes(1);
        expect(mocks.patch).toHaveBeenCalledTimes(1);
        expect(mocks.patch).toHaveBeenNthCalledWith(1, '/users/legal-consent', {});
        expect(mocks.updateUser).not.toHaveBeenCalled();
        expect(mocks.navigate).not.toHaveBeenCalled();
        expect(mocks.success).not.toHaveBeenCalled();
        expect(currentUser.legalAcceptedAt).toBeNull();
        expect(screen.getByRole('button', { name: text.agree })).toBeEnabled();
        expect(screen.getByRole('button', { name: text.back })).toBeEnabled();

        await user.click(screen.getByRole('button', { name: text.agree }));

        await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledWith(acceptedUser));
        expect(mocks.patch).toHaveBeenCalledTimes(2);
        expect(mocks.patch).toHaveBeenNthCalledWith(2, '/users/legal-consent', {});
        expect(mocks.updateUser).toHaveBeenCalledTimes(1);
        expect(mocks.success).toHaveBeenCalledTimes(1);
        expect(mocks.success).toHaveBeenCalledWith(text.success);
        expect(mocks.navigate).toHaveBeenCalledTimes(1);
        expect(mocks.navigate).toHaveBeenCalledWith('/sql-explorer', { replace: true });
        expect(mocks.error).toHaveBeenCalledTimes(1);
    });

    it('redirects an already accepted user without submitting consent again', async () => {
        currentUser = { ...acceptedUser };
        renderConsentPage();

        await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/sql-explorer', { replace: true }));
        expect(mocks.patch).not.toHaveBeenCalled();
        expect(mocks.updateUser).not.toHaveBeenCalled();
        expect(mocks.success).not.toHaveBeenCalled();
        expect(mocks.error).not.toHaveBeenCalled();
    });

    it('returns to sign in without logging out or submitting consent', async () => {
        const user = userEvent.setup();
        renderConsentPage();

        await user.click(screen.getByRole('button', { name: text.back }));

        expect(mocks.navigate).toHaveBeenCalledTimes(1);
        expect(mocks.navigate).toHaveBeenCalledWith('/login');
        expect(mocks.logout).not.toHaveBeenCalled();
        expect(mocks.patch).not.toHaveBeenCalled();
        expect(mocks.updateUser).not.toHaveBeenCalled();
        expect(mocks.success).not.toHaveBeenCalled();
        expect(mocks.error).not.toHaveBeenCalled();
        expect(currentUser.legalAcceptedAt).toBeNull();
    });
});
