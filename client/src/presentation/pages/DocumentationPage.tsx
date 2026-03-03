import { useState, useMemo } from 'react';
import { Database, Search, Menu, X, Github } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { DocSidebar, DOCS_STRUCTURE } from '@/presentation/components/docs/DocSidebar';
import { DocContent } from '@/presentation/components/docs/DocContent';
import { DocBreadcrumbs } from '@/presentation/components/docs/DocBreadcrumbs';
import { DocNavigation } from '@/presentation/components/docs/DocNavigation';
import { cn } from '@/lib/utils';

export function DocumentationPage() {
    const navigate = useNavigate();
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
                    const itemData = { ...item, sectionTitle: section.title };
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
    }, [activeSection]);

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
    }, [activeSection]);

    const scrollToHeading = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">
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
                        <h1 className="font-bold text-sm tracking-tight hidden sm:block">Data Explorer <span className="text-muted-foreground font-normal ml-1">Docs</span></h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative hidden md:block text-slate-500">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Tìm nhanh tài liệu..."
                            className="bg-muted/50 border rounded-full pl-9 pr-4 py-1.5 text-xs w-64 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                        />
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/app')} className="text-xs h-8">
                        Mở Ứng dụng
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
                                sectionTitle={navInfo.currentSection?.title || ''}
                                itemTitle={navInfo.currentItem?.title || ''}
                                onHomeClick={() => setActiveSection('introduction')}
                            />

                            <div className="min-h-[60vh]">
                                <DocContent sectionId={activeSection} />
                            </div>

                            <DocNavigation
                                prev={navInfo.prev}
                                next={navInfo.next}
                                onNavigate={(id) => {
                                    setActiveSection(id);
                                    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                            />

                            <footer className="mt-24 pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-6 group">
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <button
                                        className="hover:text-foreground transition-all flex items-center gap-2 group/btn"
                                        onClick={() => window.open('https://github.com/KasierBach/Data-Explorer-Editor.git', '_blank')}
                                    >
                                        <Github className="w-4 h-4 transition-transform group-hover/btn:scale-110" /> Chỉnh sửa trang này
                                    </button>
                                    <span className="opacity-30 hidden sm:block">|</span>
                                    <span className="text-xs">v1.2.0 • March 2026</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground font-medium">Tài liệu này hữu ích chứ?</span>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors">👍</Button>
                                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 hover:bg-red-500/10 hover:text-red-500 transition-colors">👎</Button>
                                    </div>
                                </div>
                            </footer>
                        </div>

                        {/* Global CTA Strip */}
                        <div className="mt-auto border-t bg-muted/10 p-12 text-center space-y-4">
                            <h3 className="text-xl font-bold">Sẵn sàng khám phá dữ liệu?</h3>
                            <p className="text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
                                Tham gia cộng đồng trên GitHub để đóng góp cho IDE cơ sở dữ liệu địa phương thông minh nhất.
                            </p>
                            <div className="flex items-center justify-center gap-3">
                                <Button variant="outline" size="sm" onClick={() => window.open('https://github.com/KasierBach/Data-Explorer-Editor.git', '_blank')}>
                                    <Github className="w-4 h-4 mr-2" /> GitHub
                                </Button>
                                <Button variant="default" size="sm" onClick={() => navigate('/app')}>
                                    Mở Ứng dụng
                                </Button>
                            </div>
                        </div>
                    </div>
                </main>

                {/* Right Sidebar - On Page TOC (Desktop only) */}
                <aside className="hidden lg:block w-64 border-l bg-card/10 p-6 overflow-y-auto custom-scrollbar">
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-6">Mục lục</h4>
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
                            <p className="text-[10px] text-muted-foreground italic">Không có đề mục nào</p>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
}
