import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiService } from './api.service';
import { OrganizationService } from './OrganizationService';

vi.mock('./api.service', () => ({
  apiService: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),
  },
}));

describe('OrganizationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates organizations via PUT to match the server route contract', async () => {
    vi.spyOn(apiService, 'request').mockResolvedValue({ id: 'org-1' });

    await OrganizationService.updateOrganization('org-1', { name: 'Renamed' });

    expect(apiService.request).toHaveBeenCalledWith(
      '/organizations/org-1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ name: 'Renamed' }),
      }),
    );
    expect(apiService.patch).not.toHaveBeenCalled();
  });

  it('updates member roles via PUT to match the server route contract', async () => {
    vi.spyOn(apiService, 'request').mockResolvedValue({ id: 'user-2' });

    await OrganizationService.updateMemberRole('org-1', 'user-2', 'ADMIN');

    expect(apiService.request).toHaveBeenCalledWith(
      '/organizations/org-1/members/user-2',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ role: 'ADMIN' }),
      }),
    );
    expect(apiService.patch).not.toHaveBeenCalled();
  });
});
