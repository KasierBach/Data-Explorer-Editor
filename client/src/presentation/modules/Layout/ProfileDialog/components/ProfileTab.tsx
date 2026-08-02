import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Loader2, Pencil } from 'lucide-react';
import type { AuthUser } from '@/core/services/store/slices/authSlice';
import { AvatarEditor } from './AvatarEditor';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ACCEPTED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

interface ProfileTabProps {
    user: AuthUser | null;
    t: (key: string) => string;
    profileState: {
        firstName: string; setFirstName: (v: string) => void;
        lastName: string; setLastName: (v: string) => void;
        email: string; setEmail: (v: string) => void;
        username: string; setUsername: (v: string) => void;
        jobRole: string; setJobRole: (v: string) => void;
        bio: string; setBio: (v: string) => void;
        phoneNumber: string; setPhoneNumber: (v: string) => void;
        address: string; setAddress: (v: string) => void;
    };
    isLoading: boolean;
    actions: {
        handleSaveProfile: () => void;
        handleUploadAvatar: (base64: string) => Promise<boolean>;
    };
}

export const ProfileTab: React.FC<ProfileTabProps> = ({ 
    user, t, profileState, isLoading, actions 
}) => {
    const avatarInputRef = useRef<HTMLInputElement | null>(null);
    const [avatarSource, setAvatarSource] = useState<string | null>(null);
    const [avatarError, setAvatarError] = useState('');
    const { 
        firstName, setFirstName, lastName, setLastName, 
        email, setEmail, username, setUsername, 
        jobRole, setJobRole, bio, setBio, 
        phoneNumber, setPhoneNumber, address, setAddress 
    } = profileState;

    useEffect(() => () => {
        if (avatarSource?.startsWith('blob:')) URL.revokeObjectURL(avatarSource);
    }, [avatarSource]);

    const handleAvatarSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        setAvatarError('');
        if (!file) return;
        if (!ACCEPTED_AVATAR_TYPES.has(file.type)) {
            setAvatarError(t('avatar_invalid_type'));
            return;
        }
        if (file.size > MAX_AVATAR_BYTES) {
            setAvatarError(t('avatar_too_large'));
            return;
        }
        setAvatarSource(URL.createObjectURL(file));
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
                <h3 className="text-lg font-medium">{t('tabs.profile')}</h3>
                <p className="text-sm text-muted-foreground">{t('profile_subtitle')}</p>
            </div>
            <div className="w-full h-px bg-border/50" />
            <div className="space-y-6 max-w-md">
                <div className="space-y-3">
                    <label className="text-sm font-medium">{t('avatar_label')}</label>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-violet-500/10 flex items-center justify-center overflow-hidden border border-violet-500/30 relative">
                            {user?.avatarUrl ? (
                                <>
                                    <img 
                                        src={user.avatarUrl} 
                                        alt={t('avatar_preview_alt')}
                                        className="h-full w-full object-cover relative z-10" 
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).classList.add('hidden');
                                        }}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center text-violet-500 text-xl font-bold z-0">
                                        {(firstName || user?.name || email || 'U').charAt(0).toUpperCase()}
                                    </div>
                                </>
                            ) : (
                                <span className="text-violet-500 text-xl font-bold">
                                    {(firstName || user?.name || email || 'U').charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <input
                                type="file"
                                ref={avatarInputRef}
                                id="avatar-upload"
                                className="hidden"
                                accept="image/jpeg,image/png,image/gif,image/webp"
                                onChange={handleAvatarSelection}
                            />
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => avatarInputRef.current?.click()}
                                    disabled={isLoading}
                                >
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('change_avatar')}
                                </Button>
                                {user?.avatarUrl?.startsWith('data:') && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setAvatarSource(user.avatarUrl!)}
                                        disabled={isLoading}
                                    >
                                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                        {t('edit_current_avatar')}
                                    </Button>
                                )}
                            </div>
                            <p className="text-[10px] text-muted-foreground">{t('avatar_hint')}</p>
                            {avatarError && <p role="alert" className="text-[11px] text-red-400">{avatarError}</p>}
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t('first_name_label')}</label>
                        <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder={t('labels.firstNamePlaceholder')} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t('last_name_label')}</label>
                        <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder={t('labels.lastNamePlaceholder')} />
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t('username_label')}</label>
                        <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="johndoe" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t('job_role_label')}</label>
                        <Input value={jobRole} onChange={e => setJobRole(e.target.value)} placeholder={t('labels.jobRolePlaceholder')} />
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                        <label className="text-sm font-medium">{t('phone_number_label')}</label>
                        <Input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+84 123 456 789" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t('address_label')}</label>
                        <Input value={address} onChange={e => setAddress(e.target.value)} placeholder={t('labels.addressPlaceholder')} />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">{t('email_label')}</label>
                    <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="your.email@example.com" />
                    <p className="text-[11px] text-muted-foreground">{t('email_hint')}</p>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">{t('bio_label')}</label>
                    <textarea
                        value={bio}
                        onChange={e => setBio(e.target.value)}
                        className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        placeholder={t('labels.bioPlaceholder')}
                    />
                    <p className="text-[11px] text-muted-foreground">{t('bio_hint')}</p>
                </div>
                <Button onClick={actions.handleSaveProfile} disabled={isLoading} className="mt-2 bg-violet-600 hover:bg-violet-700 text-white min-w-[120px]">
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('save_changes')}
                </Button>
            </div>
            {avatarSource && (
                <AvatarEditor
                    source={avatarSource}
                    isSaving={isLoading}
                    t={t}
                    onClose={() => setAvatarSource(null)}
                    onApply={actions.handleUploadAvatar}
                />
            )}
        </div>
    );
};
