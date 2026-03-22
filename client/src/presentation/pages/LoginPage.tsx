import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { useAppStore } from '@/core/services/store';
import { Database, Loader2, UserPlus, LogIn, Github, MailCheck, ArrowLeft } from 'lucide-react';
import { API_BASE_URL } from '@/core/config/env';
import { toast } from 'sonner';
import { AuthService } from '@/core/services/AuthService';
import { ConnectionService } from '@/core/services/ConnectionService';

export const LoginPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { login, lang } = useAppStore();
    
    // Auth Mode State
    const [isRegister, setIsRegister] = useState(false);
    
    // Form State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    
    // Verification State
    const [verifyEmailStep, setVerifyEmailStep] = useState(false);
    const [registeredEmail, setRegisteredEmail] = useState('');
    const [otp, setOtp] = useState('');
    
    // UI State
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Handle OAuth Callback Redirect
    useEffect(() => {
        const token = searchParams.get('token');
        if (token) {
            handleOAuthToken(token);
        }
    }, [searchParams]);

    const handleOAuthToken = async (token: string) => {
        setIsLoading(true);
        try {
            const user = await AuthService.getMe(token);
            login(token, user);

            // Fetch global connections
            try {
                const connections = await ConnectionService.getConnections();
                useAppStore.getState().setConnections(connections);
            } catch (ignored) {
                console.warn('Failed to fetch connections upon login');
            }

            // Redirect based on onboarding status
            if (user.isOnboarded) {
                navigate('/app');
            } else {
                navigate('/onboarding');
            }
        } catch (err) {
            setError('Social login failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSocialLogin = (provider: 'google' | 'github') => {
        window.location.href = `${API_BASE_URL}/auth/${provider}`;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const data = isRegister 
                ? await AuthService.register(name, email, password)
                : await AuthService.login(email, password);

            // Handle successful registration but unverified (OTP required)
            if (data.unverified) {
                setRegisteredEmail(data.email || email);
                setVerifyEmailStep(true);
                toast.success(data.message || 'Mã xác minh đã được gửi đến email của bạn.');
                setIsLoading(false);
                return;
            }

            if (data.access_token && data.user) {
                login(data.access_token, data.user);

                try {
                    const connections = await ConnectionService.getConnections();
                    useAppStore.getState().setConnections(connections);
                } catch (ignored) {
                    console.warn('Failed to fetch connections upon login');
                }

                if (data.user?.isOnboarded === false) {
                     navigate('/onboarding');
                } else {
                     navigate('/');
                }
            }
        } catch (err: any) {
            const data = err.data || {};
            if (data.unverified) {
                setRegisteredEmail(data.email || email);
                setVerifyEmailStep(true);
                setError(data.message || (lang === 'vi' ? 'Vui lòng xác minh email' : 'Please verify email'));
            } else {
                setError(err.message || (lang === 'vi' ? 'Thông tin đăng nhập không hợp lệ' : 'Invalid credentials'));
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const data = await AuthService.verifyEmail(registeredEmail, otp);
            toast.success(lang === 'vi' ? 'Xác minh thành công!' : 'Verification successful!');
            
            if (data.access_token && data.user) {
                login(data.access_token, data.user);
                
                if (data.user?.isOnboarded === false) {
                     navigate('/onboarding');
                } else {
                     navigate('/');
                }
            }
        } catch (err: any) {
            setError(err.message || 'Invalid OTP');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendOtp = async () => {
        setIsLoading(true);
        setError('');
        try {
            const data = await AuthService.resendVerification(registeredEmail);
            toast.success(data.message || (lang === 'vi' ? 'Đã gửi lại mã xác minh!' : 'Verification code resent!'));
        } catch (err: any) {
            setError(err.message || 'Error resending OTP');
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Render Verification Step ────────────────────────────────────
    if (verifyEmailStep) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
                <div className="w-full max-w-sm bg-background border rounded-lg shadow-sm p-8 animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex flex-col items-center mb-8 space-y-2">
                        <div className="bg-primary/10 p-3 rounded-xl mb-2">
                            <MailCheck className="w-8 h-8 text-primary" />
                        </div>
                        <h1 className="text-2xl font-semibold tracking-tight text-center">
                            {lang === 'vi' ? 'Xác minh Email' : 'Verify Email'}
                        </h1>
                        <p className="text-sm text-muted-foreground text-center">
                            {lang === 'vi' ? `Mã xác minh 6 số đã được gửi tới ${registeredEmail}` : `A 6-digit code has been sent to ${registeredEmail}`}
                        </p>
                    </div>

                    <form onSubmit={handleVerifyOtp} className="space-y-4">
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

                        {error && (
                            <div className="text-sm text-red-500 font-medium text-center bg-red-500/10 p-2 rounded">
                                {error}
                            </div>
                        )}

                        <Button className="w-full gap-2" type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {lang === 'vi' ? 'Xác minh tài khoản' : 'Verify Account'}
                        </Button>
                    </form>

                    <div className="mt-6 space-y-3">
                        <Button 
                            variant="outline" 
                            className="w-full" 
                            type="button" 
                            onClick={handleResendOtp} 
                            disabled={isLoading}
                        >
                            {lang === 'vi' ? 'Gửi lại mã' : 'Resend Code'}
                        </Button>
                        <button 
                            type="button" 
                            onClick={() => { setVerifyEmailStep(false); setOtp(''); setError(''); }} 
                            className="text-sm text-muted-foreground hover:text-foreground flex items-center justify-center w-full gap-2 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            {lang === 'vi' ? 'Quay lại đăng nhập' : 'Back to login'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Render Login/Register Step ──────────────────────────────────
    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
            <div className="w-full max-w-sm bg-background border rounded-lg shadow-sm p-8 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex flex-col items-center mb-8 space-y-2">
                    <div className="bg-primary/10 p-3 rounded-xl">
                        <Database className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {isRegister
                            ? (lang === 'vi' ? 'Tạo Tài khoản' : 'Create Account')
                            : (lang === 'vi' ? 'Chào mừng trở lại' : 'Welcome back')}
                    </h1>
                    <p className="text-sm text-muted-foreground text-center">
                        {isRegister
                            ? (lang === 'vi' ? 'Đăng ký tài khoản mới để bắt đầu' : 'Register a new account to get started')
                            : (lang === 'vi' ? 'Đăng nhập vào tài khoản để tiếp tục' : 'Sign in to your account to continue')}
                    </p>
                </div>

                <div className="grid gap-3 mb-6">
                    <Button variant="outline" type="button" onClick={() => handleSocialLogin('google')} disabled={isLoading}>
                        <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path></svg>
                        Google
                    </Button>
                    <Button variant="outline" type="button" onClick={() => handleSocialLogin('github')} disabled={isLoading}>
                        <Github className="mr-2 h-4 w-4" />
                        GitHub
                    </Button>
                </div>

                <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {isRegister && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium" htmlFor="name">Name</label>
                            <Input
                                id="name"
                                type="text"
                                placeholder="Your name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
                    )}
                    <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor="email">Email</label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="m@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium" htmlFor="password">Password</label>
                            {!isRegister && (
                                <button type="button" onClick={() => navigate('/forgot-password')} className="text-xs text-primary hover:underline font-medium">
                                    {lang === 'vi' ? 'Quên mật khẩu?' : 'Forgot password?'}
                                </button>
                            )}
                        </div>
                        <Input
                            id="password"
                            type="password"
                            placeholder={isRegister ? 'Min 6 characters' : '••••••••'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    {error && (
                        <div className="text-sm text-red-500 font-medium text-center bg-red-500/10 p-2 rounded">
                            {error}
                        </div>
                    )}

                    <Button className="w-full gap-2" type="submit" disabled={isLoading}>
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isRegister ? (
                            <UserPlus className="h-4 w-4" />
                        ) : (
                            <LogIn className="h-4 w-4" />
                        )}
                        {isRegister
                            ? (lang === 'vi' ? 'Tạo Tài khoản bằng Email' : 'Create Account with Email')
                            : (lang === 'vi' ? 'Đăng Nhập bằng Email' : 'Sign In with Email')}
                    </Button>
                </form>

                <div className="mt-6 text-center text-sm text-muted-foreground">
                    {isRegister ? (
                        <p>Already have an account?{' '}
                            <button type="button" onClick={() => { setIsRegister(false); setError(''); }} className="text-primary hover:underline font-medium">
                                Sign In
                            </button>
                        </p>
                    ) : (
                        <p>Don't have an account?{' '}
                            <button type="button" onClick={() => { setIsRegister(true); setError(''); }} className="text-primary hover:underline font-medium">
                                Register
                            </button>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};
