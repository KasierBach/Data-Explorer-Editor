import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiQualityMetrics, AiTokenUsage } from '@/core/services/AdminService';
import { AiQualityView } from './AiQualityView';

const mocks = vi.hoisted(() => ({
    lang: 'en' as 'en' | 'vi',
    data: undefined as AiQualityMetrics | undefined,
    getAiQualityMetrics: vi.fn(),
}));
vi.mock('@tanstack/react-query', () => ({
    useQuery: ({ queryFn }: { queryFn: () => unknown }) => {
        queryFn();
        return { data: mocks.data, isLoading: false, error: null };
    },
}));
vi.mock('@/core/services/store', () => ({
    useAppStore: (selector: (state: { lang: string }) => unknown) => selector({ lang: mocks.lang }),
}));
vi.mock('@/core/services/AdminService', () => ({
    adminService: { getAiQualityMetrics: mocks.getAiQualityMetrics },
}));

const measured: AiTokenUsage = {
    promptTokens: 1200, completionTokens: 300, totalTokens: 1500, trackedRequests: 1,
    attempts: 2, measuredAttempts: 1, unmeasuredAttempts: 1,
    usageCoverage: 'partial', observedOnly: true, costCoverage: 'unavailable',
};
const metrics: AiQualityMetrics = {
    days: 30, generations: 2, success: 1, failed: 1, successRate: 50,
    averageLatencyMs: 45, p95LatencyMs: 60, feedback: { up: 1, down: 0, total: 1 },
    tokens: measured, models: [{ model: 'test/model', success: 1, failed: 1, total: 2 }],
};

function renderMetrics(data: AiQualityMetrics = metrics, lang: 'en' | 'vi' = 'en') {
    mocks.data = data;
    mocks.lang = lang;
    return render(<AiQualityView />);
}

describe('AiQualityView operational coverage display', () => {
    beforeEach(() => { vi.clearAllMocks(); mocks.data = undefined; mocks.lang = 'en'; });

    it.each(['en', 'vi'] as const)('labels all tasks and transport/contract success honestly in %s', (lang) => {
        const { container } = renderMetrics(metrics, lang);
        expect(screen.getByText(lang === 'en' ? 'AI generations' : 'Lượt AI')).toBeInTheDocument();
        expect(screen.getAllByText(lang === 'en' ? 'Operational success' : 'Thành công vận hành')).toHaveLength(2);
        expect(screen.getByText('50%')).toBeInTheDocument();
        expect(container.textContent).toContain(lang === 'en' ? 'Success = transport/contract, not semantic accuracy.' : 'Thành công = truyền tải/hợp đồng, không phải độ đúng ngữ nghĩa.');
        expect(container.textContent).toContain(lang === 'en' ? 'Coverage: partial. Cost: unavailable.' : 'Độ phủ: một phần. Chi phí: không khả dụng.');
        expect(container.textContent).toContain(lang === 'en' ? '1/2 measured attempts · 1 unmeasured' : '1/2 lượt thử đã đo · 1 chưa đo');
        expect(screen.getAllByText('1.5K')).toHaveLength(2);
        expect(container.textContent).not.toMatch(/SQL generations|Lượt tạo SQL|Tokens consumed|Token tiêu thụ/);
        expect(container.firstElementChild).toHaveClass('space-y-5');
        expect(container.querySelector('.grid')).toHaveClass('gap-3', 'sm:grid-cols-2', 'xl:grid-cols-5');
        expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['7d', '30d', '90d']);
    });

    it.each(['complete', 'partial'] as const)('retains explicitly observed zero for %s coverage', (usageCoverage) => {
        renderMetrics({ ...metrics, tokens: { ...measured, promptTokens: 0, completionTokens: 0, totalTokens: 0, usageCoverage } });
        expect(screen.getAllByText('0')).toHaveLength(4);
        expect(screen.getByText(new RegExp(`Coverage: ${usageCoverage}`))).toBeInTheDocument();
    });

    it.each([
        { ...measured, promptTokens: 0, completionTokens: 0, totalTokens: 0, usageCoverage: 'unavailable' as const, measuredAttempts: 0, unmeasuredAttempts: 2 },
        { promptTokens: 0, completionTokens: 0, totalTokens: 0, trackedRequests: 1 },
        { ...measured, observedOnly: undefined },
    ])('renders unavailable and old coverage fields as unknown, never measured zero', (tokens) => {
        renderMetrics({ ...metrics, tokens });
        expect(screen.getAllByText('—')).toHaveLength(4);
        expect(screen.getByText(/Coverage: unavailable. Cost: unavailable./)).toBeInTheDocument();
        expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('handles missing/null metadata without undefined values or invented metrics', () => {
        const { container } = renderMetrics({
            ...metrics, generations: null, successRate: null, averageLatencyMs: null,
            p95LatencyMs: null, feedback: null, models: null, tokens: null,
        });
        expect(screen.getByText('Model metrics unavailable.')).toBeInTheDocument();
        expect(screen.getByText('—/—')).toBeInTheDocument();
        expect(screen.getByText('By model · p95 —')).toBeInTheDocument();
        expect(container.textContent).not.toMatch(/undefined|null|NaN|0%|0 ms/);
    });

    it('does not present an empty period as measured success or latency', () => {
        renderMetrics({ ...metrics, generations: 0, successRate: 0, averageLatencyMs: 0, p95LatencyMs: 0, tokens: null, models: [] });
        expect(screen.getByText('No AI generations in this period.')).toBeInTheDocument();
        expect(screen.queryByText('0%')).not.toBeInTheDocument();
        expect(screen.queryByText('0 ms')).not.toBeInTheDocument();
    });

    it('keeps the existing period controls and service request unchanged', () => {
        renderMetrics();
        expect(mocks.getAiQualityMetrics).toHaveBeenCalledWith(30);
        fireEvent.click(screen.getByRole('button', { name: '7d' }));
        expect(mocks.getAiQualityMetrics).toHaveBeenLastCalledWith(7);
    });
});
