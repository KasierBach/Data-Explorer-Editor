import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Plus, Users } from 'lucide-react';
import { useAppStore } from '@/core/services/store';
import { ConnectionService } from '@/core/services/ConnectionService';
import { OrganizationService } from '@/core/services/OrganizationService';
import { TeamspaceService, type TeamspaceEntity } from '@/core/services/TeamspaceService';
import { Button } from '@/presentation/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/select';

interface ShareConnectionDialogProps {
  connectionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const TEAMSPACE_UNASSIGNED = '__unassigned__';

function getTeamspaceItems(teamspaces: TeamspaceEntity[]) {
  return teamspaces.map((teamspace) => (
    <SelectItem key={teamspace.id} value={teamspace.id} className="text-xs">
      {teamspace.name}
    </SelectItem>
  ));
}

export const ShareConnectionDialog: React.FC<ShareConnectionDialogProps> = ({
  connectionId,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { lang, updateConnection } = useAppStore();
  const [shareOrgId, setShareOrgId] = useState<string>('');
  const [shareTeamspaceId, setShareTeamspaceId] = useState<string>(TEAMSPACE_UNASSIGNED);
  const [isSharing, setIsSharing] = useState(false);

  const { data: organizations = [], refetch: refetchOrgs } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => OrganizationService.getMyOrganizations(),
    enabled: open,
  });

  const { data: teamspaces = [], refetch: refetchTeamspaces } = useQuery({
    queryKey: ['teamspaces', shareOrgId],
    queryFn: () => TeamspaceService.getTeamspaces(shareOrgId),
    enabled: open && Boolean(shareOrgId),
  });

  useEffect(() => {
    if (!open) {
      setShareOrgId('');
      setShareTeamspaceId(TEAMSPACE_UNASSIGNED);
    }
  }, [open]);

  useEffect(() => {
    setShareTeamspaceId(TEAMSPACE_UNASSIGNED);
  }, [shareOrgId]);

  const handleShare = async () => {
    if (!connectionId || !shareOrgId) return;

    setIsSharing(true);
    try {
      await ConnectionService.updateConnection(connectionId, { organizationId: shareOrgId });

      if (shareTeamspaceId !== TEAMSPACE_UNASSIGNED) {
        await TeamspaceService.assignResourceTeamspace(shareOrgId, 'CONNECTION', connectionId, {
          teamspaceId: shareTeamspaceId,
        });
      }

      updateConnection(connectionId, { organizationId: shareOrgId } as any);

      onOpenChange(false);
      onSuccess?.();
      alert(lang === 'vi' ? 'Đã chia sẻ kết nối với team!' : 'Connection shared with team!');
    } catch (error: any) {
      console.error('Error sharing connection:', error);
      alert(error.message || (lang === 'vi' ? 'Lỗi khi chia sẻ kết nối' : 'Error sharing connection'));
    } finally {
      setIsSharing(false);
    }
  };

  const handleCreateTeam = async () => {
    const teamName = prompt(lang === 'vi' ? 'Nhập tên team mới:' : 'Enter new team name:');
    if (!teamName) return;

    try {
      const newOrg = await OrganizationService.createOrganization({ name: teamName });
      setShareOrgId(newOrg.id);
      setShareTeamspaceId(TEAMSPACE_UNASSIGNED);
      await refetchOrgs();
      await refetchTeamspaces();
    } catch (error: any) {
      console.error('Error creating team:', error);
      alert(error.message || (lang === 'vi' ? 'Lỗi khi tạo team' : 'Error creating team'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-1rem)] rounded-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            {lang === 'vi' ? 'Chia sẻ kết nối với team' : 'Share Connection with Team'}
          </DialogTitle>
          <DialogDescription>
            {lang === 'vi'
              ? 'Chọn team và teamspace để đưa connection này vào đúng workspace chung.'
              : 'Pick a team and teamspace to place this connection in the shared workspace.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {lang === 'vi' ? 'Chọn Team' : 'Select Team'}
            </label>
            <Select value={shareOrgId} onValueChange={setShareOrgId}>
              <SelectTrigger className="h-10 text-xs">
                <SelectValue placeholder={lang === 'vi' ? 'Chọn một team...' : 'Select a team...'} />
              </SelectTrigger>
              <SelectContent>
                {organizations.length > 0 ? (
                  organizations.map((org: any) => (
                    <SelectItem key={org.id} value={org.id} className="text-xs">
                      {org.name}
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    {lang === 'vi' ? 'Bạn chưa tham gia team nào' : 'You are not in any teams yet'}
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {lang === 'vi' ? 'Chọn Teamspace' : 'Select Teamspace'}
            </label>
            <Select
              value={shareTeamspaceId}
              onValueChange={setShareTeamspaceId}
              disabled={!shareOrgId}
            >
              <SelectTrigger className="h-10 text-xs">
                <SelectValue placeholder={lang === 'vi' ? 'Tuỳ chọn...' : 'Optional...'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TEAMSPACE_UNASSIGNED} className="text-xs">
                  {lang === 'vi' ? 'Không chọn teamspace' : 'Unassigned'}
                </SelectItem>
                {getTeamspaceItems(teamspaces)}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCreateTeam}
            className="mt-1 flex h-auto items-center gap-1.5 p-0 text-xs text-blue-500 hover:bg-blue-500/5 hover:text-blue-600"
          >
            <Plus className="h-3 w-3" />
            {lang === 'vi' ? 'Tạo team mới' : 'Create new team'}
          </Button>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            {lang === 'vi' ? 'Hủy' : 'Cancel'}
          </Button>
          <Button
            size="sm"
            onClick={handleShare}
            disabled={!shareOrgId || isSharing}
            className="min-w-[100px] bg-blue-600 text-white hover:bg-blue-700 text-xs"
          >
            {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : lang === 'vi' ? 'Chia sẻ ngay' : 'Share Now'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
