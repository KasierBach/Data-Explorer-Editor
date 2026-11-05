import { cn } from '@/lib/utils';

type Language = 'vi' | 'en';

interface LanguageControlProps {
    lang: Language;
    onChange: (lang: Language) => void;
    touch?: boolean;
    hrefs?: Record<Language, string>;
}

export function LanguageControl({ lang, onChange, touch = false, hrefs }: LanguageControlProps) {
    return (
        <div className="flex items-center bg-muted/20 p-1 rounded-xl border border-white/5 backdrop-blur-sm shadow-inner group">
            {(['vi', 'en'] as const).map((language, index) => {
                const className = cn(
                    'px-2.5 py-1 text-[10px] font-black rounded-lg transition-all duration-300 uppercase tracking-[0.2em] relative overflow-hidden',
                    touch && 'min-h-11 min-w-11 inline-flex items-center justify-center',
                    lang === language ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 active:scale-95' : 'text-muted-foreground hover:text-foreground hover:bg-white/5',
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
