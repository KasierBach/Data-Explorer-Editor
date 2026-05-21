import { useCallback, useEffect, useState } from 'react';
import { adminService, type AdminUser } from '@/core/services/AdminService';
import { useAppStore } from '@/core/services/store';
import { Ban, KeyRound, Shield, ShieldAlert, Trash2, User as UserIcon, UserCheck } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Badge } from '@/presentation/components/ui/badge';
import { useResponsiveLayoutMode } from '@/presentation/hooks/useResponsiveLayoutMode';
import { toast } from 'sonner';

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unexpected error';
}

export function UsersView() {
    const { lang } = useAppStore();
    const { isCompactMobileLayout, isSmallMobile } = useResponsiveLayoutMode();
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const data = await adminService.getUsers();
            setUsers(data);
        } catch (error) {
            toast.error(lang === 'vi' ? 'Không thể tải danh sách người dùng' : 'Failed to load users');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [lang]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const toggleRole = async (user: AdminUser) => {
        const newRole = user.role === 'admin' ? 'user' : 'admin';
        try {
            await adminService.updateRole(user.id, newRole);
            toast.success(lang === 'vi' ? `Đã cập nhật vai trò thành ${newRole}` : `Role updated to ${newRole}`);
            fetchUsers();
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const resetPassword = async (user: AdminUser) => {
        const newPassword = prompt(
            lang === 'vi'
                ? 'Nhập mật khẩu mới (ít nhất 6 ký tự):'
                : 'Enter new password (min 6 characters):'
        );
        if (!newPassword) return;
        if (newPassword.length < 6) {
            toast.error(lang === 'vi' ? 'Mật khẩu phải dài ít nhất 6 ký tự' : 'Password must be at least 6 characters');
            return;
        }

        try {
            await adminService.resetPassword(user.id, newPassword);
            toast.success(lang === 'vi' ? 'Đã đặt lại mật khẩu thành công' : 'Password reset successfully');
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const deleteUser = async (user: AdminUser) => {
        const confirmed = window.confirm(
            lang === 'vi'
                ? `Bạn có chắc chắn muốn xóa người dùng ${user.email}?`
                : `Are you sure you want to delete user ${user.email}?`
        );
        if (!confirmed) return;

        try {
            await adminService.deleteUser(user.id);
            toast.success(lang === 'vi' ? 'Đã xóa người dùng thành công' : 'User deleted successfully');
            fetchUsers();
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const toggleBan = async (user: AdminUser) => {
        try {
            const res = await adminService.toggleBan(user.id);
            toast.success(res.message);
            fetchUsers();
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    if (loading) {
        return <div className="flex justify-center p-8 text-muted-foreground">{lang === 'vi' ? 'Đang tải...' : 'Loading...'}</div>;
    }

    const ActionButtons = ({ user }: { user: AdminUser }) => (
        <div className="flex flex-wrap gap-2">
            <Button
                variant="outline"
                size="sm"
                onClick={() => toggleRole(user)}
                title={user.role === 'admin' ? (lang === 'vi' ? 'Hạ quyền về user' : 'Demote to User') : (lang === 'vi' ? 'Nâng quyền lên admin' : 'Promote to Admin')}
                className="gap-2"
            >
                <Shield className="h-3.5 w-3.5" />
                {isSmallMobile && <span>{user.role === 'admin' ? (lang === 'vi' ? 'Hạ quyền' : 'Demote') : (lang === 'vi' ? 'Nâng quyền' : 'Promote')}</span>}
            </Button>

            <Button
                variant="outline"
                size="sm"
                onClick={() => toggleBan(user)}
                className={`gap-2 ${user.isBanned ? 'text-green-500 hover:text-green-600' : 'text-orange-500 hover:text-orange-600'}`}
                title={user.isBanned ? (lang === 'vi' ? 'Mở khóa người dùng' : 'Unban User') : (lang === 'vi' ? 'Khóa người dùng' : 'Ban User')}
                disabled={user.role === 'admin'}
            >
                {user.isBanned ? <UserCheck className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                {isSmallMobile && <span>{user.isBanned ? (lang === 'vi' ? 'Mở khóa' : 'Unban') : (lang === 'vi' ? 'Khóa' : 'Ban')}</span>}
            </Button>

            <Button
                variant="secondary"
                size="sm"
                onClick={() => resetPassword(user)}
                title={lang === 'vi' ? 'Đặt lại mật khẩu' : 'Reset Password'}
                className="gap-2"
            >
                <KeyRound className="h-3.5 w-3.5" />
                {isSmallMobile && <span>{lang === 'vi' ? 'Đặt lại' : 'Reset'}</span>}
            </Button>

            <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteUser(user)}
                title={lang === 'vi' ? 'Xóa người dùng' : 'Delete User'}
                disabled={user.role === 'admin'}
                className="gap-2"
            >
                <Trash2 className="h-3.5 w-3.5" />
                {isSmallMobile && <span>{lang === 'vi' ? 'Xóa' : 'Delete'}</span>}
            </Button>
        </div>
    );

    return (
        <div className="rounded-md border bg-card shadow-sm">
            {isCompactMobileLayout ? (
                <div className="divide-y">
                    {users.map((user) => (
                        <div key={user.id} className="space-y-4 px-4 py-4">
                            <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <UserIcon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="break-words font-medium">
                                            {[user.firstName, user.lastName].filter(Boolean).join(' ') || (lang === 'vi' ? 'Chưa đặt tên' : 'No name')}
                                        </div>
                                        {user.isBanned && (
                                            <span className="text-[10px] font-bold uppercase tracking-tight text-red-500">{lang === 'vi' ? 'BỊ KHÓA' : 'Banned'}</span>
                                        )}
                                    </div>
                                    <div className="break-all text-sm text-muted-foreground">{user.email}</div>
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{lang === 'vi' ? 'Vai trò' : 'Role'}</div>
                                    <div className="mt-1">
                                        {user.role === 'admin' ? (
                                            <Badge variant="default" className="w-fit bg-indigo-500 hover:bg-indigo-600">
                                                <ShieldAlert className="mr-1 h-3 w-3" /> {lang === 'vi' ? 'Quản trị' : 'Admin'}
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="w-fit">{lang === 'vi' ? 'Người dùng' : 'User'}</Badge>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{lang === 'vi' ? 'Ngày tham gia' : 'Joined'}</div>
                                    <div className="mt-1 text-sm text-muted-foreground">
                                        {new Date(user.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>

                            <ActionButtons user={user} />
                        </div>
                    ))}
                    {users.length === 0 && (
                        <div className="p-8 text-center text-sm text-muted-foreground">{lang === 'vi' ? 'Không có người dùng nào.' : 'No users found.'}</div>
                    )}
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                            <tr>
                                <th className="px-6 py-3">{lang === 'vi' ? 'Tên' : 'Name'}</th>
                                <th className="px-6 py-3">Email</th>
                                <th className="px-6 py-3">{lang === 'vi' ? 'Vai trò' : 'Role'}</th>
                                <th className="px-6 py-3">{lang === 'vi' ? 'Ngày tham gia' : 'Joined Date'}</th>
                                <th className="px-6 py-3 text-right">{lang === 'vi' ? 'Hành động' : 'Actions'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user.id} className="border-b last:border-0 hover:bg-muted/20">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                                                <UserIcon className="h-4 w-4" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium">
                                                    {[user.firstName, user.lastName].filter(Boolean).join(' ') || (lang === 'vi' ? 'Chưa đặt tên' : 'No name')}
                                                </span>
                                                {user.isBanned && (
                                                    <span className="text-[10px] font-bold uppercase tracking-tighter text-red-500">{lang === 'vi' ? 'BỊ KHÓA' : 'BANNED'}</span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">{user.email}</td>
                                    <td className="px-6 py-4">
                                        {user.role === 'admin' ? (
                                            <Badge variant="default" className="w-fit bg-indigo-500 hover:bg-indigo-600">
                                                <ShieldAlert className="mr-1 h-3 w-3" /> {lang === 'vi' ? 'Quản trị' : 'Admin'}
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="w-fit">{lang === 'vi' ? 'Người dùng' : 'User'}</Badge>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-xs text-muted-foreground">
                                        {new Date(user.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => toggleRole(user)}
                                                title={user.role === 'admin' ? (lang === 'vi' ? 'Hạ quyền về user' : 'Demote to User') : (lang === 'vi' ? 'Nâng quyền lên admin' : 'Promote to Admin')}
                                            >
                                                <Shield className="h-3.5 w-3.5" />
                                            </Button>

                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => toggleBan(user)}
                                                className={user.isBanned ? 'text-green-500 hover:text-green-600' : 'text-orange-500 hover:text-orange-600'}
                                                title={user.isBanned ? (lang === 'vi' ? 'Mở khóa người dùng' : 'Unban User') : (lang === 'vi' ? 'Khóa người dùng' : 'Ban User')}
                                                disabled={user.role === 'admin'}
                                            >
                                                {user.isBanned ? <UserCheck className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                                            </Button>

                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => resetPassword(user)}
                                                title={lang === 'vi' ? 'Đặt lại mật khẩu' : 'Reset Password'}
                                            >
                                                <KeyRound className="h-3.5 w-3.5" />
                                            </Button>

                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => deleteUser(user)}
                                                title={lang === 'vi' ? 'Xóa người dùng' : 'Delete User'}
                                                disabled={user.role === 'admin'}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
