import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { useAppStore } from '@/core/services/store';
import { Database, Loader2, UserPlus, LogIn } from 'lucide-react';

export const LoginPage = () => {
    const navigate = useNavigate();
    const { login } = useAppStore();
    const [isRegister, setIsRegister] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
            const body = isRegister
                ? JSON.stringify({ name, email, password })
                : JSON.stringify({ email, password });

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || 'Something went wrong');
            }

            const data = await response.json();
            login(data.access_token, data.user);
            navigate('/');
        } catch (err: any) {
            setError(err.message || 'Invalid credentials');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
            <div className="w-full max-w-sm bg-background border rounded-lg shadow-sm p-8 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex flex-col items-center mb-8 space-y-2">
                    <div className="bg-primary/10 p-3 rounded-xl">
                        <Database className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {isRegister ? 'Create Account' : 'Welcome back'}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {isRegister ? 'Register a new account to get started' : 'Sign in to your account to continue'}
                    </p>
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
                        <label className="text-sm font-medium" htmlFor="password">Password</label>
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
                        {isRegister ? 'Create Account' : 'Sign In'}
                    </Button>
                </form>

                <div className="mt-6 text-center text-sm text-muted-foreground">
                    {isRegister ? (
                        <p>Already have an account?{' '}
                            <button onClick={() => { setIsRegister(false); setError(''); }} className="text-primary hover:underline font-medium">
                                Sign In
                            </button>
                        </p>
                    ) : (
                        <p>Don't have an account?{' '}
                            <button onClick={() => { setIsRegister(true); setError(''); }} className="text-primary hover:underline font-medium">
                                Register
                            </button>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};
