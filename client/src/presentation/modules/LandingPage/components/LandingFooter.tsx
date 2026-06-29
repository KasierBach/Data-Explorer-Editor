import React from 'react';
import { BookOpen, Database, Github, History } from 'lucide-react';

interface LandingFooterProps {
    lang: string;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ lang }) => {
    const text = lang === 'vi'
        ? {
            brandDescription: 'Workspace cho SQL, NoSQL, ERD và các luồng AI có thể cấu hình theo từng vai trò, đủ gọn để dùng hằng ngày nhưng vẫn có guardrail khi cần.',
            builtForTeams: 'DÀNH CHO NHÓM DỮ LIỆU LÀM VIỆC NHANH.',
            liveStatus: 'Trạng thái: Sẵn sàng',
            languageLabel: 'Tiếng Việt',
            footerLinks: [
                {
                    title: 'Sản phẩm',
                    links: [
                        { label: 'Tính năng', href: '/#features' },
                        { label: 'SQL Workspace', href: '/sql-explorer' },
                        { label: 'NoSQL Studio', href: '/nosql-explorer' },
                        { label: 'ERD Workspace', href: '/sql-explorer/erd' },
                    ],
                },
                {
                    title: 'Khám phá',
                    links: [
                        { label: 'Tài liệu', href: '/docs' },
                        { label: 'Cập nhật', href: '/changelog' },
                        { label: 'GitHub', href: 'https://github.com/KasierBach/Data-Explorer-Editor' },
                    ],
                },
                {
                    title: 'Pháp lý',
                    links: [
                        { label: 'Trung tâm pháp lý', href: '/legal' },
                        { label: 'Chính sách riêng tư', href: '/privacy' },
                        { label: 'Điều khoản dịch vụ', href: '/terms' },
                    ],
                },
            ],
        }
        : {
            brandDescription: 'A workspace for SQL, NoSQL, ERD, and role-based AI flows that stays compact for daily work and adds guardrails when they matter.',
            builtForTeams: 'BUILT FOR DATA TEAMS THAT MOVE FAST.',
            liveStatus: 'Status: Ready',
            languageLabel: 'English (US)',
            footerLinks: [
                {
                    title: 'Product',
                    links: [
                        { label: 'Features', href: '/#features' },
                        { label: 'SQL Workspace', href: '/sql-explorer' },
                        { label: 'NoSQL Studio', href: '/nosql-explorer' },
                        { label: 'ERD Workspace', href: '/sql-explorer/erd' },
                    ],
                },
                {
                    title: 'Explore',
                    links: [
                        { label: 'Documentation', href: '/docs' },
                        { label: 'Changelog', href: '/changelog' },
                        { label: 'GitHub', href: 'https://github.com/KasierBach/Data-Explorer-Editor' },
                    ],
                },
                {
                    title: 'Legal',
                    links: [
                        { label: 'Legal center', href: '/legal' },
                        { label: 'Privacy policy', href: '/privacy' },
                        { label: 'Terms of service', href: '/terms' },
                    ],
                },
            ],
        };

    const shortcuts = [
        {
            href: 'https://github.com/KasierBach/Data-Explorer-Editor',
            label: 'GitHub',
            icon: <Github className="w-5 h-5" />,
            external: true,
        },
        {
            href: '/docs',
            label: 'Documentation',
            icon: <BookOpen className="w-5 h-5" />,
            external: false,
        },
        {
            href: '/changelog',
            label: 'Changelog',
            icon: <History className="w-5 h-5" />,
            external: false,
        },
    ];

    return (
        <footer className="border-t border-white/5 bg-background/50 backdrop-blur-xl pt-12 md:pt-16 pb-12">
            <div className="container mx-auto px-4 sm:px-6">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 md:gap-12 mb-12 md:mb-20">
                    <div className="col-span-2 lg:col-span-2">
                        <a href="/" className="flex items-center gap-3 font-black text-2xl mb-6 tracking-tighter uppercase w-fit">
                            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                <Database className="w-4 h-4 text-white" />
                            </div>
                            <span>DataExplorer</span>
                        </a>
                        <p className="text-muted-foreground text-sm font-medium leading-relaxed max-w-xs mb-8 opacity-70">
                            {text.brandDescription}
                        </p>
                        <div className="flex gap-5">
                            {shortcuts.map((item) => (
                                <a
                                    key={item.label}
                                    href={item.href}
                                    aria-label={item.label}
                                    target={item.external ? '_blank' : undefined}
                                    rel={item.external ? 'noreferrer noopener' : undefined}
                                    className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/10 transition-all"
                                >
                                    {item.icon}
                                </a>
                            ))}
                        </div>
                    </div>

                    {text.footerLinks.map((col) => (
                        <div key={col.title}>
                            <h4 className="font-black mb-6 text-xs tracking-[0.2em] uppercase text-foreground/80">{col.title}</h4>
                            <ul className="space-y-4 text-sm font-medium text-muted-foreground/60">
                                {col.links.map((link) => {
                                    const external = link.href.startsWith('http');
                                    return (
                                        <li key={link.label}>
                                            <a
                                                href={link.href}
                                                target={external ? '_blank' : undefined}
                                                rel={external ? 'noreferrer noopener' : undefined}
                                                className="hover:text-blue-500 transition-colors"
                                            >
                                                {link.label}
                                            </a>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="border-t border-white/5 pt-10 flex flex-col md:flex-row items-center justify-between gap-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
                        © 2026 DATA EXPLORER. {text.builtForTeams}
                    </p>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                            <span className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.2em]">
                                {text.liveStatus}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 group cursor-pointer">
                            <span className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.2em] group-hover:text-white transition-colors">
                                {text.languageLabel}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};
