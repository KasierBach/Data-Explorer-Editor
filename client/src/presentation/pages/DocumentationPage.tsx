import { useState } from 'react';
import { Database, Search, Menu, X, Github } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { DocSidebar } from '@/presentation/components/docs/DocSidebar';
import { DocContent } from '@/presentation/components/docs/DocContent';
import { cn } from '@/lib/utils';

export function DocumentationPage() {
    const navigate = useNavigate();
    const [activeSection, setActiveSection] = useState('introduction');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
                    <div className="relative hidden md:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Quick search..."
                            className="bg-muted/50 border rounded-full pl-9 pr-4 py-1.5 text-xs w-64 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                        />
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/app')} className="text-xs h-8">
                        Launch App
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
                <main className="flex-1 overflow-y-auto bg-background/50 selection:bg-primary/20 custom-scrollbar relative">
                    {/* Decorative Background Elements */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-64 bg-primary/5 blur-[120px] pointer-events-none rounded-full" />

                    <div className="relative z-10 flex flex-col min-h-full">
                        <DocContent sectionId={activeSection} />

                        {/* Global Docs Footer */}
                        <div className="mt-auto border-t bg-muted/10 p-12 text-center space-y-4">
                            <h3 className="text-xl font-bold">Comprehensive Multi-Engine Tool</h3>
                            <p className="text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
                                Join our community on GitHub to contribute to the most intelligent local database IDE.
                            </p>
                            <div className="flex items-center justify-center gap-3">
                                <Button variant="outline" size="sm" onClick={() => window.open('https://github.com/KasierBach/Data-Explorer-Editor.git', '_blank')}>
                                    <Github className="w-4 h-4 mr-2" /> Star on GitHub
                                </Button>
                                <Button variant="default" size="sm" onClick={() => navigate('/app')}>
                                    Try it now
                                </Button>
                            </div>
                        </div>
                    </div>
                </main>

                {/* Right Sidebar - On Page TOC (Desktop only) */}
                <aside className="hidden lg:block w-64 border-l bg-card/10 p-6">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">On this page</h4>
                    <div className="space-y-3">
                        <div className="text-xs text-primary font-medium border-l-2 border-primary pl-3 py-0.5">Overview</div>
                        <div className="text-xs text-muted-foreground hover:text-foreground transition-colors pl-4 py-0.5 cursor-pointer">Architecture</div>
                        <div className="text-xs text-muted-foreground hover:text-foreground transition-colors pl-4 py-0.5 cursor-pointer">Security</div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
