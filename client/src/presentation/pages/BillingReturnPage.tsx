import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { BillingService } from '@/core/services/BillingService';
import { useAppStore } from '@/core/services/store';
import { Button } from '@/presentation/components/ui/button';

type ReturnState = 'checking' | 'paid' | 'pending' | 'failed';

export function BillingReturnPage() {
    const [params] = useSearchParams();
    const updateUser = useAppStore((state) => state.updateUser);
    const [state, setState] = useState<ReturnState>('checking');
    const paymentId = params.get('paymentId');

    useEffect(() => {
        let cancelled = false;

        const checkStatus = async () => {
            if (!paymentId) {
                setState('failed');
                return;
            }

            try {
                const result = await BillingService.getPaymentStatus(paymentId);
                if (cancelled) return;

                updateUser(result.user);
                const nextState = result.payment.status === 'paid' ? 'paid' : 'pending';
                setState(nextState);

                if (nextState === 'paid') {
                    toast.success('Billing activated');
                }
            } catch (error) {
                if (!cancelled) {
                    setState('failed');
                    toast.error(error instanceof Error ? error.message : 'Unable to verify payment');
                }
            }
        };

        void checkStatus();

        return () => {
            cancelled = true;
        };
    }, [paymentId, updateUser]);

    const content = {
        checking: {
            icon: <Loader2 className="h-8 w-8 animate-spin text-blue-400" />,
            title: 'Checking payment',
            body: 'We are verifying the provider notification before updating your plan.',
        },
        paid: {
            icon: <CheckCircle2 className="h-8 w-8 text-emerald-400" />,
            title: 'Pro is active',
            body: 'Your billing status has been refreshed from the confirmed payment.',
        },
        pending: {
            icon: <Loader2 className="h-8 w-8 animate-spin text-amber-400" />,
            title: 'Payment is pending',
            body: 'The provider has not confirmed the payment yet. Refresh billing in your profile in a moment.',
        },
        failed: {
            icon: <XCircle className="h-8 w-8 text-red-400" />,
            title: 'Could not verify payment',
            body: 'The payment was not found or the provider notification has not arrived.',
        },
    }[state];

    return (
        <main className="flex min-h-dvh items-center justify-center bg-background p-6 text-foreground">
            <section className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
                <div className="mb-5 flex items-center gap-3">
                    {content.icon}
                    <div>
                        <h1 className="text-xl font-semibold">{content.title}</h1>
                        <p className="text-sm text-muted-foreground">{content.body}</p>
                    </div>
                </div>
                <Button asChild className="w-full">
                    <Link to="/sql-explorer">Back to workspace</Link>
                </Button>
            </section>
        </main>
    );
}
