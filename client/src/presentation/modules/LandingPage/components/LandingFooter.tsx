import React from 'react';
import { Database, Github, Twitter, Disc } from 'lucide-react';

interface LandingFooterProps {
    lang: string;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ lang }) => {
    const footerLinks = [
        { title: lang === 'vi' ? 'Sản phẩm' : 'Product', links: lang === 'vi' ? ['Tính năng', 'AI Insights', 'Sơ đồ', 'Nhật ký thay đổi'] : ['Features', 'AI Insights', 'Diagrams', 'Changelog'] },
        { title: lang === 'vi' ? 'Tài nguyên' : 'Resources', links: lang === 'vi' ? ['Tài liệu', 'Tham chiếu API', 'Đồng bộ Cloud', 'Trạng thái'] : ['Documentation', 'API Reference', 'Cloud Sync', 'Status'] },
        { title: lang === 'vi' ? 'Pháp lý' : 'Legal', links: lang === 'vi' ? ['Quyền riêng tư', 'Điều khoản', 'Bảo mật', 'Tuân thủ'] : ['Privacy', 'Terms', 'Security', 'Compliance'] }
    ];

    return (
        <footer className="border-t border-white/5 bg-background/50 backdrop-blur-xl pt-12 md:pt-16 pb-12">
            <div className="container mx-auto px-4 sm:px-6">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 md:gap-12 mb-12 md:mb-20">
                    <div className="col-span-2 lg:col-span-2">
                        <div className="flex items-center gap-3 font-black text-2xl mb-6 tracking-tighter uppercase cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                <Database className="w-4 h-4 text-white" />
                            </div>
                            <span>DataExplorer</span>
                        </div>
                        <p className="text-muted-foreground text-sm font-medium leading-relaxed max-w-xs mb-8 opacity-70">
                            Precision engineered data tools for the next generation of engineers. Built with speed and security at its core.
                        </p>
                        <div className="flex gap-5">
                            <a href="#" className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/10 transition-all">
                                <Github className="w-5 h-5" />
                            </a>
                            <a href="#" className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/10 transition-all">
                                <Twitter className="w-5 h-5" />
                            </a>
                            <a href="#" className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/10 transition-all">
                                <Disc className="w-5 h-5" />
                            </a>
                        </div>
                    </div>

                    {footerLinks.map((col, i) => (
                        <div key={i}>
                            <h4 className="font-black mb-6 text-xs tracking-[0.2em] uppercase text-foreground/80">{col.title}</h4>
                            <ul className="space-y-4 text-sm font-medium text-muted-foreground/60">
                                {col.links.map(link => (
                                    <li key={link}><a href="#" className="hover:text-blue-500 transition-colors">{link}</a></li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="border-t border-white/5 pt-10 flex flex-col md:flex-row items-center justify-between gap-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
                        © 2026 ANTIGRAVITY ENGINE. {lang === 'vi' ? 'TẤT CẢ HỆ THỐNG ĐÃ ĐƯỢC MÃ HÓA.' : 'ALL SYSTEMS ENCRYPTED.'}
                    </p>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                            <span className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.2em]">
                                {lang === 'vi' ? 'Trạng thái: Hoạt động' : 'Live Status: Nominal'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 group cursor-pointer">
                            <span className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.2em] group-hover:text-white transition-colors">
                                {lang === 'vi' ? 'Tiếng Việt' : 'English (US)'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};
