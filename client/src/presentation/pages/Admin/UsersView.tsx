import { useState, useEffect } from 'react';
import { adminService } from '@/core/services/AdminService';
import { useAppStore } from '@/core/services/store';
import { Shield, ShieldAlert, KeyRound, User as UserIcon, Trash2, Ban, UserCheck } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Badge } from '@/presentation/components/ui/badge';
import { toast } from 'sonner';

export function UsersView() {
    const { lang } = useAppStore();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const data = await adminService.getUsers();
            setUsers(data);
        } catch (error: any) {
            toast.error(lang === 'vi' ? 'Không thể tải danh sách người dùng' : 'Failed to load users');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const toggleRole = async (user: any) => {
        const newRole = user.role === 'admin' ? 'user' : 'admin';
        try {
            await adminService.updateRole(user.id, newRole);
            toast.success(lang === 'vi' ? `Đã cập nhật vai trò thành ${newRole}` : `Role updated to ${newRole}`);
            fetchUsers();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const resetPassword = async (user: any) => {
        const newPassword = prompt(lang === 'vi' ? 'Nhập mật khẩu mới (ít nhất 6 ký tự):' : 'Enter new password (min 6 characters):');
        if (!newPassword) return;
        if (newPassword.length < 6) {
            toast.error(lang === 'vi' ? 'Mật khẩu phải dài ít nhất 6 ký tự' : 'Password must be at least 6 characters');
            return;
        }

        try {
            await adminService.resetPassword(user.id, newPassword);
            toast.success(lang === 'vi' ? 'Đã đặt lại mật khẩu thành công' : 'Password reset successfully');
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const deleteUser = async (user: any) => {
        const confirm = window.confirm(lang === 'vi' ? `Bạn có chắc chắn muốn xóa người dùng ${user.email}?` : `Are you sure you want to delete user ${user.email}?`);
        if (!confirm) return;

        try {
            await adminService.deleteUser(user.id);
            toast.success(lang === 'vi' ? 'Đã xóa người dùng thành công' : 'User deleted successfully');
            fetchUsers();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const toggleBan = async (user: any) => {
        try {
            const res = await adminService.toggleBan(user.id);
            toast.success(res.message);
            fetchUsers();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    if (loading) {
        return <div className="flex justify-center p-8 text-muted-foreground">Loading...</div>;
    }

    return (
        <div className="bg-card rounded-md border shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
                        <tr>
                            <th className="px-6 py-3">{lang === 'vi' ? 'Tên' : 'Name'}</th>
                            <th className="px-6 py-3">Email</th>
                            <th className="px-6 py-3">{lang === 'vi' ? 'Vai trò' : 'Role'}</th>
                            <th className="px-6 py-3">{lang === 'vi' ? 'Ngày tham gia' : 'Joined Date'}</th>
                            <th className="px-6 py-3 text-right">{lang === 'vi' ? 'Hành động' : 'Actions'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id} className="border-b last:border-0 hover:bg-muted/20">
                                <td className="px-6 py-4 font-medium flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        <UserIcon className="h-4 w-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span>{[user.firstName, user.lastName].filter(Boolean).join(' ') || (lang === 'vi' ? 'Chưa đặt tên' : 'No name')}</span>
                                        {user.isBanned && (
                                            <span className="text-[10px] text-red-500 font-bold uppercase tracking-tighter">BANNED</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">{user.email}</td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1">
                                        {user.role === 'admin' ? (
                                            <Badge variant="default" className="bg-indigo-500 hover:bg-indigo-600 w-fit">
                                                <ShieldAlert className="h-3 w-3 mr-1" /> Admin
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="w-fit">User</Badge>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-muted-foreground text-xs">
                                    {new Date(user.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => toggleRole(user)}
                                            title={user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                                        >
                                            <Shield className="h-3.5 w-3.5" />
                                        </Button>
                                        
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => toggleBan(user)}
                                            className={user.isBanned ? 'text-green-500 hover:text-green-600' : 'text-orange-500 hover:text-orange-600'}
                                            title={user.isBanned ? 'Unban User' : 'Ban User'}
                                            disabled={user.role === 'admin'}
                                        >
                                            {user.isBanned ? <UserCheck className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                                        </Button>

                                        <Button 
                                            variant="secondary" 
                                            size="sm" 
                                            onClick={() => resetPassword(user)}
                                            title="Reset Password"
                                        >
                                            <KeyRound className="h-3.5 w-3.5" />
                                        </Button>

                                        <Button 
                                            variant="destructive" 
                                            size="sm" 
                                            onClick={() => deleteUser(user)}
                                            title="Delete User"
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
        </div>
    );
}
