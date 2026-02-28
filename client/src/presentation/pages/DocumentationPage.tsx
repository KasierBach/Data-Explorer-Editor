import React from 'react';
import { Database, ArrowLeft, BookOpen, ExternalLink, Code, Terminal, Layers } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function DocumentationPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <header className="border-b bg-card">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
                        <div className="bg-primary/10 p-2 rounded-xl">
                            <Database className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="font-bold text-lg leading-tight">Data Explorer</h1>
                            <p className="text-xs text-muted-foreground font-medium">Documentation</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/app')}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                </div>
            </header>

            <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="space-y-4 mb-12 text-center md:text-left">
                    <h1 className="text-4xl font-extrabold tracking-tight">Data Explorer Docs</h1>
                    <p className="text-xl text-muted-foreground">
                        Learn how to connect, explore, and analyze your databases with the completely local IDE.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <DocCard
                        icon={<Terminal className="w-6 h-6 text-blue-500" />}
                        title="Getting Started"
                        description="Learn how to connect to your PostgreSQL, MySQL, or SQL Server database securely."
                    />
                    <DocCard
                        icon={<Code className="w-6 h-6 text-emerald-500" />}
                        title="Writing Queries"
                        description="Understand how to use the rich Monaco Editor, run queries, and export your results to CSV/Excel."
                    />
                    <DocCard
                        icon={<Layers className="w-6 h-6 text-purple-500" />}
                        title="Data Visualization"
                        description="Create charts, pivot tables, and view interactive ER diagrams directly from your schema."
                    />
                    <DocCard
                        icon={<BookOpen className="w-6 h-6 text-orange-500" />}
                        title="AI Assistant"
                        description="Use the intelligent AI to write SQL, explain execution plans, and ask questions about your database schema."
                    />
                </div>

                <div className="mt-16 p-8 border rounded-2xl bg-muted/20 text-center space-y-4">
                    <h3 className="text-2xl font-bold">Still need help?</h3>
                    <p className="text-muted-foreground max-w-lg mx-auto">
                        If you encounter any issues or have feature requests, please check out our GitHub repository and open an issue.
                    </p>
                    <Button onClick={() => window.open('https://github.com/KasierBach/Data-Explorer-Editor.git', '_blank')}>
                        Visit GitHub Repository
                    </Button>
                </div>
            </main>
        </div>
    );
}

function DocCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        <div className="p-6 rounded-2xl border bg-card/50 hover:bg-muted/50 transition-colors cursor-pointer group">
            <div className="mb-4 bg-background w-12 h-12 rounded-lg flex items-center justify-center border shadow-sm group-hover:shadow-md transition-shadow">
                {icon}
            </div>
            <h3 className="text-xl font-bold mb-2 flex items-center justify-between">
                {title}
                <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity" />
            </h3>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {description}
            </p>
        </div>
    );
}
