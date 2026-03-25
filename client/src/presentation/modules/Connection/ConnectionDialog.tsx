import React, { useState } from 'react';
import { useAppStore, type Connection } from '@/core/services/store';
import { Dialog, DialogContent } from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/select';
import { Label } from '@/presentation/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/presentation/components/ui/tabs';
import { ShieldAlert, Database, Lock, Globe, Wand2, ShieldCheck } from 'lucide-react';
import { ConnectionService } from '@/core/services/ConnectionService';

export const ConnectionDialog: React.FC = () => {
    const { isConnectionDialogOpen, closeConnectionDialog, addConnection, lang } = useAppStore();
    const t = lang === 'vi';

    const [type, setType] = useState<'postgres' | 'mysql' | 'mssql' | 'mongodb' | 'mongodb+srv'>('postgres');
    const [name, setName] = useState('');
    const [host, setHost] = useState('localhost');
    const [port, setPort] = useState('5432');
    const [username, setUsername] = useState('postgres');
    const [password, setPassword] = useState('');
    const [database, setDatabase] = useState('');
    const [showAllDatabases] = useState(false);
    const [connectionString, setConnectionString] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset form states when dialog opens
    React.useEffect(() => {
        if (isConnectionDialogOpen) {
            setType('postgres');
            setName('');
            setHost('localhost');
            setPort('5432');
            setUsername('postgres');
            setPassword('');
            setDatabase('');
            setConnectionString('');
            setError(null);
            setIsSaving(false);
        }
    }, [isConnectionDialogOpen]);

    const isMongoType = type === 'mongodb' || type === 'mongodb+srv';

    const parseConnectionString = () => {
        try {
            if (!connectionString.trim()) return;
            const raw = connectionString.trim();

            // Detect MongoDB URI before URL parsing (mongodb+srv uses non-standard protocol)
            if (raw.startsWith('mongodb+srv://')) {
                setType('mongodb+srv');
                const url = new URL(raw.replace('mongodb+srv://', 'http://'));
                if (url.hostname) setHost(url.hostname);
                setPort(''); // SRV doesn't use port
                if (url.username) setUsername(decodeURIComponent(url.username));
                if (url.password) setPassword(decodeURIComponent(url.password));
                if (url.pathname && url.pathname.length > 1) setDatabase(decodeURIComponent(url.pathname.substring(1)));
                if (!name) setName(`MongoDB Atlas @ ${url.hostname}`);
                setError(null);
                return;
            }
            if (raw.startsWith('mongodb://')) {
                setType('mongodb');
                const url = new URL(raw.replace('mongodb://', 'http://'));
                if (url.hostname) setHost(url.hostname);
                setPort(url.port || '27017');
                if (url.username) setUsername(decodeURIComponent(url.username));
                if (url.password) setPassword(decodeURIComponent(url.password));
                if (url.pathname && url.pathname.length > 1) setDatabase(decodeURIComponent(url.pathname.substring(1)));
                if (!name) setName(`MongoDB @ ${url.hostname}`);
                setError(null);
                return;
            }

            const url = new URL(raw);

            let parsedType: 'postgres' | 'mysql' | 'mssql' = 'postgres';
            if (url.protocol.includes('postgres')) {
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
                if (parsedType === 'postgres') setPort('5432');
                if (parsedType === 'mysql') setPort('3306');
                if (parsedType === 'mssql') setPort('1433');
            }

            if (url.username) setUsername(decodeURIComponent(url.username));
            if (url.password) setPassword(decodeURIComponent(url.password));
            if (url.pathname && url.pathname.length > 1) {
                setDatabase(decodeURIComponent(url.pathname.substring(1)));
            }
            if (!name) setName(`${parsedType} @ ${url.hostname}`);
            setError(null);
        } catch (err) {
            setError(t ? "Sai định dạng Connection String. VD: postgresql://user:pass@localhost:5432/mydb" : "Invalid Connection String format. Example: postgresql://user:pass@localhost:5432/mydb");
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);

        const connectionData: any = {
            name: name || `${type}@${host}`,
            type,
            host,
            username,
            password,
            showAllDatabases
        };

        const parsedPort = parseInt(port);
        if (!isNaN(parsedPort)) connectionData.port = parsedPort;
        if (database && database.trim() !== '') connectionData.database = database.trim();

        try {
            const savedConnection = await ConnectionService.createConnection(connectionData);
            
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
            <DialogContent className="max-w-[520px] p-0 overflow-hidden bg-background border-border/50 shadow-2xl rounded-xl">
                <div className="flex flex-col max-h-[80vh]">
                    {/* Header */}
                    <div className="px-6 pt-5 pb-4 border-b shrink-0">
                        <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                            <Database className="w-5 h-5 text-violet-500" />
                            {t ? 'Thêm kết nối mới' : 'Add New Connection'}
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">{t ? 'Cấu hình thông tin để truy cập database.' : 'Configure credentials to access your database.'}</p>
                    </div>

                    {/* Scrollable Body */}
                    <div className="flex-1 overflow-y-auto px-6 py-4">
                        {error && (
                            <div className="mb-4 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2.5">
                                <ShieldAlert className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                                <div className="text-xs text-red-600 dark:text-red-400">
                                    <span className="font-semibold block mb-0.5">{t ? 'Lỗi kết nối' : 'Connection Failed'}</span>
                                    {error}
                                </div>
                            </div>
                        )}

                        <Tabs defaultValue="form" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-4 h-9">
                                <TabsTrigger value="form" className="text-xs">{t ? 'Form Chuẩn' : 'Standard Form'}</TabsTrigger>
                                <TabsTrigger value="string" className="text-xs">{t ? 'Chuỗi kết nối' : 'Connection String'}</TabsTrigger>
                            </TabsList>

                            <TabsContent value="string" className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="connectionString" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t ? 'Dán URI / Connection String' : 'Paste URI / Connection String'}</Label>
                                    <textarea
                                        id="connectionString"
                                        className="w-full h-24 rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono whitespace-pre-wrap"
                                        placeholder={isMongoType ? "mongodb+srv://user:pass@cluster0.abc.mongodb.net/mydb" : "postgresql://user:password@localhost:5432/mydatabase"}
                                        value={connectionString}
                                        onChange={(e) => setConnectionString(e.target.value)}
                                    />
                                </div>
                                <Button type="button" variant="secondary" size="sm" className="w-full font-medium text-xs h-8" onClick={parseConnectionString}>
                                    <Wand2 className="w-3.5 h-3.5 mr-1.5 text-violet-500" />
                                    {t ? 'Tự động điền Form' : 'Parse & Fill Form'}
                                </Button>
                            </TabsContent>

                            <TabsContent value="form" className="space-y-4 m-0">
                                {/* Type + Name */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t ? 'Loại Database' : 'Database Type'}</Label>
                                        <Select value={type} onValueChange={(v: any) => {
                                            setType(v);
                                            if (v === 'postgres') { setPort('5432'); setUsername('postgres'); setHost('localhost'); }
                                            else if (v === 'mysql') { setPort('3306'); setUsername('root'); setHost('localhost'); }
                                            else if (v === 'mssql') { setPort('1433'); setUsername('sa'); setHost('localhost'); }
                                            else if (v === 'mongodb') { setPort('27017'); setUsername(''); setHost('localhost'); }
                                            else if (v === 'mongodb+srv') { setPort(''); setUsername(''); setHost(''); }
                                        }}>
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="postgres"><div className="flex items-center gap-2 text-xs"><div className="w-2 h-2 rounded-full bg-blue-500" />PostgreSQL</div></SelectItem>
                                                <SelectItem value="mysql"><div className="flex items-center gap-2 text-xs"><div className="w-2 h-2 rounded-full bg-orange-500" />MySQL</div></SelectItem>
                                                <SelectItem value="mssql"><div className="flex items-center gap-2 text-xs"><div className="w-2 h-2 rounded-full bg-red-500" />SQL Server</div></SelectItem>
                                                <SelectItem value="mongodb"><div className="flex items-center gap-2 text-xs"><div className="w-2 h-2 rounded-full bg-green-500" />MongoDB</div></SelectItem>
                                                <SelectItem value="mongodb+srv"><div className="flex items-center gap-2 text-xs"><div className="w-2 h-2 rounded-full bg-emerald-500" />MongoDB Atlas (SRV)</div></SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t ? 'Tên hiển thị' : 'Display Name'}</Label>
                                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Production DB" className="h-9 text-xs" />
                                    </div>
                                </div>

                                <div className="h-px bg-border/40 w-full" />

                                {/* Network */}
                                <div className="space-y-2.5">
                                    <div className="flex items-center gap-1.5 text-xs font-medium"><Globe className="w-3.5 h-3.5 text-muted-foreground" /> {t ? 'Chi tiết mạng' : 'Network Details'}</div>
                                    <div className={`grid gap-3 ${type === 'mongodb+srv' ? 'grid-cols-1' : 'grid-cols-3'}`}>
                                        <div className={type === 'mongodb+srv' ? '' : 'col-span-2'}>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] text-muted-foreground">{isMongoType ? 'Hostname / Cluster' : 'Host'}</Label>
                                                <Input value={host} onChange={e => setHost(e.target.value)} placeholder={isMongoType ? 'cluster0.xxxxx.mongodb.net' : 'localhost'} className="h-9 font-mono text-xs" />
                                            </div>
                                        </div>
                                        {type !== 'mongodb+srv' && (
                                            <div className="col-span-1 space-y-1">
                                                <Label className="text-[10px] text-muted-foreground">Port</Label>
                                                <Input value={port} onChange={e => setPort(e.target.value)} className="h-9 font-mono text-xs" />
                                            </div>
                                        )}
                                    </div>
                                    {isMongoType && (
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">{t ? 'Database (Tùy chọn)' : 'Database (Optional)'}</Label>
                                            <Input value={database} onChange={e => setDatabase(e.target.value)} placeholder="mydb" className="h-9 font-mono text-xs" />
                                        </div>
                                    )}
                                </div>

                                <div className="h-px bg-border/40 w-full" />

                                {/* Auth */}
                                <div className="space-y-2.5">
                                    <div className="flex items-center gap-1.5 text-xs font-medium"><Lock className="w-3.5 h-3.5 text-muted-foreground" /> {t ? 'Xác thực' : 'Authentication'}</div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">{t ? 'Tên đăng nhập' : 'Username'}</Label>
                                            <Input value={username} onChange={e => setUsername(e.target.value)} className="h-9 text-xs" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">{t ? 'Mật khẩu' : 'Password'}</Label>
                                            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="h-9 text-xs" />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                        <span className="text-[10px] font-medium text-muted-foreground">
                                            {t ? 'Mã hóa AES-256-GCM • SSL Mode tự động' : 'AES-256-GCM Encrypted • Auto SSL Mode'}
                                        </span>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-3 border-t border-border flex justify-end gap-2.5 shrink-0 bg-muted/20">
                        <Button variant="ghost" size="sm" onClick={closeConnectionDialog} disabled={isSaving} className="text-xs h-8">{t ? 'Hủy' : 'Cancel'}</Button>
                        <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-violet-600 hover:bg-violet-700 text-white min-w-[120px] text-xs h-8">
                            {isSaving ? (t ? 'Đang kết nối...' : 'Connecting...') : (t ? 'Lưu & Kết nối' : 'Save & Connect')}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
