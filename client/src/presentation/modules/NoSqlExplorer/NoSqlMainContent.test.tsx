import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoSqlMainContent } from './NoSqlMainContent';
import { useAppStore } from '@/core/services/store';
import { useNoSqlQuery } from '@/presentation/hooks/useNoSqlQuery';

vi.mock('@/core/services/store', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('@/presentation/hooks/useNoSqlQuery', () => ({
  useNoSqlQuery: vi.fn(),
}));

vi.mock('@/presentation/hooks/useVerticalResizablePanel', () => ({
  useVerticalResizablePanel: () => ({
    height: 280,
    isDragging: false,
    startResizing: vi.fn(),
  }),
}));

vi.mock('@/presentation/hooks/useResponsiveLayoutMode', () => ({
  useResponsiveLayoutMode: () => ({
    isCompactMobileLayout: false,
  }),
}));

vi.mock('./MqlEditor', () => ({
  MqlEditor: () => <div>mock-mql-editor</div>,
}));

vi.mock('./NoSqlAggregationBuilderView', () => ({
  NoSqlAggregationBuilderView: () => <div>mock-aggregation-builder</div>,
}));

vi.mock('./NoSqlDashboard', () => ({
  NoSqlDashboard: () => <div>mock-dashboard</div>,
}));

vi.mock('./JsonTreeView', () => ({
  JsonTreeView: () => <div>mock-json-tree</div>,
}));

vi.mock('./NoSqlGridView', () => ({
  NoSqlGridView: () => <div>mock-grid</div>,
}));

vi.mock('./NoSqlSchemaAnalysisView', () => ({
  NoSqlSchemaAnalysisView: () => <div>mock-schema</div>,
}));

const mockNoSqlAiQueryBox = vi.fn();

vi.mock('./components/NoSqlAiQueryBox', () => ({
  NoSqlAiQueryBox: (props: Record<string, unknown>) => {
    mockNoSqlAiQueryBox(props);
    return <div>mock-ai-box</div>;
  },
}));

vi.mock('@/presentation/components/ui/popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const mockUseAppStore = vi.mocked(useAppStore);
const mockUseNoSqlQuery = vi.mocked(useNoSqlQuery);

describe('NoSqlMainContent', () => {
  const toggleResultPanel = vi.fn();
  const setNosqlViewMode = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseNoSqlQuery.mockReturnValue({
      result: null,
      isLoading: false,
      error: null,
      executeMql: vi.fn(),
    });

    mockUseAppStore.mockReturnValue({
      nosqlActiveCollection: 'products',
      nosqlActiveDatabase: 'warehouse',
      setNosqlCollection: vi.fn(),
      nosqlMqlQuery: '{\n  "action": "find",\n  "collection": "products"\n}',
      setNosqlMqlQuery: vi.fn(),
      nosqlResult: null,
      nosqlViewMode: 'aggregation',
      setNosqlViewMode,
      nosqlActiveConnectionId: 'mongo-1',
      connections: [
        {
          id: 'mongo-1',
          type: 'mongodb',
          readOnly: false,
          allowQueryExecution: true,
        },
      ],
      lang: 'en',
      isResultPanelOpen: true,
      toggleResultPanel,
      defaultResultHeight: 300,
      setDefaultResultHeight: vi.fn(),
    } as never);
  });

  it('shows the aggregation builder even before any result has been loaded', () => {
    render(<NoSqlMainContent />);

    expect(screen.getByText('mock-aggregation-builder')).toBeInTheDocument();
    expect(
      screen.getByText('Build a pipeline, then run it to inspect results'),
    ).toBeInTheDocument();
  });

  it('keeps the raw editor for non-aggregation modes', () => {
    mockUseAppStore.mockReturnValue({
      nosqlActiveCollection: 'products',
      nosqlActiveDatabase: 'warehouse',
      setNosqlCollection: vi.fn(),
      nosqlMqlQuery: '{\n  "action": "find",\n  "collection": "products"\n}',
      setNosqlMqlQuery: vi.fn(),
      nosqlResult: null,
      nosqlViewMode: 'tree',
      setNosqlViewMode,
      nosqlActiveConnectionId: 'mongo-1',
      connections: [
        {
          id: 'mongo-1',
          type: 'mongodb',
          readOnly: false,
          allowQueryExecution: true,
        },
      ],
      lang: 'en',
      isResultPanelOpen: true,
      toggleResultPanel,
      defaultResultHeight: 300,
      setDefaultResultHeight: vi.fn(),
    } as never);

    render(<NoSqlMainContent />);

    expect(screen.getByText('mock-mql-editor')).toBeInTheDocument();
  });

  it('passes the active NoSQL database to the AI helper even when the connection object has no database field', () => {
    render(<NoSqlMainContent />);

    expect(mockNoSqlAiQueryBox).toHaveBeenCalledWith(
      expect.objectContaining({
        currentConnectionId: 'mongo-1',
        currentDatabase: 'warehouse',
        collectionName: 'products',
      }),
    );
  });

  it('shows a visible results toggle so the panel does not rely on keyboard shortcuts', () => {
    render(<NoSqlMainContent />);

    expect(
      screen.getByRole('button', { name: /hide results/i }),
    ).toBeInTheDocument();
  });

  it('does not keep the legacy visualize tab inside the editor toolbar', () => {
    mockUseAppStore.mockReturnValue({
      nosqlActiveCollection: 'products',
      nosqlActiveDatabase: 'warehouse',
      setNosqlCollection: vi.fn(),
      nosqlMqlQuery: '{\n  "action": "find",\n  "collection": "products"\n}',
      setNosqlMqlQuery: vi.fn(),
      nosqlResult: null,
      nosqlViewMode: 'tree',
      setNosqlViewMode,
      nosqlActiveConnectionId: 'mongo-1',
      connections: [
        {
          id: 'mongo-1',
          type: 'mongodb',
          readOnly: false,
          allowQueryExecution: true,
        },
      ],
      lang: 'en',
      isResultPanelOpen: true,
      toggleResultPanel,
      defaultResultHeight: 300,
      setDefaultResultHeight: vi.fn(),
    } as never);

    render(<NoSqlMainContent />);

    expect(
      screen.queryByRole('button', { name: /visualize/i }),
    ).not.toBeInTheDocument();
  });

  it('does not auto-open the result panel when switching result views', () => {
    mockUseAppStore.mockReturnValue({
      nosqlActiveCollection: 'products',
      nosqlActiveDatabase: 'warehouse',
      setNosqlCollection: vi.fn(),
      nosqlMqlQuery: '{\n  "action": "find",\n  "collection": "products"\n}',
      setNosqlMqlQuery: vi.fn(),
      nosqlResult: null,
      nosqlViewMode: 'tree',
      setNosqlViewMode,
      nosqlActiveConnectionId: 'mongo-1',
      connections: [
        {
          id: 'mongo-1',
          type: 'mongodb',
          readOnly: false,
          allowQueryExecution: true,
        },
      ],
      lang: 'en',
      isResultPanelOpen: false,
      toggleResultPanel,
      defaultResultHeight: 300,
      setDefaultResultHeight: vi.fn(),
    } as never);

    render(<NoSqlMainContent />);

    fireEvent.click(screen.getByRole('button', { name: /schema analysis/i }));

    expect(setNosqlViewMode).toHaveBeenCalledWith('schema');
    expect(toggleResultPanel).not.toHaveBeenCalled();
  });

  it('reopens the result panel when the user runs a query', async () => {
    const executeMql = vi.fn().mockResolvedValue(undefined);

    mockUseNoSqlQuery.mockReturnValue({
      result: null,
      isLoading: false,
      error: null,
      executeMql,
    });

    mockUseAppStore.mockReturnValue({
      nosqlActiveCollection: 'products',
      nosqlActiveDatabase: 'warehouse',
      setNosqlCollection: vi.fn(),
      nosqlMqlQuery: '{\n  "action": "find",\n  "collection": "products"\n}',
      setNosqlMqlQuery: vi.fn(),
      nosqlResult: null,
      nosqlViewMode: 'tree',
      setNosqlViewMode,
      nosqlActiveConnectionId: 'mongo-1',
      connections: [
        {
          id: 'mongo-1',
          type: 'mongodb',
          readOnly: false,
          allowQueryExecution: true,
        },
      ],
      lang: 'en',
      isResultPanelOpen: false,
      toggleResultPanel,
      defaultResultHeight: 300,
      setDefaultResultHeight: vi.fn(),
    } as never);

    render(<NoSqlMainContent />);

    fireEvent.click(screen.getByRole('button', { name: /run/i }));

    expect(toggleResultPanel).toHaveBeenCalled();
    expect(executeMql).toHaveBeenCalled();
  });

  it('migrates the legacy charts view mode back to grid', () => {
    mockUseAppStore.mockReturnValue({
      nosqlActiveCollection: 'products',
      nosqlActiveDatabase: 'warehouse',
      setNosqlCollection: vi.fn(),
      nosqlMqlQuery: '{\n  "action": "find",\n  "collection": "products"\n}',
      setNosqlMqlQuery: vi.fn(),
      nosqlResult: [],
      nosqlViewMode: 'charts',
      setNosqlViewMode,
      nosqlActiveConnectionId: 'mongo-1',
      connections: [
        {
          id: 'mongo-1',
          type: 'mongodb',
          readOnly: false,
          allowQueryExecution: true,
        },
      ],
      lang: 'en',
      isResultPanelOpen: true,
      toggleResultPanel,
      defaultResultHeight: 300,
      setDefaultResultHeight: vi.fn(),
    } as never);

    render(<NoSqlMainContent />);

    expect(setNosqlViewMode).toHaveBeenCalledWith('grid');
  });
});
