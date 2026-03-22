import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Database, Loader2, Mail, KeyRound, ArrowLeft } from 'lucide-react';
import { useAppStore } from '@/core/services/store';
import { toast } from 'sonner';
import { AuthService } from '@/core/services/AuthService';

export const ForgotPasswordPage = () => {
    const navigate = useNavigate();
    const { lang } = useAppStore();
    
    const [step, setStep] = useState<1 | 2>(1);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            await AuthService.forgotPassword(email);
            toast.success(lang === 'vi' ? 'Đã gửi mã OTP đến email của bạn!' : 'OTP sent to your email!');
            setStep(2);
        } catch (err: any) {
            setError(err.message || 'Error sending OTP');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            await AuthService.resetPassword({ email, otp, newPassword });
            toast.success(lang === 'vi' ? 'Đổi mật khẩu thành công!' : 'Password reset successfully!');
            navigate('/login');
        } catch (err: any) {
            setError(err.message || 'Invalid OTP');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
            <div className="w-full max-w-sm bg-background border rounded-lg shadow-sm p-8 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex flex-col items-center mb-8 space-y-2">
                    <div className="bg-primary/10 p-3 rounded-xl mb-2">
                        <Database className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight text-center">
                        {step === 1 
                            ? (lang === 'vi' ? 'Quên mật khẩu' : 'Forgot Password')
                            : (lang === 'vi' ? 'Đặt lại mật khẩu' : 'Reset Password')}
                    </h1>
                    <p className="text-sm text-muted-foreground text-center">
                        {step === 1 
                            ? (lang === 'vi' ? 'Nhập email của bạn để nhận mã xác thực' : 'Enter your email to receive an OTP')
                            : (lang === 'vi' ? 'Nhập mã OTP (6 số) được gửi đến email của bạn' : 'Enter the 6-digit OTP sent to your email')}
                    </p>
                </div>

                {step === 1 ? (
                    <form onSubmit={handleSendOtp} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium" htmlFor="email">Email</label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        {error && (
                            <div className="text-sm text-red-500 font-medium text-center bg-red-500/10 p-2 rounded">
                                {error}
                            </div>
                        )}

                        <Button className="w-full gap-2" type="submit" disabled={isLoading}>
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                            {lang === 'vi' ? 'Gửi mã OTP' : 'Send OTP'}
                        </Button>
                    </form>
                ) : (
                    <form onSubmit={handleResetPassword} className="space-y-4">
                         <div className="space-y-2">
                            <label className="text-sm font-medium" htmlFor="otp">Mã OTP / OTP Code</label>
                            <Input
                                id="otp"
                                type="text"
                                placeholder="123456"
                                maxLength={6}
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                required
                                className="text-center tracking-widest text-lg font-mono"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium" htmlFor="newPassword">Mật khẩu mới / New Password</label>
                            <Input
                                id="newPassword"
                                type="password"
                                placeholder="••••••••"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                minLength={6}
                                required
                            />
                        </div>

                        {error && (
                            <div className="text-sm text-red-500 font-medium text-center bg-red-500/10 p-2 rounded">
                                {error}
                            </div>
                        )}

                        <Button className="w-full gap-2" type="submit" disabled={isLoading}>
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                            {lang === 'vi' ? 'Đặt lại mật khẩu' : 'Reset Password'}
                        </Button>
                    </form>
                )}

                <div className="mt-6 text-center text-sm">
                    <button 
                        type="button" 
                        onClick={() => navigate('/login')} 
                        className="text-muted-foreground hover:text-foreground flex items-center justify-center mx-auto gap-2 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {lang === 'vi' ? 'Quay lại đăng nhập' : 'Back to login'}
                    </button>
                </div>
            </div>
        </div>
    );
};
