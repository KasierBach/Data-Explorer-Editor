import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/core/services/store';
import { ERDWorkspace } from '@/presentation/modules/Visualization/ERDWorkspace';
import { Database, ArrowLeft, Plus, Wifi } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/select';
import { ConnectionDialog } from '@/presentation/modules/Connection/ConnectionDialog';

export function ERDPage() {
    const navigate = useNavigate();
    const activeConnectionId = useAppStore(state => state.activeConnectionId);
    const connections = useAppStore(state => state.connections);
    const activeDatabase = useAppStore(state => state.activeDatabase);
    const setActiveConnectionId = useAppStore(state => state.setActiveConnectionId);
    const openConnectionDialog = useAppStore(state => state.openConnectionDialog);

    // No connections at all → prompt to add one
    if (connections.length === 0) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-background page-enter">
                <div className="text-center space-y-4">
                    <Database className="w-12 h-12 text-muted-foreground mx-auto" />
                    <h2 className="text-xl font-bold">No Connections</h2>
                    <p className="text-muted-foreground">Add a database connection to get started.</p>
                    <div className="flex gap-2 justify-center">
                        <Button variant="outline" onClick={() => navigate('/app')}>Go Back</Button>
                        <Button onClick={() => openConnectionDialog()}>
                            <Plus className="w-4 h-4 mr-2" /> Add Connection
                        </Button>
                    </div>
                </div>
                <ConnectionDialog />
            </div>
        );
    }

    // Has connections but none active → auto-select first, or let user pick
    if (!activeConnectionId) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-background page-enter">
                <div className="text-center space-y-4 max-w-sm">
                    <Wifi className="w-12 h-12 text-muted-foreground mx-auto" />
                    <h2 className="text-xl font-bold">Select Connection</h2>
                    <p className="text-sm text-muted-foreground">Choose a database connection to open the ERD designer.</p>
                    <div className="space-y-2">
                        {connections.map(c => (
                            <button key={c.id} onClick={() => setActiveConnectionId(c.id)}
                                className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card hover:bg-muted/20 transition-all text-left">
                                <Database className="w-4 h-4 text-blue-500 shrink-0" />
                                <div className="min-w-0">
                                    <div className="text-sm font-bold truncate">{c.name}</div>
                                    <div className="text-[10px] text-muted-foreground">{c.type} • {c.host || 'local'}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                    <Button variant="outline" size="sm" className="mt-2" onClick={() => navigate('/app')}>
                        <ArrowLeft className="w-3 h-3 mr-2" /> Go Back
                    </Button>
                </div>
                <ConnectionDialog />
            </div>
        );
    }

    return (
        <div className="h-screen w-full bg-background flex flex-col overflow-hidden page-enter">
            {/* Header with connection selector */}
            <header className="h-12 border-b bg-card flex items-center px-3 md:px-4 justify-between shrink-0 select-none">
                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate('/app')}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div className="h-4 w-px bg-border shrink-0 hidden sm:block" />
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="bg-blue-500/10 p-1.5 rounded-lg">
                            <Database className="w-4 h-4 text-blue-500" />
                        </div>
                        <span className="text-sm font-bold hidden sm:inline">ERD Designer</span>
                    </div>
                    <div className="h-4 w-px bg-border shrink-0 hidden sm:block" />
                    {/* Connection Selector */}
                    <Select value={activeConnectionId} onValueChange={(id) => setActiveConnectionId(id)}>
                        <SelectTrigger className="h-8 w-auto min-w-[100px] sm:min-w-[140px] bg-muted/10 border-border/20 text-xs rounded-lg gap-1 pr-2">
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                <SelectValue />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            {connections.map(c => (
                                <SelectItem key={c.id} value={c.id} className="text-xs">
                                    <span className="font-bold">{c.name}</span>
                                    <span className="text-muted-foreground ml-1.5">({c.type})</span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {activeDatabase && (
                        <span className="text-[10px] text-muted-foreground font-bold hidden md:inline">
                            • {activeDatabase}
                        </span>
                    )}
                </div>
            </header>

            {/* Full-Screen ERD */}
            <div className="flex-1 overflow-hidden">
                <ERDWorkspace
                    tabId={`erd-page-${activeConnectionId}`}
                    connectionId={activeConnectionId}
                    database={activeDatabase || undefined}
                />
            </div>
            <ConnectionDialog />
        </div>
    );
}
