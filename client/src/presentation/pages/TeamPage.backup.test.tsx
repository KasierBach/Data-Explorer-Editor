import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizationService } from '@/core/services/OrganizationService';
import { TeamPage } from './TeamPage';

vi.mock('@/core/services/OrganizationService', () => ({
  OrganizationService: {
    getMyOrganizations: vi.fn(),
    getMyInvitations: vi.fn().mockResolvedValue([]),
    getMembers: vi.fn().mockResolvedValue([]),
    getTeamConnections: vi.fn().mockResolvedValue([]),
    getTeamQueries: vi.fn().mockResolvedValue([]),
    getTeamDashboards: vi.fn().mockResolvedValue([]),
    exportOrganizationBackup: vi.fn(),
    restoreOrganizationBackup: vi.fn(),
  },
}));
vi.mock('@/core/services/TeamspaceService', () => ({
  TeamspaceService: { getTeamspaces: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/core/services/store', () => ({ useAppStore: () => ({ lang: 'en' }) }));
vi.mock('@/presentation/hooks/useResponsiveLayoutMode', () => ({
  useResponsiveLayoutMode: () => ({ isCompactMobileLayout: false, isSmallMobile: false }),
}));

describe('TeamPage backup permissions', () => {
  beforeEach(() => vi.clearAllMocks());

  async function openBackup(role: string) {
    vi.mocked(OrganizationService.getMyOrganizations).mockResolvedValue([{
      id: 'org', name: 'Test Team', slug: 'test-team', currentUserRole: role, memberCount: 1,
      createdAt: '2026-10-22T00:00:00Z', updatedAt: '2026-10-22T00:00:00Z',
    }]);
    await act(async () => { render(<MemoryRouter><TeamPage /></MemoryRouter>); });
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Backups' }));
  }

  it.each(['MEMBER', 'VIEWER'])('explains backup restrictions to %s without export or restore controls', async (role) => {
    await openBackup(role);
    expect(screen.getByText('Only owners and admins can export or restore a full organization backup.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export backup' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restore backup' })).not.toBeInTheDocument();
    expect(OrganizationService.exportOrganizationBackup).not.toHaveBeenCalled();
    expect(OrganizationService.restoreOrganizationBackup).not.toHaveBeenCalled();
  });

  it.each(['OWNER', 'ADMIN'])('keeps export and restore controls available to %s', async (role) => {
    await openBackup(role);
    expect(screen.getByRole('button', { name: 'Export backup' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Restore backup' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Restore backup' })).toBeInTheDocument();
  });
});
