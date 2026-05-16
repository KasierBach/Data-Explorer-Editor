import React from 'react';
import type { AuthUser } from '@/core/services/store/slices/authSlice';

interface NotificationsTabProps {
    t: (key: string) => string;
    notificationsState: {
        emailNotifications: boolean; setEmailNotifications: (v: boolean) => void;
        failedQueryAlerts: boolean; setFailedQueryAlerts: (v: boolean) => void;
        productUpdates: boolean; setProductUpdates: (v: boolean) => void;
        securityAlerts: boolean;
    };
    actions: {
        handleSaveSettings: (updates: Partial<AuthUser>) => void;
    };
}

export const NotificationsTab: React.FC<NotificationsTabProps> = ({ 
    t, notificationsState, actions 
}) => {
    const { 
        emailNotifications, setEmailNotifications, 
        failedQueryAlerts, setFailedQueryAlerts, 
        productUpdates, setProductUpdates,
        securityAlerts
    } = notificationsState;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
                <h3 className="text-lg font-medium">{t('tabs.notifications')}</h3>
                <p className="text-sm text-muted-foreground">{t('notifications_subtitle')}</p>
            </div>
            <div className="w-full h-px bg-border/50" />
            <div className="space-y-4 border rounded-xl overflow-hidden divide-y bg-card">
                {/* Email Notifications */}
                <div className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div>
                        <p className="font-medium text-sm">{t('email_notifications_label')}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 text-left">{t('email_notifications_hint')}</p>
                    </div>
                    <div 
                        onClick={() => { setEmailNotifications(!emailNotifications); actions.handleSaveSettings({ emailNotifications: !emailNotifications }); }}
                        className={`w-11 h-6 rounded-full relative cursor-pointer border-2 border-transparent transition-colors ${emailNotifications ? 'bg-violet-500' : 'bg-muted-foreground/30'}`}
                    >
                        <div className={`absolute top-0 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${emailNotifications ? 'right-0' : 'left-0'}`}></div>
                    </div>
                </div>
                {/* Failed Query Alerts */}
                <div className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div>
                        <p className="font-medium text-sm">{t('failed_query_alerts_label')}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 text-left">{t('failed_query_alerts_hint')}</p>
                    </div>
                    <div 
                        onClick={() => { setFailedQueryAlerts(!failedQueryAlerts); actions.handleSaveSettings({ failedQueryAlerts: !failedQueryAlerts }); }}
                        className={`w-11 h-6 rounded-full relative cursor-pointer border-2 border-transparent transition-colors ${failedQueryAlerts ? 'bg-violet-500' : 'bg-muted-foreground/30'}`}
                    >
                        <div className={`absolute top-0 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${failedQueryAlerts ? 'right-0' : 'left-0'}`}></div>
                    </div>
                </div>
                {/* Product Updates */}
                <div className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div>
                        <p className="font-medium text-sm">{t('product_updates_label')}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 text-left">{t('product_updates_hint')}</p>
                    </div>
                    <div 
                        onClick={() => { setProductUpdates(!productUpdates); actions.handleSaveSettings({ productUpdates: !productUpdates }); }}
                        className={`w-11 h-6 rounded-full relative cursor-pointer border-2 border-transparent transition-colors ${productUpdates ? 'bg-violet-500' : 'bg-muted-foreground/30'}`}
                    >
                        <div className={`absolute top-0 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${productUpdates ? 'right-0' : 'left-0'}`}></div>
                    </div>
                </div>
                {/* Security Alerts (Mandatory) */}
                <div className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div>
                        <p className="font-medium text-sm">{t('security_alerts_label')}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 text-left">{t('security_alerts_hint')}</p>
                    </div>
                    <div 
                        className={`w-11 h-6 rounded-full relative border-2 border-transparent transition-colors bg-violet-500 opacity-60 cursor-not-allowed`}
                        title="Mandatory for security"
                    >
                        <div className={`absolute top-0 w-5 h-5 bg-white rounded-full shadow-sm ${securityAlerts ? 'right-0' : 'left-0'}`}></div>
                    </div>
                </div>
            </div>
        </div>
    );
};
