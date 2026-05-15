import { Shield, Trash2, User } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import type { OrganizationMemberEntity } from '@/core/services/OrganizationService';

function getDisplayName(person?: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
  if (!person) {
    return 'Unknown';
  }

  const fullName = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
  return fullName || person.email || 'Unknown';
}

function MemberRoleControl({
  member,
  canManage,
  onUpdateRole,
}: {
  member: OrganizationMemberEntity;
  canManage: boolean;
  onUpdateRole: (userId: string, role: string) => void;
}) {
  if (canManage && member.role !== 'OWNER') {
    return (
      <Select value={member.role} onValueChange={(value) => onUpdateRole(member.userId, value)}>
        <SelectTrigger className="h-8 w-full text-xs sm:w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ADMIN">Admin</SelectItem>
          <SelectItem value="MEMBER">Member</SelectItem>
          <SelectItem value="VIEWER">Viewer</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
      {member.role === 'OWNER' && <Shield className="h-3 w-3" />}
      {member.role}
    </span>
  );
}

export function TeamMembersPanel({
  members,
  canManage,
  isCompactMobileLayout,
  onUpdateRole,
  onRemoveMember,
}: {
  members: OrganizationMemberEntity[];
  canManage: boolean;
  isCompactMobileLayout: boolean;
  onUpdateRole: (userId: string, role: string) => void;
  onRemoveMember: (userId: string) => void;
}) {
  if (members.length === 0) {
    return (
      <div className="overflow-hidden rounded-lg border">
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">No members yet.</div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      {isCompactMobileLayout ? (
        <div className="divide-y">
          {members.map((member) => (
            <div key={member.id} className="space-y-3 px-4 py-4">
              <div className="flex items-start gap-3">
                <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="break-words font-medium">{getDisplayName(member.user)}</div>
                  <div className="break-all text-xs text-muted-foreground">{member.user.email}</div>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Role</div>
                  <MemberRoleControl member={member} canManage={canManage} onUpdateRole={onUpdateRole} />
                </div>
                {canManage && member.role !== 'OWNER' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 justify-start px-0 text-destructive sm:h-7 sm:w-7 sm:justify-center"
                    onClick={() => onRemoveMember(member.userId)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="ml-2 sm:hidden">Remove member</span>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Member</th>
              <th className="px-4 py-2 text-left font-medium">Role</th>
              <th className="px-4 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="font-medium">{getDisplayName(member.user)}</div>
                      <div className="text-xs text-muted-foreground">{member.user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <MemberRoleControl member={member} canManage={canManage} onUpdateRole={onUpdateRole} />
                </td>
                <td className="px-4 py-3 text-right">
                  {canManage && member.role !== 'OWNER' && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => onRemoveMember(member.userId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
