import React, { useState } from 'react';
import { useAppStore, type Connection } from '@/core/services/store';
import { Dialog, DialogContent } from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/select';
import { Label } from '@/presentation/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/presentation/components/ui/tabs';
import { Server, ShieldAlert, Key, Zap, HelpCircle, Database, Lock, Globe, Wand2, ShieldCheck } from 'lucide-react';
import { ConnectionService } from '@/core/services/ConnectionService';

export const ConnectionDialog: React.FC = () => {
    const { isConnectionDialogOpen, closeConnectionDialog, addConnection, lang } = useAppStore();
    const t = lang === 'vi';

    const [type, setType] = useState<'postgres' | 'mysql' | 'mssql'>('postgres');
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

    const parseConnectionString = () => {
        try {
            if (!connectionString.trim()) return;
            const url = new URL(connectionString.trim());

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
            <DialogContent className="max-w-[850px] p-0 overflow-hidden bg-background border-border/50 shadow-2xl rounded-xl max-h-[90vh]">
                <div className="flex h-[620px] max-h-[90vh]">
                    {/* Left Form Area */}
                    <div className="w-[55%] p-6 overflow-y-auto flex flex-col">
                        <div className="mb-4 shrink-0">
                            <h2 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2">
                                <Database className="w-6 h-6 text-violet-500" />
                                {t ? 'Thêm kết nối mới' : 'Add New Connection'}
                            </h2>
                            <p className="text-sm text-muted-foreground">{t ? 'Cấu hình thông tin để truy cập database của bạn.' : 'Configure the credentials to access your database.'}</p>
                        </div>

                        {error && (
                            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                                <ShieldAlert className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                                <div className="text-sm text-red-600 dark:text-red-400">
                                    <span className="font-semibold block mb-0.5">{t ? 'Lỗi kết nối' : 'Connection Failed'}</span>
                                    {error}
                                </div>
                            </div>
                        )}

                        <Tabs defaultValue="form" className="w-full flex-1 flex flex-col">
                            <TabsList className="grid w-full grid-cols-2 mb-6">
                                <TabsTrigger value="form">{t ? 'Form Chuẩn' : 'Standard Form'}</TabsTrigger>
                                <TabsTrigger value="string">{t ? 'Chuỗi kết nối' : 'Connection String'}</TabsTrigger>
                            </TabsList>

                            <TabsContent value="string" className="space-y-4 flex-1">
                                <div className="space-y-2">
                                    <Label htmlFor="connectionString" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t ? 'Dán URI / Connection String' : 'Paste URI / Connection String'}</Label>
                                    <textarea
                                        id="connectionString"
                                        className="w-full h-32 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono whitespace-pre-wrap"
                                        placeholder="postgresql://user:password@localhost:5432/mydatabase"
                                        value={connectionString}
                                        onChange={(e) => setConnectionString(e.target.value)}
                                    />
                                </div>
                                <Button type="button" variant="secondary" className="w-full font-medium" onClick={parseConnectionString}>
                                    <Wand2 className="w-4 h-4 mr-2 text-violet-500" />
                                    {t ? 'Tự động điền Form' : 'Parse & Fill Form'}
                                </Button>
                            </TabsContent>

                            <TabsContent value="form" className="space-y-6 flex-1 m-0">
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t ? 'Loại Database' : 'Database Type'}</Label>
                                            <Select value={type} onValueChange={(v: any) => {
                                                setType(v);
                                                if (v === 'postgres') { setPort('5432'); setUsername('postgres'); }
                                                else if (v === 'mysql') { setPort('3306'); setUsername('root'); }
                                                else if (v === 'mssql') { setPort('1433'); setUsername('sa'); }
                                            }}>
                                                <SelectTrigger className="h-10">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="postgres"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500" />PostgreSQL</div></SelectItem>
                                                    <SelectItem value="mysql"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-500" />MySQL</div></SelectItem>
                                                    <SelectItem value="mssql"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500" />SQL Server</div></SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t ? 'Tên hiển thị' : 'Display Name'}</Label>
                                            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Production DB" className="h-10" />
                                        </div>
                                    </div>
                                </div>

                                <div className="h-px bg-border/50 w-full" />

                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-sm font-medium"><Globe className="w-4 h-4 text-muted-foreground" /> {t ? 'Chi tiết mạng' : 'Network Details'}</div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="col-span-2 space-y-1.5">
                                            <Label className="text-xs text-muted-foreground">Host</Label>
                                            <Input value={host} onChange={e => setHost(e.target.value)} placeholder="localhost" className="h-10 font-mono text-sm" />
                                        </div>
                                        <div className="col-span-1 space-y-1.5">
                                            <Label className="text-xs text-muted-foreground">Port</Label>
                                            <Input value={port} onChange={e => setPort(e.target.value)} className="h-10 font-mono text-sm" />
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                                        <h5 className="text-[10px] font-black uppercase text-blue-600 mb-1">Pro Tip: Port Mapping</h5>
                                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                                            {t ? 'Nếu dùng Docker, hãy đảm bảo Port đã được mapped ra máy host.' : 'If using Docker, ensure Port is mapped to host machine.'}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-sm font-medium"><Lock className="w-4 h-4 text-muted-foreground" /> {t ? 'Xác thực & Bảo mật' : 'Authentication & Security'}</div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-muted-foreground">{t ? 'Tên đăng nhập' : 'Username'}</Label>
                                            <Input value={username} onChange={e => setUsername(e.target.value)} className="h-10 text-sm" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-muted-foreground">{t ? 'Mật khẩu' : 'Password'}</Label>
                                            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="h-10" />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
                                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                        <span className="text-[11px] font-medium text-muted-foreground">
                                            {t ? 'Tự động bật SSL Mode (Prefer) cho kết nối' : 'Automatic SSL Mode (Prefer) enabled'}
                                        </span>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>

                        <div className="mt-6 pt-4 border-t border-border flex justify-end gap-3 shrink-0">
                            <Button variant="ghost" onClick={closeConnectionDialog} disabled={isSaving}>{t ? 'Hủy' : 'Cancel'}</Button>
                            <Button onClick={handleSave} disabled={isSaving} className="bg-violet-600 hover:bg-violet-700 text-white min-w-[140px]">
                                {isSaving ? (t ? 'Đang kết nối...' : 'Connecting...') : (t ? 'Lưu & Kết nối' : 'Save & Connect')}
                            </Button>
                        </div>
                    </div>

                    {/* Right Info Panel */}
                    <div className="w-[45%] bg-muted/30 border-l p-6 flex flex-col relative overflow-y-auto">
                        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl" />
                        <div className="relative z-10">
                            <h3 className="text-lg font-semibold flex items-center gap-2 mb-6">
                                <HelpCircle className="w-5 h-5 text-violet-500" />
                                {t ? 'Hướng dẫn kết nối' : 'Connection Guide'}
                            </h3>
                            <div className="space-y-4 text-xs">
                                <div className="p-4 bg-background/80 border rounded-lg shadow-sm">
                                    <h4 className="font-bold flex items-center gap-2 mb-2"><Server className="w-4 h-4 text-blue-500" /> Cloud Databases</h4>
                                    <p className="text-muted-foreground leading-relaxed">{t ? 'Whitelist địa chỉ IP của server này trong cấu hình Firewall của Cloud Provider (AWS, Supabase, Neon).' : 'Whitelist this server\'s IP in your Cloud Provider\'s Firewall (AWS, Supabase, Neon).'}</p>
                                </div>
                                <div className="p-4 bg-background/80 border rounded-lg shadow-sm">
                                    <h4 className="font-bold flex items-center gap-2 mb-2"><Zap className="w-4 h-4 text-orange-500" /> Default Ports</h4>
                                    <div className="space-y-1">
                                        <div className="flex justify-between"><span>Postgres</span><strong>5432</strong></div>
                                        <div className="flex justify-between"><span>MySQL</span><strong>3306</strong></div>
                                        <div className="flex justify-between"><span>SQL Server</span><strong>1433</strong></div>
                                    </div>
                                </div>
                                <div className="p-4 bg-background/80 border rounded-lg shadow-sm">
                                    <h4 className="font-bold flex items-center gap-2 mb-2"><Key className="w-4 h-4 text-green-500" /> {t ? 'Mã hóa an toàn' : 'Secure Encryption'}</h4>
                                    <p className="text-muted-foreground leading-relaxed">{t ? 'Thông tin đăng nhập của bạn được mã hóa AES-256-GCM trước khi lưu trữ.' : 'Your credentials are AES-256-GCM encrypted before storage.'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
