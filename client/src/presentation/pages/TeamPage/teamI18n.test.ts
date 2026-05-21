import { describe, expect, it } from 'vitest';
import { getTeamText } from './teamI18n';

describe('teamI18n', () => {
  it('returns Vietnamese copy for team workflows', () => {
    const text = getTeamText('vi');

    expect(text.title).toBe('Nhóm');
    expect(text.inviteMemberTitle).toBe('Mời thành viên');
    expect(text.createTeamTitle).toBe('Tạo nhóm mới');
    expect(text.commentsTitle('Kho dữ liệu')).toBe('Bình luận cho Kho dữ liệu');
  });

  it('returns English copy for team workflows', () => {
    const text = getTeamText('en');

    expect(text.title).toBe('Teams');
    expect(text.inviteMemberTitle).toBe('Invite Member');
    expect(text.createTeamTitle).toBe('Create New Team');
    expect(text.commentsTitle('Warehouse')).toBe('Comments for Warehouse');
  });
});
