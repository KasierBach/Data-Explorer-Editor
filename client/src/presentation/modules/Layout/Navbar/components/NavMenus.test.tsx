import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NavMenus } from './NavMenus';
import { useAppStore } from '@/core/services/store';

vi.mock('@/core/services/store', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/presentation/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, disabled, className }: { children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) => (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>{children}</button>
  ),
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuShortcut: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

const mockUseAppStore = vi.mocked(useAppStore);
let store: Record<string, unknown>;

describe('NavMenus', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    store = {
      openTab: vi.fn(),
      closeAllTabs: vi.fn(),
      isResultPanelOpen: true,
      toggleResultPanel: vi.fn(),
      nosqlActiveCollection: 'products',
      nosqlMqlQuery: '{"action":"find","collection":"products"}',
      nosqlViewMode: 'tree',
      setNosqlCollection: vi.fn(),
      setNosqlMqlQuery: vi.fn(),
      setNosqlResult: vi.fn(),
      setNosqlViewMode: vi.fn(),
      tabs: [],
      activeTabId: null,
    };

    mockUseAppStore.mockReturnValue(store as never);
    Object.assign(mockUseAppStore, {
      getState: vi.fn(() => store),
    });
  });

  it('replaces SQL-only menu actions with NoSQL-specific actions', () => {
    render(
      <NavMenus
        lang="en"
        openQueryTab={vi.fn()}
        isSidebarOpen={true}
        setSidebarOpen={vi.fn()}
        isNoSql={true}
      />,
    );

    expect(screen.queryByText('Duplicate Tab')).not.toBeInTheDocument();
    expect(screen.getByText('New MQL Query')).toBeInTheDocument();
    expect(screen.getByText('Format MQL')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close collection'));
    expect(store.setNosqlCollection).toHaveBeenCalledWith(null);

    fireEvent.click(screen.getByText('Format MQL'));
    expect(store.setNosqlMqlQuery).toHaveBeenCalledWith(`{
  "action": "find",
  "collection": "products"
}`);
  });
});