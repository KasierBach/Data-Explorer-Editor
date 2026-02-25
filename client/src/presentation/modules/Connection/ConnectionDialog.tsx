import React, { useState } from 'react';
import { useAppStore, type Connection } from '@/core/services/store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/select';
import { Label } from '@/presentation/components/ui/label';

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
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add New Connection</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="type" className="text-right">Type</Label>
                        <Select value={type} onValueChange={(v: any) => {
                            setType(v);
                            if (v === 'postgres') { setPort('5432'); setUsername('postgres'); }
                            else if (v === 'mysql') { setPort('3306'); setUsername('root'); }
                            else if (v === 'mssql') { setPort('1433'); setUsername('sa'); }
                        }}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="postgres">PostgreSQL</SelectItem>
                                <SelectItem value="mysql">MySQL</SelectItem>
                                <SelectItem value="mssql">SQL Server</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Name</Label>
                        <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" placeholder="Production DB" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="host" className="text-right">Host</Label>
                        <Input id="host" value={host} onChange={e => setHost(e.target.value)} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="port" className="text-right">Port</Label>
                        <Input id="port" value={port} onChange={e => setPort(e.target.value)} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="username" className="text-right">User</Label>
                        <Input id="username" value={username} onChange={e => setUsername(e.target.value)} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="password" className="text-right">Pasword</Label>
                        <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="database" className="text-right">Database</Label>
                        <Input id="database" value={database} onChange={e => setDatabase(e.target.value)} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="showAll" className="text-right">Show All DBs</Label>
                        <div className="flex items-center space-x-2 col-span-3">
                            <input
                                type="checkbox"
                                id="showAll"
                                checked={showAllDatabases}
                                onChange={e => setShowAllDatabases(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <span className="text-xs text-muted-foreground">List all databases on server</span>
                        </div>
                    </div>
                </div>
                {error && (
                    <div className="text-xs text-red-500 px-1">{error}</div>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={closeConnectionDialog} disabled={isSaving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Connection'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
