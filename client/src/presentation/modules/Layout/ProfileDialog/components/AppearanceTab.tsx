import React from 'react';
import type { AuthUser } from '@/core/services/store/slices/authSlice';

type AppearanceTheme = 'dark' | 'light' | 'system';

interface AppearanceTabProps {
    t: (key: string) => string;
    appearanceState: {
        theme: string; setTheme: (v: string) => void;
        language: string; setLanguage: (v: string) => void;
        setAppTheme: (v: AppearanceTheme) => void;
    };
    actions: {
        handleSaveSettings: (updates: Partial<AuthUser>) => void;
    };
}

export const AppearanceTab: React.FC<AppearanceTabProps> = ({ 
    t, appearanceState, actions 
}) => {
    const { theme, setTheme, language, setLanguage, setAppTheme } = appearanceState;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
                <h3 className="text-lg font-medium">{t('tabs.appearance')}</h3>
                <p className="text-sm text-muted-foreground">{t('appearance_subtitle')}</p>
            </div>
            <div className="w-full h-px bg-border/50" />
            <div className="space-y-4">
                <div className="space-y-3">
                    <label className="text-sm font-medium">{t('language_label')}</label>
                    <select 
                        value={language} 
                        onChange={e => { setLanguage(e.target.value); actions.handleSaveSettings({ language: e.target.value }); }}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                        <option value="vi">Tiếng Việt</option>
                        <option value="en">English</option>
                    </select>
                    <p className="text-[11px] text-muted-foreground">{t('language_hint')}</p>
                </div>
                <div className="space-y-3">
                    <label className="text-sm font-medium">{t('theme_label')}</label>
                    <div className="grid grid-cols-3 gap-4 max-w-2xl">
                        {/* Light Theme */}
                        <div onClick={() => { setTheme('light'); setAppTheme('light'); actions.handleSaveSettings({ theme: 'light' }); }} className="cursor-pointer group flex flex-col gap-2">
                            <div className={`border-2 rounded-lg p-1 transition-all ${theme === 'light' ? 'border-violet-500 bg-violet-500/5' : 'border-transparent hover:border-violet-500'}`}>
                                <div className="w-full h-24 rounded bg-slate-100 flex p-2 gap-2 shadow-sm border">
                                    <div className="w-1/3 h-full bg-white rounded-sm border"></div>
                                    <div className="w-2/3 flex flex-col gap-2">
                                        <div className="h-4 w-full bg-slate-200 rounded-sm"></div>
                                        <div className="h-full w-full bg-white border rounded-sm"></div>
                                    </div>
                                </div>
                            </div>
                            <span className={`text-xs font-medium text-center ${theme === 'light' ? 'text-violet-500 font-bold' : 'text-muted-foreground group-hover:text-foreground'}`}>{t('theme_light')}</span>
                        </div>
                        {/* Dark Theme */}
                        <div onClick={() => { setTheme('dark'); setAppTheme('dark'); actions.handleSaveSettings({ theme: 'dark' }); }} className="cursor-pointer group flex flex-col gap-2">
                            <div className={`border-2 rounded-lg p-1 transition-all ${theme === 'dark' ? 'border-violet-500 bg-violet-500/5' : 'border-transparent hover:border-violet-500'}`}>
                                <div className="w-full h-24 rounded bg-slate-900 flex p-2 gap-2 shadow-sm border border-slate-800">
                                    <div className="w-1/3 h-full bg-slate-950 rounded-sm border border-slate-800"></div>
                                    <div className="w-2/3 flex flex-col gap-2">
                                        <div className="h-4 w-full bg-slate-800 rounded-sm"></div>
                                        <div className="h-full w-full bg-slate-950 border border-slate-800 rounded-sm"></div>
                                    </div>
                                </div>
                            </div>
                            <span className={`text-xs font-medium text-center ${theme === 'dark' ? 'text-violet-500 font-bold' : 'text-muted-foreground group-hover:text-foreground'}`}>{t('theme_dark')}</span>
                        </div>
                        {/* System Theme */}
                        <div onClick={() => { setTheme('system'); setAppTheme('system'); actions.handleSaveSettings({ theme: 'system' }); }} className="cursor-pointer group flex flex-col gap-2">
                            <div className={`border-2 rounded-lg p-1 transition-all ${theme === 'system' ? 'border-violet-500 bg-violet-500/5' : 'border-transparent hover:border-violet-500'}`}>
                                <div className="w-full h-24 rounded bg-gradient-to-br from-slate-200 to-slate-800 flex p-2 gap-2 shadow-sm border opacity-80">
                                    <div className="w-1/3 h-full bg-slate-500/20 rounded-sm border border-slate-500/20"></div>
                                    <div className="w-full h-full bg-slate-500/20 rounded-sm"></div>
                                </div>
                            </div>
                            <span className={`text-xs font-medium text-center ${theme === 'system' ? 'text-violet-500 font-bold' : 'text-muted-foreground group-hover:text-foreground'}`}>{t('theme_system')}</span>
                        </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{t('theme_hint')}</p>
                </div>
            </div>
        </div>
    );
};
