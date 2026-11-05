import { ArrowLeft, FileText, Scale, ShieldCheck } from 'lucide-react';
import { getLegalDocument, type LegalDocKey } from './legalContent';
import type { PublicLanguage } from '@/core/seo/publicRoutes';
import { usePublicNavigation } from './PublicNavigationContext';

export function LegalDocumentView({ docKey, lang }: { docKey: LegalDocKey; lang: PublicLanguage }) {
    const doc = getLegalDocument(lang, docKey);
    const navigation = usePublicNavigation();
    const Icon = docKey === 'privacy' ? ShieldCheck : docKey === 'terms' ? Scale : FileText;
    return (
        <main className="relative z-10 flex-1">
            <section className="container mx-auto px-4 sm:px-6 py-16 md:py-24">
                <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 md:p-10 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
                    <a href={navigation.path('/')} className="inline-flex items-center rounded-md px-3 py-2 mb-6 h-auto pl-0 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />{lang === 'vi' ? 'Quay lại trang chủ' : 'Back to home'}</a>
                    <div className="mb-8 flex flex-wrap items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5"><Icon className={`h-5 w-5 ${docKey === 'privacy' ? 'text-cyan-300' : docKey === 'terms' ? 'text-amber-300' : 'text-blue-300'}`} aria-hidden="true" /></div><span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{doc.effectiveDate}</span></div>
                    <div className="max-w-3xl"><h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">{doc.title}</h1><p className="mt-4 text-base md:text-lg leading-8 text-slate-300">{doc.subtitle}</p></div>
                    {doc.quickLinks && <div className="mt-8 grid gap-3 md:grid-cols-2">{doc.quickLinks.map(link => <a key={link.href} href={navigation.path(link.href)} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm font-semibold text-slate-100 transition-colors hover:border-blue-400/50 hover:bg-blue-500/10">{link.label}</a>)}</div>}
                    <article className="mt-10 space-y-8">{doc.sections.map(section => <section key={section.title} className="rounded-2xl border border-white/8 bg-black/20 p-5 md:p-6"><h2 className="text-xl font-bold text-white">{section.title}</h2><div className="mt-4 space-y-4 text-sm leading-7 text-slate-300">{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}{section.bullets && <ul className="space-y-2 pl-5">{section.bullets.map(bullet => <li key={bullet} className="list-disc">{bullet}</li>)}</ul>}</div></section>)}</article>
                </div>
            </section>
        </main>
    );
}
