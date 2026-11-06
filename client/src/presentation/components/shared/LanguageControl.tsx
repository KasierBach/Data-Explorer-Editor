import { cn } from '@/lib/utils';

type Language = 'vi' | 'en';

interface LanguageControlProps {
    lang: Language;
    onChange: (lang: Language) => void;
    touch?: boolean;
    appearance?: 'default' | 'pill';
    hrefs?: Record<Language, string>;
}

export function LanguageControl({ lang, onChange, touch = false, appearance = 'default', hrefs }: LanguageControlProps) {
    return (
        <div data-appearance={appearance} className={cn(
            'flex items-center bg-muted/20 p-1 rounded-xl border border-white/5 backdrop-blur-sm shadow-inner group',
            appearance === 'pill' && 'bg-[#eef2fb] dark:bg-[#0c1428] border-[#d6deee] dark:border-[#253451]',
        )}>
            {(['vi', 'en'] as const).map((language, index) => {
                const className = cn(
                    'px-2.5 py-1 text-[10px] font-black rounded-lg transition-all duration-300 uppercase tracking-[0.2em] relative overflow-hidden',
                    (touch || appearance === 'pill') && 'min-h-11 min-w-11 inline-flex items-center justify-center',
                    appearance === 'pill' && !touch && 'sm:[@media(hover:hover)_and_(pointer:fine)]:min-h-0 sm:[@media(hover:hover)_and_(pointer:fine)]:min-w-0',
                    lang === language ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 active:scale-95' : 'text-muted-foreground hover:text-foreground hover:bg-white/5',
                    appearance === 'pill' && (lang === language ? '[box-shadow:none]' : 'text-[#52617b] dark:text-[#a6b4d0] hover:text-[#162139] dark:hover:text-[#f0f4ff]'),
                );
                return (
                    <span key={language} className="contents">
                        {index > 0 && <span aria-hidden="true" className="w-px h-3 bg-white/5 mx-1" />}
                        {hrefs ? (
                            <a className={className} href={hrefs[language]} hrefLang={language} aria-current={lang === language ? 'page' : undefined}>{language === 'vi' ? 'VN' : 'EN'}</a>
                        ) : (
                            <button type="button" className={className} onClick={() => onChange(language)} aria-pressed={lang === language}>{language === 'vi' ? 'VN' : 'EN'}</button>
                        )}
                    </span>
                );
            })}
        </div>
    );
}
