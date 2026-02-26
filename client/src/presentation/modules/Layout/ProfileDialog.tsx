import React, { useState, useEffect } from 'react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { useAppStore } from '@/core/services/store';
import { User, X, Settings, CreditCard, Bell, Palette, Shield, Zap, LogOut } from 'lucide-react';
import { toast } from 'sonner';

interface ProfileDialogProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: string;
}

export const ProfileDialog: React.FC<ProfileDialogProps> = ({ isOpen, onClose, initialTab }) => {
    const { user, updateUser } = useAppStore();
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');

    // Tab state
    const [activeTab, setActiveTab] = useState('profile');

    // Sync state when dialog opens or user changes
    useEffect(() => {
        if (isOpen) {
            setName(user?.name || '');
            setEmail(user?.email || '');
            setActiveTab(initialTab || 'profile'); // Use passed tab or default to profile
        }
    }, [isOpen, user, initialTab]);

    const handleSaveProfile = () => {
        updateUser({ name, email });
        toast.success("Profile updated successfully!");
    };

    const handleFeatureNotImplemented = (feature: string) => {
        toast.info(`${feature} is currently a UI mockup and not connected to a backend.`);
    };

    if (!isOpen) return null;

    const tabs = [
        { id: 'profile', label: 'Public Profile', icon: User },
        { id: 'appearance', label: 'Appearance', icon: Palette },
        { id: 'billing', label: 'Billing & Plan', icon: CreditCard },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'advanced', label: 'Advanced Settings', icon: Settings },
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-background border rounded-xl shadow-2xl w-full max-w-4xl h-[600px] flex relative animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 z-10 rounded-sm opacity-70 transition-opacity hover:opacity-100 hover:bg-muted p-1"
                >
                    <X className="h-5 w-5" />
                    <span className="sr-only">Close</span>
                </button>

                {/* Sidebar */}
                <div className="w-64 bg-muted/20 border-r flex flex-col">
                    <div className="p-6 pb-4">
                        <h2 className="text-xl font-bold tracking-tight">Account Settings</h2>
                        <p className="text-xs text-muted-foreground mt-1">Manage your profile and preferences.</p>
                    </div>
                    <div className="flex-1 px-3 space-y-1 overflow-y-auto">
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive
                                        ? 'bg-violet-500/15 text-violet-500 dark:text-violet-400'
                                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                                        }`}
                                >
                                    <Icon className={`w-4 h-4 ${isActive ? 'text-violet-500 dark:text-violet-400' : ''}`} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                    <div className="p-4 border-t border-border/50">
                        <Button variant="ghost" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={onClose}>
                            <LogOut className="w-4 h-4 mr-2" />
                            Sign Out
                        </Button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8 relative">

                    {/* Tab 1: Profile */}
                    {activeTab === 'profile' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div>
                                <h3 className="text-lg font-medium">Public Profile</h3>
                                <p className="text-sm text-muted-foreground">This is how others will see you on the site.</p>
                            </div>
                            <div className="w-full h-px bg-border/50" />
                            <div className="space-y-6 max-w-md">
                                <div className="space-y-3">
                                    <label className="text-sm font-medium">Avatar</label>
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-500 text-xl font-bold border border-violet-500/30">
                                            {name ? name.charAt(0).toUpperCase() : 'U'}
                                        </div>
                                        <div className="space-y-1">
                                            <Button variant="outline" size="sm">Change Avatar</Button>
                                            <p className="text-[10px] text-muted-foreground">JPG, GIF or PNG. 1MB max.</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Display Name</label>
                                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Email Address</label>
                                    <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="your.email@example.com" />
                                    <p className="text-[11px] text-muted-foreground">We will use this email for account-related notifications.</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Bio</label>
                                    <textarea
                                        className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        placeholder="Tell us a little bit about yourself"
                                    />
                                    <p className="text-[11px] text-muted-foreground">You can @mention other users and organizations to link to them.</p>
                                </div>
                                <Button onClick={handleSaveProfile} className="mt-2 bg-violet-600 hover:bg-violet-700 text-white">Save Profile Changes</Button>
                            </div>
                        </div>
                    )}

                    {/* Tab 2: Appearance */}
                    {activeTab === 'appearance' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div>
                                <h3 className="text-lg font-medium">Appearance</h3>
                                <p className="text-sm text-muted-foreground">Customize the look and feel of your workspace.</p>
                            </div>
                            <div className="w-full h-px bg-border/50" />
                            <div className="space-y-4">
                                <div className="space-y-3">
                                    <label className="text-sm font-medium">Theme Preference</label>
                                    <div className="grid grid-cols-3 gap-4 max-w-2xl">
                                        <div className="cursor-pointer group flex flex-col gap-2">
                                            <div className="border-2 border-transparent hover:border-violet-500 rounded-lg p-1 transition-all">
                                                <div className="w-full h-24 rounded bg-slate-100 flex p-2 gap-2 shadow-sm border">
                                                    <div className="w-1/3 h-full bg-white rounded-sm border"></div>
                                                    <div className="w-2/3 flex flex-col gap-2">
                                                        <div className="h-4 w-full bg-slate-200 rounded-sm"></div>
                                                        <div className="h-full w-full bg-white border rounded-sm"></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-xs font-medium text-center text-muted-foreground group-hover:text-foreground">Light</span>
                                        </div>
                                        <div className="cursor-pointer group flex flex-col gap-2">
                                            <div className="border-2 border-violet-500 rounded-lg p-1 transition-all bg-violet-500/5">
                                                <div className="w-full h-24 rounded bg-slate-900 flex p-2 gap-2 shadow-sm border border-slate-800">
                                                    <div className="w-1/3 h-full bg-slate-950 rounded-sm border border-slate-800"></div>
                                                    <div className="w-2/3 flex flex-col gap-2">
                                                        <div className="h-4 w-full bg-slate-800 rounded-sm"></div>
                                                        <div className="h-full w-full bg-slate-950 border border-slate-800 rounded-sm"></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-xs font-bold text-center text-violet-500">Dark (Active)</span>
                                        </div>
                                        <div className="cursor-pointer group flex flex-col gap-2">
                                            <div className="border-2 border-transparent hover:border-violet-500 rounded-lg p-1 transition-all">
                                                <div className="w-full h-24 rounded bg-gradient-to-br from-slate-200 to-slate-800 flex p-2 gap-2 shadow-sm border opacity-80">
                                                    <div className="w-1/3 h-full bg-slate-500/20 rounded-sm border border-slate-500/20"></div>
                                                    <div className="w-full h-full bg-slate-500/20 rounded-sm"></div>
                                                </div>
                                            </div>
                                            <span className="text-xs font-medium text-center text-muted-foreground group-hover:text-foreground">System Default</span>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">Select the theme for the dashboard.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 3: Billing */}
                    {activeTab === 'billing' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div>
                                <h3 className="text-lg font-medium">Billing & Plan</h3>
                                <p className="text-sm text-muted-foreground">Manage your subscription and billing details.</p>
                            </div>
                            <div className="w-full h-px bg-border/50" />

                            <div className="border border-violet-500/30 rounded-xl p-6 bg-violet-500/5 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Zap className="w-32 h-32" />
                                </div>
                                <div className="flex items-center gap-4 mb-4 relative z-10">
                                    <div className="p-3 bg-violet-500/20 rounded-xl text-violet-500 border border-violet-500/30">
                                        <Zap className="w-6 h-6 fill-violet-500/20" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-xl flex items-center gap-2">
                                            Data Explorer Pro
                                            <span className="bg-violet-500 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">Active</span>
                                        </h4>
                                        <p className="text-sm text-muted-foreground">Unlimited databases, AI queries, and collaboration.</p>
                                    </div>
                                    <div className="ml-auto flex items-end flex-col">
                                        <div className="flex items-end gap-1">
                                            <span className="text-3xl font-black tracking-tighter">$19</span>
                                            <span className="text-sm text-muted-foreground mb-1">/mo</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="relative z-10">
                                    <p className="text-xs font-medium text-muted-foreground mb-6">
                                        Your next billing date is <strong className="text-foreground">October 24, 2026</strong>.
                                    </p>
                                    <div className="flex gap-3">
                                        <Button className="bg-foreground text-background hover:bg-foreground/90 font-medium px-6">Upgrade to Team</Button>
                                        <Button variant="outline" className="border-border/50">Manage Subscription</Button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4">
                                <h4 className="font-medium text-sm">Payment Methods</h4>
                                <div className="border rounded-lg p-4 flex items-center justify-between bg-card">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-8 bg-white rounded flex items-center justify-center p-1 border">
                                            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/2560px-Visa_Inc._logo.svg.png" alt="Visa" className="h-full object-contain" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">Visa ending in 4242</p>
                                            <p className="text-xs text-muted-foreground">Expires 12/2028</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs bg-muted px-2 py-1 rounded font-medium">Default</span>
                                        <Button variant="ghost" size="sm" className="h-8">Edit</Button>
                                    </div>
                                </div>
                                <Button variant="outline" className="w-full border-dashed text-muted-foreground bg-transparent hover:bg-muted/50 h-10">
                                    <CreditCard className="w-4 h-4 mr-2" />
                                    Add New Payment Method
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Tab 4: Notifications */}
                    {activeTab === 'notifications' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div>
                                <h3 className="text-lg font-medium">Notifications</h3>
                                <p className="text-sm text-muted-foreground">Configure how you receive alerts and updates.</p>
                            </div>
                            <div className="w-full h-px bg-border/50" />
                            <div className="space-y-4 border rounded-xl overflow-hidden divide-y bg-card">
                                <div className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                    <div>
                                        <p className="font-medium text-sm">Email Alerts</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Receive weekly reports on your queries and data usage.</p>
                                    </div>
                                    <div className="w-11 h-6 bg-violet-500 rounded-full relative cursor-pointer border-2 border-transparent transition-colors">
                                        <div className="absolute right-0 top-0 w-5 h-5 bg-white rounded-full transition-transform shadow-sm"></div>
                                    </div>
                                </div>
                                <div className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                    <div>
                                        <p className="font-medium text-sm">Failed Queries</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Get notified immediately if a long-running background query fails.</p>
                                    </div>
                                    <div className="w-11 h-6 bg-violet-500 rounded-full relative cursor-pointer border-2 border-transparent transition-colors">
                                        <div className="absolute right-0 top-0 w-5 h-5 bg-white rounded-full transition-transform shadow-sm"></div>
                                    </div>
                                </div>
                                <div className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                    <div>
                                        <p className="font-medium text-sm">Product Updates</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">News about the latest AI features and platform updates.</p>
                                    </div>
                                    <div className="w-11 h-6 bg-muted-foreground/30 rounded-full relative cursor-pointer border-2 border-transparent transition-colors">
                                        <div className="absolute left-0 top-0 w-5 h-5 bg-white rounded-full transition-transform shadow-sm"></div>
                                    </div>
                                </div>
                                <div className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                    <div>
                                        <p className="font-medium text-sm">Security Alerts</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Get notified about new sign-ins and security events.</p>
                                    </div>
                                    <div className="w-11 h-6 bg-violet-500 rounded-full relative cursor-pointer border-2 border-transparent transition-colors opacity-60 cursor-not-allowed" title="Mandatory for security">
                                        <div className="absolute right-0 top-0 w-5 h-5 bg-white rounded-full transition-transform shadow-sm"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 5: Security */}
                    {activeTab === 'security' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div>
                                <h3 className="text-lg font-medium">Security</h3>
                                <p className="text-sm text-muted-foreground">Manage your password and security settings to protect your account.</p>
                            </div>
                            <div className="w-full h-px bg-border/50" />
                            <div className="space-y-6 max-w-md">
                                <h4 className="font-medium text-sm">Change Password</h4>
                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">Current Password</label>
                                        <Input type="password" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">New Password</label>
                                        <Input type="password" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">Confirm New Password</label>
                                        <Input type="password" />
                                    </div>
                                    <Button className="mt-2" onClick={() => handleFeatureNotImplemented('Password Update')}>Update Password</Button>
                                </div>
                            </div>

                            <div className="mt-8 border-t pt-8">
                                <h4 className="font-medium text-sm mb-1">Two-Factor Authentication (2FA)</h4>
                                <p className="text-sm text-muted-foreground mb-4">Add an extra layer of security to your account by requiring both a password and an authentication code.</p>
                                <div className="border rounded-lg p-4 bg-muted/20 flex items-center justify-between">
                                    <div className="flex gap-3 items-center">
                                        <div className="p-2 bg-background rounded-full border shadow-sm">
                                            <Shield className="w-5 h-5 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">Status: <span className="text-muted-foreground">Disabled</span></p>
                                        </div>
                                    </div>
                                    <Button variant="outline" onClick={() => handleFeatureNotImplemented('2FA Configuration')}>Enable 2FA</Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 6: Advanced */}
                    {activeTab === 'advanced' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div>
                                <h3 className="text-lg font-medium text-red-500">Danger Zone</h3>
                                <p className="text-sm text-muted-foreground">Irreversible and destructive actions. Proceed with caution.</p>
                            </div>
                            <div className="w-full h-px bg-border/50" />
                            <div className="border border-red-500/30 rounded-xl p-1 bg-red-500/5">
                                <div className="p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-sm text-foreground">Clear Local Workspace</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">Delete all local connections, tabs, and query history from this browser.</p>
                                        </div>
                                        <Button variant="outline" size="sm" className="hover:bg-red-500/10 hover:text-red-600 hover:border-red-200" onClick={() => { localStorage.clear(); window.location.reload(); }}>Clear Data</Button>
                                    </div>
                                    <div className="h-px bg-red-500/20 w-full"></div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-sm text-red-600 dark:text-red-500">Delete Account</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">Permanently remove your account and all associated data from our servers.</p>
                                        </div>
                                        <Button variant="destructive" size="sm" onClick={() => handleFeatureNotImplemented('Account Deletion')}>Delete Account</Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};
