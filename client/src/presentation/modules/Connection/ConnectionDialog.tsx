import React, { useState } from 'react';
import { useAppStore, type Connection } from '@/core/services/store';
import { Dialog, DialogContent } from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/select';
import { Label } from '@/presentation/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/presentation/components/ui/tabs';
import { Server, ShieldAlert, Key, Zap, CheckCircle2, HelpCircle, Database, Lock, Globe, Wand2 } from 'lucide-react';

export const ConnectionDialog: React.FC = () => {
    const { isConnectionDialogOpen, closeConnectionDialog, addConnection, accessToken } = useAppStore();

    const [type, setType] = useState<'postgres' | 'mysql' | 'mssql'>('postgres');
    const [name, setName] = useState('');
    const [host, setHost] = useState('localhost');
    const [port, setPort] = useState('5432');
    const [username, setUsername] = useState('postgres');
    const [password, setPassword] = useState('');
    const [database, setDatabase] = useState('');
    const [showAllDatabases, setShowAllDatabases] = useState(false);
    const [connectionString, setConnectionString] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const parseConnectionString = () => {
        try {
            if (!connectionString.trim()) return;

            // Handle common prefixes
            let uri = connectionString.trim();
            // Optional: convert standard jdbc/odbc formats if needed, for now just handle standard URIs

            const url = new URL(uri);

            // Determine type
            let parsedType: 'postgres' | 'mysql' | 'mssql' = 'postgres';
            if (url.protocol.includes('postgres') || url.protocol.includes('postgresql')) {
                parsedType = 'postgres';
                setType('postgres');
            } else if (url.protocol.includes('mysql')) {
                parsedType = 'mysql';
                setType('mysql');
            } else if (url.protocol.includes('mssql') || url.protocol.includes('sqlserver')) {
                parsedType = 'mssql';
                setType('mssql');
            }

            if (url.hostname) setHost(url.hostname);

            if (url.port) {
                setPort(url.port);
            } else {
                // Set default ports if none provided
                if (parsedType === 'postgres') setPort('5432');
                if (parsedType === 'mysql') setPort('3306');
                if (parsedType === 'mssql') setPort('1433');
            }

            if (url.username) setUsername(decodeURIComponent(url.username));
            if (url.password) setPassword(decodeURIComponent(url.password));

            // DB name is the pathname without the leading slash
            if (url.pathname && url.pathname.length > 1) {
                setDatabase(decodeURIComponent(url.pathname.substring(1)));
            }

            // Auto-generate a name if empty
            if (!name) {
                setName(`${parsedType} @ ${url.hostname}`);
            }

            setError(null);
        } catch (err) {
            setError("Invalid Connection String format. Example: postgresql://user:pass@localhost:5432/mydb");
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);

        const connectionData = {
            name: name || `${type}@${host}`,
            type,
            host,
            port: parseInt(port),
            username,
            password,
            database,
            showAllDatabases
        };

        try {
            // Call backend API first to register and get UUID
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

            const response = await fetch('http://localhost:3000/api/connections', {
                method: 'POST',
                headers,
                body: JSON.stringify(connectionData),
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || response.statusText);
            }

            const savedConnection = await response.json();

            // Use backend UUID as the connection ID in store
            const newConnection: Connection = {
                id: savedConnection.id,
                name: savedConnection.name,
                type: savedConnection.type,
                host: savedConnection.host,
                port: savedConnection.port,
                username: savedConnection.username,
                password: savedConnection.password,
                database: savedConnection.database,
                showAllDatabases: savedConnection.showAllDatabases,
            };
            addConnection(newConnection);
            closeConnectionDialog();
            // Reset form
            setName('');
            setPassword('');
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to save connection');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isConnectionDialogOpen} onOpenChange={closeConnectionDialog}>
            <DialogContent className="max-w-[850px] p-0 overflow-hidden bg-background border-border/50 shadow-2xl rounded-xl max-h-[90vh]">
                <div className="flex h-[620px] max-h-[90vh]">
                    {/* Left Form Area */}
                    <div className="w-[55%] p-6 overflow-y-auto flex flex-col">
                        <div className="mb-4 shrink-0">
                            <h2 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2">
                                <Database className="w-6 h-6 text-violet-500" />
                                Add New Connection
                            </h2>
                            <p className="text-sm text-muted-foreground">Configure the credentials to access your database.</p>
                        </div>

                        {error && (
                            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                                <ShieldAlert className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                                <div className="text-sm text-red-600 dark:text-red-400">
                                    <span className="font-semibold block mb-0.5">Connection Failed</span>
                                    {error}
                                </div>
                            </div>
                        )}

                        <Tabs defaultValue="form" className="w-full flex-1 flex flex-col">
                            <TabsList className="grid w-full grid-cols-2 mb-6">
                                <TabsTrigger value="form">Standard Form</TabsTrigger>
                                <TabsTrigger value="string">Connection String</TabsTrigger>
                            </TabsList>

                            <TabsContent value="string" className="space-y-4 flex-1">
                                <div className="space-y-2">
                                    <Label htmlFor="connectionString" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Paste URI / Connection String</Label>
                                    <textarea
                                        id="connectionString"
                                        className="w-full h-32 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono whitespace-pre-wrap"
                                        placeholder="postgresql://user:password@localhost:5432/mydatabase"
                                        value={connectionString}
                                        onChange={(e) => setConnectionString(e.target.value)}
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="w-full font-medium"
                                    onClick={parseConnectionString}
                                >
                                    <Wand2 className="w-4 h-4 mr-2 text-violet-500" />
                                    Parse & Fill Form
                                </Button>
                                <div className="p-4 bg-muted/50 rounded-lg border mt-4">
                                    <p className="text-xs text-muted-foreground text-center">
                                        Parsing will automatically populate the Standard Form fields. You can review them before saving.
                                    </p>
                                </div>
                            </TabsContent>

                            <TabsContent value="form" className="space-y-6 flex-1 m-0">
                                {/* General */}
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="type" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Database Type</Label>
                                            <Select value={type} onValueChange={(v: any) => {
                                                setType(v);
                                                if (v === 'postgres') { setPort('5432'); setUsername('postgres'); }
                                                else if (v === 'mysql') { setPort('3306'); setUsername('root'); }
                                                else if (v === 'mssql') { setPort('1433'); setUsername('sa'); }
                                            }}>
                                                <SelectTrigger className="h-10">
                                                    <SelectValue placeholder="Select Type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="postgres">
                                                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div>PostgreSQL</div>
                                                    </SelectItem>
                                                    <SelectItem value="mysql">
                                                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-500"></div>MySQL</div>
                                                    </SelectItem>
                                                    <SelectItem value="mssql">
                                                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div>SQL Server</div>
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Display Name</Label>
                                            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Production DB" className="h-10" />
                                        </div>
                                    </div>
                                </div>

                                <div className="h-px bg-border/50 w-full" />

                                {/* Network */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-sm font-medium">
                                        <Globe className="w-4 h-4 text-muted-foreground" /> Connection Details
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="col-span-2 space-y-1.5">
                                            <Label htmlFor="host" className="text-xs text-muted-foreground">Host</Label>
                                            <Input id="host" value={host} onChange={e => setHost(e.target.value)} placeholder="localhost or cloud URI" className="h-10 font-mono text-sm" />
                                        </div>
                                        <div className="col-span-1 space-y-1.5">
                                            <Label htmlFor="port" className="text-xs text-muted-foreground">Port</Label>
                                            <Input id="port" value={port} onChange={e => setPort(e.target.value)} className="h-10 font-mono text-sm" />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="database" className="text-xs text-muted-foreground">Target Database (Optional)</Label>
                                        <Input id="database" value={database} onChange={e => setDatabase(e.target.value)} placeholder="Default DB if left blank" className="h-10 font-mono text-sm" />
                                    </div>
                                </div>

                                <div className="h-px bg-border/50 w-full" />

                                {/* Auth */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-sm font-medium">
                                        <Lock className="w-4 h-4 text-muted-foreground" /> Authentication
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="username" className="text-xs text-muted-foreground">Username</Label>
                                            <Input id="username" value={username} onChange={e => setUsername(e.target.value)} className="h-10 font-mono text-sm" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="password" className="text-xs text-muted-foreground">Password</Label>
                                            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} className="h-10 font-mono text-sm" placeholder="••••••••" />
                                        </div>
                                    </div>
                                </div>

                                {/* Options */}
                                <div className="pt-2 pb-2">
                                    <label className="flex items-center space-x-3 cursor-pointer group w-fit">
                                        <div className="relative flex items-center justify-center">
                                            <input
                                                type="checkbox"
                                                checked={showAllDatabases}
                                                onChange={e => setShowAllDatabases(e.target.checked)}
                                                className="peer sr-only"
                                            />
                                            <div className="w-5 h-5 border-2 rounded border-muted-foreground peer-checked:bg-violet-500 peer-checked:border-violet-500 transition-colors"></div>
                                            <CheckCircle2 className="w-3.5 h-3.5 text-white absolute opacity-0 peer-checked:opacity-100 transition-opacity" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium group-hover:text-foreground transition-colors">Show all databases on server</span>
                                        </div>
                                    </label>
                                </div>
                            </TabsContent>
                        </Tabs>

                        <div className="mt-6 pt-4 border-t border-border flex justify-end gap-3 shrink-0">
                            <Button variant="ghost" onClick={closeConnectionDialog} disabled={isSaving}>Cancel</Button>
                            <Button onClick={handleSave} disabled={isSaving} className="bg-violet-600 hover:bg-violet-700 text-white min-w-[140px]">
                                {isSaving ? 'Connecting...' : 'Save & Connect'}
                            </Button>
                        </div>
                    </div>

                    {/* Right Info Panel */}
                    <div className="w-[45%] bg-muted/30 border-l p-6 flex flex-col relative overflow-y-auto">
                        {/* Decorative background shapes */}
                        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl"></div>

                        <div className="relative z-10">
                            <h3 className="text-lg font-semibold flex items-center gap-2 mb-6">
                                <HelpCircle className="w-5 h-5 text-violet-500" />
                                Connection Guide
                            </h3>

                            <div className="space-y-6">
                                <div className="bg-background/80 backdrop-blur-sm border rounded-lg p-4 shadow-sm">
                                    <h4 className="text-sm font-bold flex items-center gap-2 mb-2">
                                        <Server className="w-4 h-4 text-blue-500" />
                                        Connecting to Cloud DBs
                                    </h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                                        Data Explorer can connect directly to cloud databases like <strong>AWS RDS, Supabase, Neon, or PlanetScale</strong>. Just paste the Endpoint/Host URI into the Host field.
                                    </p>
                                    <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2 text-[11px] text-blue-600 dark:text-blue-400 font-medium flex items-start gap-2">
                                        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span><strong>Crucial Step:</strong> Ensure you have whitelisted your current IP address (Inbound Rules) in your Cloud Provider's firewall settings, otherwise the connection will timeout.</span>
                                    </div>
                                </div>

                                <div className="bg-background/80 backdrop-blur-sm border rounded-lg p-4 shadow-sm">
                                    <h4 className="text-sm font-bold flex items-center gap-2 mb-3">
                                        <Zap className="w-4 h-4 text-orange-500" />
                                        Common Default Ports
                                    </h4>
                                    <ul className="space-y-2 text-xs">
                                        <li className="flex justify-between items-center bg-muted/50 px-2 py-1.5 rounded">
                                            <span className="font-medium">PostgreSQL</span>
                                            <code className="bg-background px-1.5 py-0.5 rounded border text-muted-foreground">5432</code>
                                        </li>
                                        <li className="flex justify-between items-center bg-muted/50 px-2 py-1.5 rounded">
                                            <span className="font-medium">MySQL</span>
                                            <code className="bg-background px-1.5 py-0.5 rounded border text-muted-foreground">3306</code>
                                        </li>
                                        <li className="flex justify-between items-center bg-muted/50 px-2 py-1.5 rounded">
                                            <span className="font-medium">SQL Server</span>
                                            <code className="bg-background px-1.5 py-0.5 rounded border text-muted-foreground">1433</code>
                                        </li>
                                    </ul>
                                </div>

                                <div className="bg-background/80 backdrop-blur-sm border rounded-lg p-4 shadow-sm">
                                    <h4 className="text-sm font-bold flex items-center gap-2 mb-2">
                                        <Key className="w-4 h-4 text-green-500" />
                                        Security Notice
                                    </h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Your credentials are encrypted before being stored for the session. Data Explorer establishes a direct, secure TCP pipeline to your database.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
