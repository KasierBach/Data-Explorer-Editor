import {
    Database,
    Layers,
    BookOpen,
    Github
} from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';

interface DocContentProps {
    sectionId: string;
}

export function DocContent({ sectionId }: DocContentProps) {
    // This is a simplified content map. In a real doc site, this might be Markdown files.
    const renderContent = () => {
        switch (sectionId) {
            case 'introduction':
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">Introduction</h1>
                            <p className="text-xl text-muted-foreground leading-relaxed">
                                WELCOME to the official Data Explorer documentation. Data Explorer is a high-fidelity, high-performance database management and visualization tool designed for teams who need more than just a table viewer.
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6 mt-12">
                            <div className="p-6 rounded-2xl border bg-card/50 space-y-3">
                                <div className="bg-blue-500/10 w-10 h-10 rounded-lg flex items-center justify-center">
                                    <Database className="w-5 h-5 text-blue-500" />
                                </div>
                                <h3 className="font-bold text-lg">Multi-Engine Support</h3>
                                <p className="text-sm text-muted-foreground">Native drivers for PostgreSQL, MySQL, SQL Server, and ClickHouse with a unified interface.</p>
                            </div>
                            <div className="p-6 rounded-2xl border bg-card/50 space-y-3">
                                <div className="bg-purple-500/10 w-10 h-10 rounded-lg flex items-center justify-center">
                                    <BookOpen className="w-5 h-5 text-purple-500" />
                                </div>
                                <h3 className="font-bold text-lg">AI Assistant</h3>
                                <p className="text-sm text-muted-foreground">Gemini-powered SQL generation, schema analysis, and vision reconstruction capabilities.</p>
                            </div>
                        </div>

                        <div className="space-y-4 pt-8">
                            <h2 className="text-2xl font-bold border-b pb-2">Why Data Explorer?</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                Most database tools are either too simple or too overwhelmed with legacy UI. Data Explorer focuses on **density**, **speed**, and **intelligence**. We provide a "Monaco-first" experience that feels like VS Code for your data.
                            </p>
                            <div className="bg-muted/30 p-4 border-l-4 border-primary rounded-r-lg italic text-sm">
                                "Our mission is to make data exploration feel as intuitive as writing code."
                            </div>
                        </div>
                    </div>
                );
            case 'sql-generation':
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">AI SQL Generation</h1>
                            <p className="text-xl text-muted-foreground leading-relaxed">
                                Data Explorer uses Google's Gemini models to translate natural language into optimized SQL queries based specifically on your active database context.
                            </p>
                        </div>

                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold border-b pb-2 text-primary">How it works</h2>
                            <div className="flex gap-4 items-start">
                                <div className="bg-primary/10 p-2 rounded-full text-primary font-bold text-xs shrink-0">01</div>
                                <p className="text-muted-foreground"><span className="text-foreground font-semibold">Schema Analysis:</span> When you connect to a database, the system extracts table schemas, types, and primary-foreign key relationships.</p>
                            </div>
                            <div className="flex gap-4 items-start">
                                <div className="bg-primary/10 p-2 rounded-full text-primary font-bold text-xs shrink-0">02</div>
                                <p className="text-muted-foreground"><span className="text-foreground font-semibold">Contextual Prompting:</span> Your natural language query is sent to Gemini along with the relevant schema metadata to ensure the SQL generated refers to existing columns and tables.</p>
                            </div>
                            <div className="flex gap-4 items-start">
                                <div className="bg-primary/10 p-2 rounded-full text-primary font-bold text-xs shrink-0">03</div>
                                <p className="text-muted-foreground"><span className="text-foreground font-semibold">Streamed Execution:</span> The generated SQL is streamed back (using SSE) directly into your editor, ready for execution.</p>
                            </div>
                        </div>

                        <div className="p-6 rounded-2xl bg-slate-950 text-slate-50 font-mono text-sm border shadow-xl">
                            <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-2">
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                <div className="w-3 h-3 rounded-full bg-green-500" />
                                <span className="ml-2 text-slate-500 text-xs italic">gemini-generated result</span>
                            </div>
                            <div className="text-emerald-400">-- User: "Find top 10 customers by total order volume"</div>
                            <div>SELECT c.name, SUM(o.total_amount) as volume</div>
                            <div>FROM customers c</div>
                            <div>JOIN orders o ON c.id = o.customer_id</div>
                            <div>GROUP BY c.id, c.name</div>
                            <div>ORDER BY volume DESC</div>
                            <div>LIMIT 10;</div>
                        </div>
                    </div>
                );
            // Default behavior for sections not yet fully implemented
            default:
                return (
                    <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
                        <div className="bg-muted p-4 rounded-full">
                            <Layers className="w-12 h-12 text-muted-foreground/50" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">Content under development</h2>
                            <p className="text-muted-foreground">We are currently drafting the detailed guide for <span className="font-mono text-primary">"{sectionId}"</span>.</p>
                        </div>
                        <Button variant="outline" className="mt-4">
                            Request this section
                        </Button>
                    </div>
                );
        }
    };

    return (
        <div className="max-w-3xl mx-auto py-12 px-6">
            {renderContent()}

            <footer className="mt-24 pt-8 border-t border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <button className="hover:text-foreground transition-colors flex items-center gap-1">
                        <Github className="w-4 h-4" /> Edit this page
                    </button>
                    <span>•</span>
                    <span>Last updated March 2026</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Was this helpful?</span>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">👍</Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">👎</Button>
                </div>
            </footer>
        </div>
    );
}
