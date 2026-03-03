import React from 'react';
import { useAppStore } from '@/core/services/store';
import { cn } from '@/lib/utils';

export const LanguageSwitcher: React.FC = () => {
    const { lang, setLang } = useAppStore();

    return (
        <div className="flex items-center bg-muted/20 p-1 rounded-xl border border-white/5 backdrop-blur-sm shadow-inner group">
            <button
                onClick={() => setLang('vi')}
                className={cn(
                    "px-2.5 py-1 text-[10px] font-black rounded-lg transition-all duration-300 uppercase tracking-[0.2em] relative overflow-hidden",
                    lang === 'vi'
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20 active:scale-95"
                        : "text-muted-foreground/60 hover:text-foreground hover:bg-white/5"
                )}
            >
                VN
            </button>
            <div className="w-px h-3 bg-white/5 mx-1" />
            <button
                onClick={() => setLang('en')}
                className={cn(
                    "px-2.5 py-1 text-[10px] font-black rounded-lg transition-all duration-300 uppercase tracking-[0.2em] relative overflow-hidden",
                    lang === 'en'
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20 active:scale-95"
                        : "text-muted-foreground/60 hover:text-foreground hover:bg-white/5"
                )}
            >
                EN
            </button>
        </div>
    );
};
