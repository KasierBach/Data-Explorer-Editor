import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiMyUsage, AiQualityMetrics, AiTokenUsage } from '@/core/services/AdminService';
import { AiUsageCard } from './AiUsageCard';

const mocks = vi.hoisted(() => ({
    lang: 'en' as 'en' | 'vi',
    data: undefined as AiMyUsage | AiQualityMetrics | undefined,
    getMyAiUsage: vi.fn(),
    getAiQualityMetrics: vi.fn(),
}));
vi.mock('@tanstack/react-query', () => ({
    useQuery: ({ queryFn }: { queryFn: () => unknown }) => {
        queryFn();
        return { data: mocks.data, isLoading: false };
    },
}));
vi.mock('@/core/services/store', () => ({
    useAppStore: (selector: (state: { lang: string }) => unknown) => selector({ lang: mocks.lang }),
}));
vi.mock('@/core/services/AdminService', () => ({
    adminService: { getMyAiUsage: mocks.getMyAiUsage, getAiQualityMetrics: mocks.getAiQualityMetrics },
}));

const measured: AiTokenUsage = {
    promptTokens: 1200, completionTokens: 300, totalTokens: 1500, trackedRequests: 1,
    attempts: 2, measuredAttempts: 1, unmeasuredAttempts: 1,
    usageCoverage: 'partial', observedOnly: true, costCoverage: 'unavailable',
};

function renderUsage(tokens: AiTokenUsage | null = measured, lang: 'en' | 'vi' = 'en', scope: 'me' | 'admin' = 'me') {
    mocks.lang = lang;
    mocks.data = { days: 30, generations: 2, success: 1, failed: 1, tokens };
    return render(<AiUsageCard scope={scope} />);
}

describe('AiUsageCard observed-usage contract', () => {
    beforeEach(() => { vi.clearAllMocks(); mocks.data = undefined; mocks.lang = 'en'; });

    it.each(['en', 'vi'] as const)('shows partial subtotals and unknown costs in %s without SQL-only claims', (lang) => {
        const { container } = renderUsage(measured, lang);
        expect(screen.getByText(lang === 'en' ? 'Observed tokens (30 days)' : 'Token quan sát (30 ngày)')).toBeInTheDocument();
        expect(screen.getByText('1.5K')).toBeInTheDocument();
        expect(container.textContent).toContain(lang === 'en' ? 'Coverage: partial. Cost: unavailable.' : 'Độ phủ: một phần. Chi phí: không khả dụng.');
        expect(container.textContent).toContain(lang === 'en' ? '1/2 measured attempts · 1 unmeasured' : '1/2 lượt thử đã đo · 1 chưa đo');
        expect(container.textContent).toContain(lang === 'en' ? '2 AI generations' : '2 lượt AI');
        expect(container.textContent).not.toMatch(/tokens consumed|lần sinh SQL/i);
        expect(mocks.getMyAiUsage).toHaveBeenCalledWith(30);
        expect(mocks.getAiQualityMetrics).not.toHaveBeenCalled();
        expect(container.firstElementChild).toHaveClass('rounded-2xl', 'p-5', 'space-y-4');
        expect(container.querySelector('.grid')).toHaveClass('grid-cols-3', 'gap-3');
    });

    it.each(['complete', 'partial'] as const)('shows explicitly measured zero only with %s coverage', (usageCoverage) => {
        const { container } = renderUsage({ ...measured, promptTokens: 0, completionTokens: 0, totalTokens: 0, usageCoverage });
        expect(screen.getAllByText('0')).toHaveLength(3);
        expect(container.textContent).toContain(`Coverage: ${usageCoverage}`);
    });

    it.each([
        { ...measured, promptTokens: 0, completionTokens: 0, totalTokens: 0, usageCoverage: 'unavailable' as const, measuredAttempts: 0, unmeasuredAttempts: 2 },
        { promptTokens: 0, completionTokens: 0, totalTokens: 0, trackedRequests: 1 },
        { ...measured, observedOnly: undefined },
    ])('does not turn unavailable/legacy usage into measured zero', (tokens) => {
        const { container } = renderUsage(tokens);
        expect(screen.getAllByText('—')).toHaveLength(3);
        expect(container.textContent).toContain('Coverage: unavailable. Cost: unavailable.');
        expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('keeps null or missing token fields unknown without hiding other observed fields', () => {
        renderUsage({ ...measured, promptTokens: null, completionTokens: undefined });
        expect(screen.getAllByText('—')).toHaveLength(2);
        expect(screen.getByText('1.5K')).toBeInTheDocument();
    });

    it.each(['en', 'vi'] as const)('keeps prompt-only partial usage independent in %s', (lang) => {
        const { container } = renderUsage({ ...measured, completionTokens: null, totalTokens: null }, lang);
        expect(screen.getByText('1.2K')).toBeInTheDocument();
        expect(screen.getAllByText('—')).toHaveLength(2);
        expect(screen.queryByText('0')).not.toBeInTheDocument();
        expect(container.textContent).toContain(lang === 'en' ? 'Coverage: partial. Cost: unavailable.' : 'Độ phủ: một phần. Chi phí: không khả dụng.');
        expect(container.querySelector('.grid')).toHaveClass('grid-cols-3', 'gap-3');
    });

    it.each(['en', 'vi'] as const)('distinguishes measured prompt zero from missing output and total in %s', (lang) => {
        renderUsage({ ...measured, promptTokens: 0, completionTokens: null, totalTokens: null }, lang);
        expect(screen.getAllByText('0')).toHaveLength(1);
        expect(screen.getAllByText('—')).toHaveLength(2);
    });

    it.each(['complete', 'partial'] as const)('keeps an unrepresentable total unknown with %s measurement coverage', (usageCoverage) => {
        renderUsage({ ...measured, totalTokens: null, usageCoverage });
        expect(screen.getByText('1.2K')).toBeInTheDocument();
        expect(screen.getByText('300')).toBeInTheDocument();
        expect(screen.getAllByText('—')).toHaveLength(1);
        expect(screen.getByText(new RegExp(`Coverage: ${usageCoverage}`))).toBeInTheDocument();
    });

    it('uses the existing admin endpoint for platform scope', () => {
        renderUsage(measured, 'en', 'admin');
        expect(mocks.getAiQualityMetrics).toHaveBeenCalledWith(30);
        expect(mocks.getMyAiUsage).not.toHaveBeenCalled();
    });

    it('reports missing usage as unavailable, not no-cost/no-use evidence', () => {
        renderUsage(null);
        expect(screen.getByText('Usage unavailable; not zero tokens.')).toBeInTheDocument();
        expect(screen.queryByText('0')).not.toBeInTheDocument();
    });
});
