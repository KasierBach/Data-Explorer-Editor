import { useState, useMemo } from 'react';
import { Database, Search, Menu, X, Github, ArrowLeft } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { DocSidebar, DOCS_STRUCTURE } from '@/presentation/components/docs/DocSidebar';
import { DocContent } from '@/presentation/components/docs/DocContent';
import { DocBreadcrumbs } from '@/presentation/components/docs/DocBreadcrumbs';
import { DocNavigation } from '@/presentation/components/docs/DocNavigation';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/core/services/store';
import { LanguageSwitcher } from '@/presentation/components/shared/LanguageSwitcher';
import { SEO } from '@/presentation/components/shared/Seo';

export function DocumentationPage() {
    const navigate = useNavigate();
    const { lang } = useAppStore();
    const [activeSection, setActiveSection] = useState('introduction');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [headings, setHeadings] = useState<{ id: string, text: string, level: number }[]>([]);

    // Compute navigation metadata
    const navInfo = useMemo(() => {
        let currentItem = null;
        let currentSection = null;
        const flatItems = [];

        for (const section of DOCS_STRUCTURE) {
            if (section.items) {
                for (const item of section.items) {
                    const itemData = {
                        ...item,
                        sectionTitle: lang === 'vi' ? section.title : (section.titleEn || section.title)
                    };
                    flatItems.push(itemData);
                    if (item.id === activeSection) {
                        currentItem = itemData;
                        currentSection = section;
                    }
                }
            }
        }

        const currentIndex = flatItems.findIndex(i => i.id === activeSection);
        const prev = currentIndex > 0 ? flatItems[currentIndex - 1] : undefined;
        const next = currentIndex < flatItems.length - 1 ? flatItems[currentIndex + 1] : undefined;

        return { currentItem, currentSection, prev, next };
    }, [activeSection, lang]);

    // Scan for headings whenever activeSection or content changes
    useMemo(() => {
        setTimeout(() => {
            const contentElement = document.querySelector('main');
            if (contentElement) {
                const foundHeadings = Array.from(contentElement.querySelectorAll('h2, h3')).map((heading, index) => {
                    if (!heading.id) {
                        heading.id = `heading-${index}`;
                    }
                    return {
                        id: heading.id,
                        text: heading.textContent || '',
                        level: heading.tagName === 'H2' ? 2 : 3
                    };
                });
                setHeadings(foundHeadings);
            }
        }, 100);
    }, [activeSection, lang]);

    const scrollToHeading = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">
            <SEO 
                lang={lang}
                title={`${lang === 'vi' ? (navInfo.currentItem?.title || 'Tài liệu') : (navInfo.currentItem?.titleEn || navInfo.currentItem?.title || 'Docs')}`}
                description={lang === 'vi'
                    ? `Hướng dẫn chi tiết về ${navInfo.currentItem?.title} trong Data Explorer. Tìm hiểu cách tối ưu hóa quy trình làm việc với dữ liệu.`
                    : `In-depth guide for ${navInfo.currentItem?.titleEn || navInfo.currentItem?.title} in Data Explorer. Learn how to optimize your data workflow.`
                }
            />
            {/* Minimal Header */}
            <header className="h-14 border-b bg-card/50 backdrop-blur-xl flex items-center justify-between px-4 shrink-0 z-50">
                <div className="flex items-center gap-6">
                    <div
                        className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => navigate('/')}
                    >
                        <div className="bg-primary/10 p-1.5 rounded-lg border border-primary/20">
                            <Database className="w-5 h-5 text-primary" />
                        </div>
                        <h1 className="font-bold text-sm tracking-tight hidden sm:block truncate max-w-[150px] lg:max-w-none">
                            Data Explorer <span className="text-muted-foreground font-normal ml-1">{lang === 'vi' ? 'Tài liệu' : 'Docs'}</span>
                        </h1>
                    </div>

                    <div className="hidden sm:block">
                        <LanguageSwitcher />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative hidden md:block text-slate-500">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" />
                        <input
                            type="text"
                            placeholder={lang === 'vi' ? "Tìm nhanh tài liệu..." : "Quick search docs..."}
                            className="bg-muted/50 border rounded-full pl-9 pr-4 py-1.5 text-xs w-48 lg:w-64 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                        />
                    </div>

                    <div className="sm:hidden">
                        <LanguageSwitcher />
                    </div>

                    <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="hidden sm:flex text-xs h-8 items-center gap-1.5 text-muted-foreground">
                        <ArrowLeft className="w-3.5 h-3.5" />
                        {lang === 'vi' ? 'Quay lại' : 'Go Back'}
                    </Button>

                    <Button variant="ghost" size="sm" onClick={() => navigate('/sql-explorer')} className="text-xs h-8">
                        {lang === 'vi' ? 'Mở Ứng dụng' : 'Launch App'}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden h-8 w-8"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </Button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative">
                {/* Desktop Sidebar */}
                <DocSidebar
                    activeId={activeSection}
                    onSelect={(id) => setActiveSection(id)}
                    lang={lang}
                    className="hidden md:flex"
                />

                {/* Mobile Drawer Overlay */}
                {isMobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                )}

                {/* Mobile Sidebar */}
                <DocSidebar
                    activeId={activeSection}
                    onSelect={(id) => {
                        setActiveSection(id);
                        setIsMobileMenuOpen(false);
                    }}
                    lang={lang}
                    className={cn(
                        "fixed inset-y-0 left-0 w-72 z-50 md:hidden transition-transform duration-300 ease-in-out border-r pt-14",
                        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
                    )}
                />

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto bg-background/50 selection:bg-primary/20 custom-scrollbar relative scroll-smooth">
                    {/* Decorative Background Elements */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-64 bg-primary/5 blur-[120px] pointer-events-none rounded-full" />

                    <div className="relative z-10 flex flex-col min-h-full">
                        <div className="max-w-3xl mx-auto w-full py-12 px-6">
                            <DocBreadcrumbs
                                sectionTitle={lang === 'vi' ? navInfo.currentSection?.title || '' : (navInfo.currentSection?.titleEn || navInfo.currentSection?.title || '')}
                                itemTitle={lang === 'vi' ? navInfo.currentItem?.title || '' : (navInfo.currentItem?.titleEn || navInfo.currentItem?.title || '')}
                                onHomeClick={() => setActiveSection('introduction')}
                                lang={lang}
                            />

                            <div className="min-h-[60vh]">
                                <DocContent sectionId={activeSection} lang={lang} />
                            </div>

                            <DocNavigation
                                prev={navInfo.prev}
                                next={navInfo.next}
                                onNavigate={(id) => {
                                    setActiveSection(id);
                                    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                lang={lang}
                            />

                            <footer className="mt-24 pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-6 group">
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <button
                                        className="hover:text-foreground transition-all flex items-center gap-2 group/btn"
                                        onClick={() => window.open('https://github.com/KasierBach/Data-Explorer-Editor.git', '_blank')}
                                    >
                                        <Github className="w-4 h-4 transition-transform group-hover/btn:scale-110" />
                                        {lang === 'vi' ? 'Chỉnh sửa trang này' : 'Edit this page'}
                                    </button>
                                    <span className="opacity-30 hidden sm:block">|</span>
                                    <span className="text-xs">v1.2.0 • {lang === 'vi' ? 'Tháng 3 2026' : 'March 2026'}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground font-medium">
                                        {lang === 'vi' ? 'Tài liệu này hữu ích chứ?' : 'Was this helpful?'}
                                    </span>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors">👍</Button>
                                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 hover:bg-rose-500/10 hover:text-rose-500 transition-colors">👎</Button>
                                    </div>
                                </div>
                            </footer>
                        </div>

                        {/* Global CTA Strip */}
                        <div className="mt-auto border-t bg-muted/10 p-12 text-center space-y-4">
                            <h3 className="text-xl font-bold">
                                {lang === 'vi' ? 'Sẵn sàng khám phá dữ liệu?' : 'Ready to explore data?'}
                            </h3>
                            <p className="text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
                                {lang === 'vi'
                                    ? 'Tham gia cộng đồng trên GitHub để đóng góp cho IDE cơ sở dữ liệu địa phương thông minh nhất.'
                                    : 'Join the community on GitHub to contribute to the smartest local database IDE.'}
                            </p>
                            <div className="flex items-center justify-center gap-3">
                                <Button variant="outline" size="sm" onClick={() => window.open('https://github.com/KasierBach/Data-Explorer-Editor.git', '_blank')}>
                                    <Github className="w-4 h-4 mr-2" /> GitHub
                                </Button>
                                <Button variant="default" size="sm" onClick={() => navigate('/sql-explorer')}>
                                    {lang === 'vi' ? 'Mở Ứng dụng' : 'Launch App'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </main>

                {/* Right Sidebar - On Page TOC (Desktop only) */}
                <aside className="hidden lg:block w-64 border-l bg-card/10 p-6 overflow-y-auto custom-scrollbar">
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-6">
                        {lang === 'vi' ? 'Mục lục' : 'Table of Contents'}
                    </h4>
                    <div className="space-y-1">
                        {headings.length > 0 ? (
                            headings.map((heading) => (
                                <button
                                    key={heading.id}
                                    onClick={() => scrollToHeading(heading.id)}
                                    className={cn(
                                        "w-full text-left text-xs transition-all py-1.5 block hover:text-primary",
                                        heading.level === 2 ? "font-semibold text-muted-foreground" : "pl-4 text-muted-foreground/70"
                                    )}
                                >
                                    {heading.text}
                                </button>
                            ))
                        ) : (
                            <p className="text-[10px] text-muted-foreground italic">
                                {lang === 'vi' ? 'Không có đề mục nào' : 'No headings found'}
                            </p>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
}
