import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/presentation/components/ui/select";
import { useAppStore } from '@/core/services/store';
import { API_BASE_URL } from '@/core/config/env';
import { Loader2, Rocket, Briefcase, UserCircle, MapPin, Phone } from 'lucide-react';
import { toast } from 'sonner';

export const OnboardingPage = () => {
    const navigate = useNavigate();
    const { user, accessToken, login } = useAppStore();
    const [isLoading, setIsLoading] = useState(false);

    // Initial state based on Google/GitHub data if available
    const [formData, setFormData] = useState({
        username: user?.email?.split('@')[0] || `user_${Math.floor(Math.random() * 10000)}`,
        jobRole: '',
        phoneNumber: '',
        address: ''
    });

    // If somehow they get here without a token or are already onboarded, redirect
    if (!accessToken || !user) {
        navigate('/login');
        return null;
    }

    if (user.isOnboarded) {
        navigate('/app');
        return null;
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleRoleChange = (val: string) => {
        setFormData({ ...formData, jobRole: val });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.jobRole) {
            toast.error('Please select your primary role');
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/users/profile/onboarding`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify(formData)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to save profile');
            }

            const updatedUser = await res.json();
            
            // Update Zustand store with the new user object (which now has isOnboarded: true)
            login(accessToken, updatedUser);
            
            toast.success('Welcome to Data Explorer! 🚀');
            navigate('/app');

        } catch (err: any) {
            toast.error(err.message || 'Something went wrong');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
            <div className="w-full max-w-lg bg-background border rounded-2xl shadow-lg p-8 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col items-center mb-8 space-y-3 text-center">
                    <div className="bg-primary/10 p-4 rounded-2xl mb-2 flex items-center justify-center">
                        <Rocket className="w-10 h-10 text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">Almost there!</h1>
                    <p className="text-muted-foreground w-4/5 mx-auto">
                        Hi {user.firstName || 'there'}! Let's personalize your workspace to get the best AI SQL suggestions.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        {/* Username */}
                        <div className="space-y-2">
                            <Label htmlFor="username" className="flex items-center gap-2">
                                <UserCircle className="w-4 h-4 text-muted-foreground" />
                                Username <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="username"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                placeholder="e.g. jondoe99"
                                required
                                className="bg-muted/50"
                            />
                            <p className="text-[11px] text-muted-foreground">This must be unique across the platform.</p>
                        </div>

                        {/* Job Role */}
                        <div className="space-y-2">
                            <Label htmlFor="role" className="flex items-center gap-2">
                                <Briefcase className="w-4 h-4 text-muted-foreground" />
                                Primary Role <span className="text-red-500">*</span>
                            </Label>
                            <Select value={formData.jobRole} onValueChange={handleRoleChange}>
                                <SelectTrigger className="bg-muted/50">
                                    <SelectValue placeholder="Select your profession" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Backend Developer">Backend Developer</SelectItem>
                                    <SelectItem value="Data Engineer">Data Engineer</SelectItem>
                                    <SelectItem value="Data Analyst">Data Analyst</SelectItem>
                                    <SelectItem value="Fullstack Developer">Fullstack Developer</SelectItem>
                                    <SelectItem value="Student / Learner">Student / Learner</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-[11px] text-muted-foreground">Our AI Assistant uses this to tailor SQL explanations.</p>
                        </div>

                        {/* Optional Group */}
                        <div className="pt-4 border-t border-dashed mt-6 space-y-4">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Optional Information</h3>
                            
                            <div className="space-y-2">
                                <Label htmlFor="phone" className="flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-muted-foreground" />
                                    Phone Number
                                </Label>
                                <Input
                                    id="phone"
                                    name="phoneNumber"
                                    type="tel"
                                    value={formData.phoneNumber}
                                    onChange={handleChange}
                                    placeholder="+1 (555) 000-0000"
                                    className="bg-muted/50"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="address" className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-muted-foreground" />
                                    Company / Address
                                </Label>
                                <Input
                                    id="address"
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    placeholder="Company name or location"
                                    className="bg-muted/50"
                                />
                            </div>
                        </div>
                    </div>

                    <Button type="submit" size="lg" className="w-full mt-8 font-semibold" disabled={isLoading}>
                        {isLoading ? (
                            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving Profile...</>
                        ) : (
                            "Start Exploring 🚀"
                        )}
                    </Button>
                </form>
            </div>
        </div>
    );
};
