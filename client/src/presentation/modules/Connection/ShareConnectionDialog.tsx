import React, { useState } from 'react';
import { useAppStore } from '@/core/services/store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/presentation/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/select';
import { Button } from '@/presentation/components/ui/button';
import { Users, Loader2, Plus } from 'lucide-react';
import { ConnectionService } from '@/core/services/ConnectionService';
import { OrganizationService } from '@/core/services/OrganizationService';
import { useQuery } from '@tanstack/react-query';

interface ShareConnectionDialogProps {
    connectionId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export const ShareConnectionDialog: React.FC<ShareConnectionDialogProps> = ({
    connectionId,
    open,
    onOpenChange,
    onSuccess
}) => {
    const { lang, updateConnection } = useAppStore();
    const [shareOrgId, setShareOrgId] = useState<string>('');
    const [isSharing, setIsSharing] = useState(false);

    const { data: organizations = [], refetch: refetchOrgs } = useQuery({
        queryKey: ['organizations'],
        queryFn: () => OrganizationService.getMyOrganizations(),
        enabled: open,
    });

    const handleShare = async () => {
        if (!connectionId || !shareOrgId) return;
        setIsSharing(true);
        try {
            await ConnectionService.updateConnection(connectionId, { organizationId: shareOrgId });
            
            // Update local store state if needed
            updateConnection(connectionId, { organizationId: shareOrgId } as any);
            
            onOpenChange(false);
            if (onSuccess) onSuccess();
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
            refetchOrgs();
        } catch (error: any) {
            console.error('Error creating team:', error);
            alert(error.message || (lang === 'vi' ? 'Lỗi khi tạo team' : 'Error creating team'));
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md rounded-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-500" />
                        {lang === 'vi' ? 'Chia sẻ kết nối với Team' : 'Share Connection with Team'}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <p className="text-sm text-muted-foreground">
                        {lang === 'vi' 
                            ? 'Chọn một team để chia sẻ kết nối này. Tất cả thành viên trong team sẽ có quyền truy cập.'
                            : 'Select a team to share this connection. All team members will have access.'}
                    </p>
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
                                    <div className="p-4 text-center text-muted-foreground text-xs">
                                        {lang === 'vi' ? 'Bạn chưa tham gia team nào' : 'You are not in any teams yet'}
                                    </div>
                                )}
                            </SelectContent>
                        </Select>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={handleCreateTeam} 
                            className="text-blue-500 hover:text-blue-600 hover:bg-blue-500/5 p-0 h-auto text-xs flex items-center gap-1.5 mt-1"
                        >
                            <Plus className="w-3 h-3" />
                            {lang === 'vi' ? 'Tạo team mới' : 'Create new team'}
                        </Button>
                    </div>
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
                        {lang === 'vi' ? 'Hủy' : 'Cancel'}
                    </Button>
                    <Button 
                        size="sm"
                        onClick={handleShare} 
                        disabled={!shareOrgId || isSharing}
                        className="bg-blue-600 hover:bg-blue-700 text-white min-w-[100px] text-xs"
                    >
                        {isSharing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            lang === 'vi' ? 'Chia sẻ ngay' : 'Share Now'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
