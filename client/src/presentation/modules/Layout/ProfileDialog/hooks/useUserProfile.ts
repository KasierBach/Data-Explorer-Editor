import { useState, useEffect } from 'react';
import { useAppStore } from '@/core/services/store';
import { apiService } from '@/core/services/api.service';
import { toast } from 'sonner';

export const useUserProfile = (isOpen: boolean) => {
    const { user, updateUser, lang } = useAppStore();
    const [isLoading, setIsLoading] = useState(false);

    // Profile State
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [jobRole, setJobRole] = useState('');
    const [bio, setBio] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [address, setAddress] = useState('');

    useEffect(() => {
        if (isOpen && user) {
            setFirstName(user.firstName || '');
            setLastName(user.lastName || '');
            setEmail(user.email || '');
            setUsername(user.username || '');
            setJobRole(user.jobRole || '');
            setBio(user.bio || '');
            setPhoneNumber(user.phoneNumber || '');
            setAddress(user.address || '');
        }
    }, [isOpen, user]);

    const handleSaveProfile = async () => {
        setIsLoading(true);
        try {
            const data = await apiService.patch<any>('/users/profile', {
                firstName, lastName, email, username, jobRole, bio, phoneNumber, address
            });
            updateUser(data);
            toast.success(lang === 'vi' ? "Cập nhật hồ sơ thành công!" : "Profile updated successfully!");
            return true;
        } catch (err: any) {
            toast.error(err.message);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const handleUploadAvatar = async (base64String: string) => {
        setIsLoading(true);
        try {
            const data = await apiService.patch<any>('/users/profile', { avatarUrl: base64String });
            updateUser(data);
            toast.success(lang === 'vi' ? "Cập nhật ảnh đại diện thành công!" : "Avatar updated successfully!");
            return true;
        } catch (err: any) {
            toast.error(err.message);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        isLoading,
        state: {
            firstName, setFirstName,
            lastName, setLastName,
            email, setEmail,
            username, setUsername,
            jobRole, setJobRole,
            bio, setBio,
            phoneNumber, setPhoneNumber,
            address, setAddress
        },
        handleSaveProfile,
        handleUploadAvatar
    };
};
