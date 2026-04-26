import React, { useState } from 'react';
import { useAppStore, type Connection } from '@/core/services/store';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/select';
import { Label } from '@/presentation/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/presentation/components/ui/tabs';
import { ShieldAlert, Database, Lock, Globe, Wand2, ShieldCheck, FileWarning, Users, Activity, CheckCircle2, XCircle, Info } from 'lucide-react';
import { ConnectionService } from '@/core/services/ConnectionService';
import { OrganizationService, type OrganizationEntity } from '@/core/services/OrganizationService';


export const ConnectionDialog: React.FC = () => {
    const { isConnectionDialogOpen, closeConnectionDialog, addConnection, lang } = useAppStore();
    const t = lang === 'vi';

    const [type, setType] = useState<'postgres' | 'mysql' | 'mssql' | 'mongodb' | 'mongodb+srv' | 'sqlite' | 'clickhouse'>('postgres');
    const [name, setName] = useState('');
    const [host, setHost] = useState('localhost');
    const [port, setPort] = useState('5432');
    const [username, setUsername] = useState('postgres');
    const [password, setPassword] = useState('');
    const [database, setDatabase] = useState('');
    const [showAllDatabases] = useState(false);
    const [readOnly, setReadOnly] = useState(false);
    const [allowSchemaChanges, setAllowSchemaChanges] = useState(true);
    const [allowImportExport, setAllowImportExport] = useState(true);
    const [allowQueryExecution, setAllowQueryExecution] = useState(true);
    const [connectionString, setConnectionString] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ status: 'healthy' | 'error'; latency?: number; error?: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [teams, setTeams] = useState<OrganizationEntity[]>([]);
    const [organizationId, setOrganizationId] = useState<string>('none');

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
            setReadOnly(false);
            setAllowSchemaChanges(true);
            setAllowImportExport(true);
            setAllowQueryExecution(true);
            setConnectionString('');
            setError(null);
            setTestResult(null);
            setIsSaving(false);
            setOrganizationId('none');
            // Load teams
            OrganizationService.getMyOrganizations()
                .then(setTeams)
                .catch(() => setTeams([]));
        }
    }, [isConnectionDialogOpen]);

    const isMongoType = type === 'mongodb' || type === 'mongodb+srv';
    const isFileType = type === 'sqlite';

    const parseConnectionString = () => {
        try {
            if (!connectionString.trim()) return;
            const raw = connectionString.trim();

            if (raw.startsWith('mongodb+srv://')) {
                setType('mongodb+srv');
                const url = new URL(raw.replace('mongodb+srv://', 'http://'));
                if (url.hostname) setHost(url.hostname);
                setPort('');
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
            let parsedType: 'postgres' | 'mysql' | 'mssql' | 'clickhouse' = 'postgres';
            if (url.protocol.includes('postgres')) {
                parsedType = 'postgres';
                setType('postgres');
            } else if (url.protocol.includes('mysql')) {
                parsedType = 'mysql';
                setType('mysql');
            } else if (url.protocol.includes('mssql') || url.protocol.includes('sqlserver')) {
                parsedType = 'mssql';
                setType('mssql');
            } else if (url.protocol.includes('clickhouse')) {
                parsedType = 'clickhouse';
                setType('clickhouse');
            }

            if (url.hostname) setHost(url.hostname);
            if (url.port) setPort(url.port);
            else {
                if (parsedType === 'postgres') setPort('5432');
                if (parsedType === 'mysql') setPort('3306');
                if (parsedType === 'mssql') setPort('1433');
                if (parsedType === 'clickhouse') setPort('8123');
            }

            if (url.username) setUsername(decodeURIComponent(url.username));
            if (url.password) setPassword(decodeURIComponent(url.password));
            if (url.pathname && url.pathname.length > 1) setDatabase(decodeURIComponent(url.pathname.substring(1)));
            if (!name) setName(`${parsedType} @ ${url.hostname}`);
            setError(null);
        } catch (err) {
            setError(t ? "Sai định dạng Connection String." : "Invalid Connection String format.");
        }
    };

    const getConnectionData = () => {
        const data: any = {
            name: name || `${type}@${host}`,
            type,
            host: isFileType ? undefined : host,
            username: isFileType ? undefined : username,
            password: isFileType ? undefined : password,
            showAllDatabases,
            readOnly,
            allowSchemaChanges: readOnly ? false : allowSchemaChanges,
            allowImportExport: readOnly ? false : allowImportExport,
            allowQueryExecution,
            ...(organizationId && organizationId !== 'none' ? { organizationId } : {}),
        };

        const parsedPort = parseInt(port);
        if (!isNaN(parsedPort)) data.port = parsedPort;
        if (database && database.trim() !== '') data.database = database.trim();
        return data;
    };

    const handleTest = async () => {
        setIsTesting(true);
        setTestResult(null);
        try {
            const data = getConnectionData();
            const result = await ConnectionService.testConnection(data);
            setTestResult({
                status: result.status as any,
                latency: result.latencyMs,
                error: result.error || undefined
            });
        } catch (err: any) {
            setTestResult({
                status: 'error',
                error: err.message || 'Unknown error'
            });
        } finally {
            setIsTesting(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        try {
            const connectionData = getConnectionData();
            const savedConnection = await ConnectionService.createConnection(connectionData);
            
            const newConnection: Connection = {
                ...savedConnection,
                id: savedConnection.id,
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
            <DialogContent className="max-w-[600px] p-0 overflow-hidden bg-background border-border/50 shadow-2xl rounded-2xl flex flex-col max-h-[90vh]">
                <div className="bg-gradient-to-r from-violet-600/10 via-transparent to-transparent px-6 py-5 border-b shrink-0 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5 scale-150 rotate-12">
                        <Database className="w-16 h-16" />
                    </div>
                    <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/20">
                            <Activity className="w-4 h-4" />
                        </div>
                        {t ? 'Thiết lập kết nối' : 'Connection Setup'}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-1 text-balance">
                        {t ? 'Khởi tạo luồng truy cập mới tới cơ sở dữ liệu của bạn. Chúng tôi bảo mật mọi thông tin bằng AES-256.' : 'Initialize a new connection to your database. We secure all information using AES-256 standard.'}
                    </DialogDescription>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide">
                    {/* Error Notification */}
                    {error && (
                        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                            <ShieldAlert className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                            <div className="text-xs text-red-600 dark:text-red-400">
                                <span className="font-bold block mb-0.5">{t ? 'Lưu kết nối thất bại' : 'Failed to Save'}</span>
                                {error}
                            </div>
                        </div>
                    )}

                    <Tabs defaultValue="form" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-6 h-10 p-1 bg-muted/50 rounded-xl">
                            <TabsTrigger value="form" className="text-xs font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                <Wand2 className="w-3.5 h-3.5 mr-2" />
                                {t ? 'Form Chuẩn' : 'Standard Form'}
                            </TabsTrigger>
                            <TabsTrigger value="string" className="text-xs font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                <Lock className="w-3.5 h-3.5 mr-2" />
                                {t ? 'Chuỗi kết nối' : 'Connection String'}
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="string" className="space-y-4 animate-in fade-in-50">
                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{t ? 'Dán URI / Connection String' : 'Paste URI / Connection String'}</Label>
                                <textarea
                                    className="w-full h-32 rounded-xl border border-input bg-muted/20 px-4 py-3 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/20 focus-visible:border-violet-500/50 font-mono transition-all resize-none"
                                    placeholder={isMongoType ? "mongodb+srv://user:pass@cluster0.abc.mongodb.net/mydb" : isFileType ? "/path/to/database.sqlite" : "postgresql://user:password@localhost:5432/mydatabase"}
                                    value={connectionString}
                                    onChange={(e) => setConnectionString(e.target.value)}
                                />
                                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 flex gap-2.5">
                                    <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-blue-600/80 leading-relaxed italic">
                                        {t ? 'Chúng tôi sẽ tự động tách các trường Host, User, Password... để bạn dễ dàng quản lý.' : 'We will automatically extract Host, User, Password... fields for better management.'}
                                    </p>
                                </div>
                            </div>
                            <Button type="button" variant="outline" className="w-full font-bold text-xs h-10 rounded-xl border-dashed hover:border-violet-500 hover:bg-violet-50/50" onClick={parseConnectionString}>
                                <Activity className="w-3.5 h-3.5 mr-2 text-violet-500" />
                                {t ? 'Phân tích & Tự động điền' : 'Analyze & Auto-fill'}
                            </Button>
                        </TabsContent>

                        <TabsContent value="form" className="space-y-6 m-0 animate-in fade-in-50">
                            {/* Section: Identity */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-violet-600/80">{t ? 'Thông tin cơ bản' : 'General Identity'}</h3>
                                    <div className="h-px bg-border/60 flex-1" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase">{t ? 'Loại Database' : 'Database Type'}</Label>
                                        <Select value={type} onValueChange={(v: any) => {
                                            setType(v);
                                            if (v === 'postgres') { setPort('5432'); setUsername('postgres'); setHost('localhost'); }
                                            else if (v === 'mysql') { setPort('3306'); setUsername('root'); setHost('localhost'); }
                                            else if (v === 'mssql') { setPort('1433'); setUsername('sa'); setHost('localhost'); }
                                            else if (v === 'mongodb') { setPort('27017'); setUsername(''); setHost('localhost'); }
                                            else if (v === 'mongodb+srv') { setPort(''); setUsername(''); setHost(''); }
                                            else if (v === 'sqlite') { setPort(''); setUsername(''); setHost(''); setDatabase(''); }
                                            else if (v === 'clickhouse') { setPort('8123'); setUsername('default'); setHost('localhost'); }
                                            setTestResult(null);
                                        }}>
                                            <SelectTrigger className="h-10 text-xs rounded-xl font-medium">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl overflow-hidden">
                                                <SelectItem value="postgres"><div className="flex items-center gap-2.5 px-1 py-1"><div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" />PostgreSQL</div></SelectItem>
                                                <SelectItem value="mysql"><div className="flex items-center gap-2.5 px-1 py-1"><div className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm" />MySQL</div></SelectItem>
                                                <SelectItem value="mssql"><div className="flex items-center gap-2.5 px-1 py-1"><div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm" />SQL Server</div></SelectItem>
                                                <SelectItem value="clickhouse"><div className="flex items-center gap-2.5 px-1 py-1"><div className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-sm" />ClickHouse</div></SelectItem>
                                                <SelectItem value="sqlite"><div className="flex items-center gap-2.5 px-1 py-1"><div className="w-2.5 h-2.5 rounded-full bg-slate-400 shadow-sm" />SQLite</div></SelectItem>
                                                <SelectItem value="mongodb"><div className="flex items-center gap-2.5 px-1 py-1"><div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm" />MongoDB Native</div></SelectItem>
                                                <SelectItem value="mongodb+srv"><div className="flex items-center gap-2.5 px-1 py-1"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />MongoDB Atlas</div></SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase">{t ? 'Team' : 'Workgroup'}</Label>
                                        <Select value={organizationId} onValueChange={setOrganizationId}>
                                            <SelectTrigger className="h-10 text-xs rounded-xl font-medium">
                                                <SelectValue placeholder={t ? 'Chỉ của tôi' : 'Personal'} />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="none"><div className="flex items-center gap-2.5 px-1 py-1"><div className="w-2.5 h-2.5 rounded-full bg-slate-200" />{t ? 'Chỉ cá nhân' : 'Personal Space'}</div></SelectItem>
                                                {teams.map((team) => (
                                                    <SelectItem key={team.id} value={team.id}>
                                                        <div className="flex items-center gap-2.5 px-1 py-1 text-blue-600 font-semibold">
                                                            <Users className="w-3.5 h-3.5" />
                                                            {team.name}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-semibold text-muted-foreground uppercase">{t ? 'Tên hiển thị' : 'Label Name'}</Label>
                                    <Input value={name} onChange={e => setName(e.target.value)} placeholder={t ? "VD: Production DB" : "e.g. Master Cluster"} className="h-10 text-xs rounded-xl font-medium" />
                                </div>
                            </div>

                            {/* Section: Network Details */}
                            {!isFileType && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-violet-600/80">{t ? 'Kết nối mạng' : 'Network Credentials'}</h3>
                                        <div className="h-px bg-border/60 flex-1" />
                                    </div>

                                    <div className={`grid gap-4 ${type === 'mongodb+srv' ? 'grid-cols-1' : 'grid-cols-3'}`}>
                                        <div className={type === 'mongodb+srv' ? '' : 'col-span-2'}>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-semibold text-muted-foreground uppercase">{isMongoType ? 'Cluster URL' : 'Host Address'}</Label>
                                                <div className="relative">
                                                    <Globe className="absolute left-3 top-3 w-4 h-4 text-muted-foreground/50" />
                                                    <Input value={host} onChange={e => setHost(e.target.value)} placeholder={isMongoType ? 'cluster0.xxxxx.mongodb.net' : 'localhost'} className="h-10 pl-10 font-mono text-xs rounded-xl" />
                                                </div>
                                            </div>
                                        </div>
                                        {type !== 'mongodb+srv' && (
                                            <div className="col-span-1 space-y-1.5">
                                                <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Port</Label>
                                                <Input value={port} onChange={e => setPort(e.target.value)} className="h-10 font-mono text-xs rounded-xl text-center" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Section: SQLite Path */}
                            {isFileType && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-violet-600/80">{t ? 'Dữ liệu File' : 'Local Data Storage'}</h3>
                                        <div className="h-px bg-border/60 flex-1" />
                                    </div>

                                    <div className="space-y-1.5 p-4 rounded-xl border border-dashed border-violet-500/30 bg-violet-500/5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center">
                                                <Database className="w-4 h-4 text-violet-600" />
                                            </div>
                                            <div>
                                                <Label className="text-[10px] font-bold text-muted-foreground uppercase">{t ? 'Đường dẫn file SQLite' : 'SQLite Database Path'}</Label>
                                            </div>
                                        </div>
                                        <Input value={database} onChange={e => setDatabase(e.target.value)} placeholder={t ? "/đường/dẫn/đến/file.sqlite hoặc :memory:" : "/abs/path/to/db.sqlite or :memory:"} className="h-10 font-mono text-xs rounded-lg border-violet-500/10 focus:border-violet-500/40" />
                                        <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                                            <span className="font-bold text-violet-600 mr-1">HINT:</span> 
                                            {t ? 'Lưu ý Server phải có quyền đọc/ghi vào thư mục chứa file này. Dùng :memory: để tạo DB tạm thời.' : 'Ensure the server process has read/write permissions for the selected file/folder. Use :memory: for temporary storage.'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Section: Authentication */}
                            {!isFileType && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-violet-600/80">{t ? 'Xác thực & Bảo mật' : 'Authentication Scope'}</h3>
                                        <div className="h-px bg-border/60 flex-1" />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">{t ? 'Tên đăng nhập' : 'Master User'}</Label>
                                            <div className="relative">
                                                <Users className="absolute left-3 top-3 w-4 h-4 text-muted-foreground/50" />
                                                <Input value={username} onChange={e => setUsername(e.target.value)} className="h-10 pl-10 text-xs rounded-xl" />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">{t ? 'Mật khẩu' : 'Secret Token'}</Label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground/50" />
                                                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="h-10 pl-10 text-xs rounded-xl" />
                                            </div>
                                        </div>
                                    </div>
                                    {!isMongoType && (
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">{t ? 'Database Mặc định' : 'Default Target Database'}</Label>
                                            <Input value={database} onChange={e => setDatabase(e.target.value)} placeholder="mydatabase" className="h-10 font-mono text-xs rounded-xl" />
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/30 shadow-inner">
                                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-emerald-700 block uppercase tracking-tight">Security Protocol ACTIVE</span>
                                            <span className="text-[10px] text-muted-foreground font-medium italic">
                                                {t ? 'Mã hóa AES-256-GCM • SSL tự động được kích hoạt' : 'AES-256-GCM Level Encryption • Auto SSL/TLS Handshake'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Section: Permissions */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-violet-600/80">{t ? 'Quyền & Chính sách' : 'Governance & Safety'}</h3>
                                    <div className="h-px bg-border/60 flex-1" />
                                </div>

                                <div className="grid grid-cols-1 gap-2">
                                    <label className={`group flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${readOnly ? 'bg-amber-500/5 border-amber-500/20 shadow-sm' : 'hover:bg-muted/50 border-transparent hover:border-border'}`}>
                                        <div className="flex gap-3">
                                            <FileWarning className={`w-4 h-4 mt-0.5 ${readOnly ? 'text-amber-500' : 'text-muted-foreground/40'}`} />
                                            <div>
                                                <div className="text-[11px] font-bold uppercase">{t ? 'Chế độ an toàn (Chỉ đọc)' : 'Isolated Safety Mode (Read-only)'}</div>
                                                <div className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{t ? 'Vô hiệu hóa mọi thao tác ghi, xóa hoặc thay đổi cấu trúc.' : 'Blocks all write, delete, and DDL schema modifications.'}</div>
                                            </div>
                                        </div>
                                        <input type="checkbox" checked={readOnly} onChange={(e) => setReadOnly(e.target.checked)} className="peer hidden" />
                                        <div className="w-10 h-5 rounded-full bg-muted relative transition-all peer-checked:bg-amber-500 shrink-0">
                                            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${readOnly ? 'left-6' : 'left-1'}`} />
                                        </div>
                                    </label>
                                    
                                    {!readOnly && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <label className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/50 transition-all cursor-pointer border-transparent hover:border-border">
                                                <input type="checkbox" checked={allowSchemaChanges} onChange={(e) => setAllowSchemaChanges(e.target.checked)} className="accent-violet-500" />
                                                <div className="text-[10px] font-semibold">{t ? 'Thay đổi Schema' : 'Schema Changes'}</div>
                                            </label>
                                            <label className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/50 transition-all cursor-pointer border-transparent hover:border-border">
                                                <input type="checkbox" checked={allowImportExport} onChange={(e) => setAllowImportExport(e.target.checked)} className="accent-violet-500" />
                                                <div className="text-[10px] font-semibold">{t ? 'Import / Export' : 'Mass Data Operations'}</div>
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Section: Test Connection Result */}
                            {testResult && (
                                <div className={`p-4 rounded-xl border flex items-start gap-4 animate-in zoom-in-95 ${testResult.status === 'healthy' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700' : 'bg-red-500/10 border-red-500/20 text-red-700'}`}>
                                    {testResult.status === 'healthy' ? (
                                        <CheckCircle2 className="w-6 h-6 mt-0.5 shrink-0" />
                                    ) : (
                                        <XCircle className="w-6 h-6 mt-0.5 shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[11px] font-bold uppercase tracking-wider mb-1">
                                            {testResult.status === 'healthy' ? (t ? 'Kết nối thành công!' : 'Connection Successful!') : (t ? 'Kết nối thất bại' : 'Connection Refused')}
                                        </div>
                                        <div className="text-[10px] leading-relaxed break-words font-medium">
                                            {testResult.status === 'healthy' 
                                                ? (t ? `Đã xác thực OK. Độ trễ: ${testResult.latency}ms` : `Handshake verified. Latency: ${testResult.latency}ms`)
                                                : testResult.error
                                            }
                                        </div>
                                    </div>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3 shrink-0 bg-muted/10">
                    <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs font-bold text-muted-foreground hover:bg-red-500/5 hover:text-red-500 rounded-xl"
                        onClick={handleTest}
                        disabled={isTesting || isSaving}
                    >
                        {isTesting ? (t ? 'Đang kiểm tra...' : 'Testing...') : (t ? 'Kiểm tra kết nối' : 'Test Connection')}
                    </Button>
                    <div className="flex gap-2">
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={closeConnectionDialog} 
                            disabled={isSaving} 
                            className="text-xs font-bold h-10 px-6 rounded-xl"
                        >
                            {t ? 'Bỏ qua' : 'Discard'}
                        </Button>
                        <Button 
                            size="sm" 
                            onClick={handleSave} 
                            disabled={isSaving} 
                            className="bg-violet-600 hover:bg-violet-700 text-white font-bold h-10 px-8 rounded-xl shadow-lg shadow-violet-500/20 transition-all hover:scale-[1.02]"
                        >
                            {isSaving ? (t ? 'Đang lưu...' : 'Preserving...') : (t ? 'Lưu Kết nối' : 'Establish Connection')}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
