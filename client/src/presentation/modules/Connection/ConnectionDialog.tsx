import React, { useState } from 'react';
import { useAppStore, type Connection } from '@/core/services/store';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/select';
import { Label } from '@/presentation/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/presentation/components/ui/tabs';
import {
    ShieldAlert, Database, Lock, Globe, Wand2, ShieldCheck, Shield,
    FileWarning, Upload, Users, CheckCircle2, XCircle, Server, Eye, EyeOff,
    Terminal, KeyRound, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';
import { SiPostgresql, SiMysql, SiMariadb, SiMongodb, SiClickhouse, SiSqlite } from 'react-icons/si';
import { DiMsqlServer } from 'react-icons/di';

import { ConnectionService } from '@/core/services/ConnectionService';
import { OrganizationService, type OrganizationEntity } from '@/core/services/OrganizationService';

type EditableConnectionType = Exclude<Connection['type'], 'mock' | 'redis'>;
type ConnectionPayload = Omit<Connection, 'id'>;

const getErrorMessage = (error: unknown, fallback: string) => (
    error instanceof Error ? error.message : fallback
);

export const ConnectionDialog: React.FC = () => {
    const { isConnectionDialogOpen, closeConnectionDialog, addConnection, lang } = useAppStore();
    const t = lang === 'vi';

    const [type, setType] = useState<EditableConnectionType>('postgres');
    const [name, setName] = useState('');
    const [host, setHost] = useState('localhost');
    const [port, setPort] = useState('5432');
    const [username, setUsername] = useState('postgres');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
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

    // SSH Tunneling State
    const [useSshTunnel, setUseSshTunnel] = useState(false);
    const [sshHost, setSshHost] = useState('');
    const [sshPort, setSshPort] = useState('22');
    const [sshUsername, setSshUsername] = useState('');
    const [sshAuthType, setSshAuthType] = useState<'password' | 'key'>('password');
    const [sshPrivateKey, setSshPrivateKey] = useState('');
    const [sshPassphrase, setSshPassphrase] = useState('');
    const [showSshPassphrase, setShowSshPassphrase] = useState(false);

    const [environment, setEnvironment] = useState<'development' | 'staging' | 'production'>('development');

    const [teams, setTeams] = useState<OrganizationEntity[]>([]);
    const [organizationId, setOrganizationId] = useState<string>('none');

    // Reset form states when dialog opens and clean up pointer-events on close/unmount
    React.useEffect(() => {
        if (isConnectionDialogOpen) {
            setType('postgres');
            setName('');
            setHost('localhost');
            setPort('5432');
            setUsername('postgres');
            setPassword('');
            setShowPassword(false);
            setDatabase('');
            setReadOnly(false);
            setAllowSchemaChanges(true);
            setAllowImportExport(true);
            setAllowQueryExecution(true);
            setConnectionString('');
            setError(null);
            setTestResult(null);
            setIsSaving(false);
            setEnvironment('development');

            setUseSshTunnel(false);
            setSshHost('');
            setSshPort('22');
            setSshUsername('');
            setSshAuthType('password');
            setSshPrivateKey('');
            setSshPassphrase('');
            setShowSshPassphrase(false);

            setOrganizationId('none');
            // Load teams
            OrganizationService.getMyOrganizations()
                .then(setTeams)
                .catch(() => setTeams([]));
        } else if (document.body.style.pointerEvents === 'none') {
            document.body.style.pointerEvents = '';
        }

        return () => {
            if (document.body.style.pointerEvents === 'none') {
                document.body.style.pointerEvents = '';
            }
        };
    }, [isConnectionDialogOpen]);

    const isMongoType = type === 'mongodb' || type === 'mongodb+srv';
    const isFileType = type === 'sqlite';

    const parseConnectionString = (rawInput?: string) => {
        try {
            const raw = (rawInput ?? connectionString).trim();
            if (!raw) return;

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

            let parsedType: 'postgres' | 'cockroach' | 'mysql' | 'mariadb' | 'mssql' | 'clickhouse' = 'postgres';
            if (url.protocol.includes('cockroach')) {
                parsedType = 'cockroach';
                setType('cockroach');
            } else if (url.protocol.includes('postgres')) {
                parsedType = 'postgres';
                setType('postgres');
            } else if (url.protocol.includes('mariadb')) {
                parsedType = 'mariadb';
                setType('mariadb');
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
            if (url.port) {
                setPort(url.port);
            } else {
                if (parsedType === 'postgres') setPort('5432');
                if (parsedType === 'cockroach') setPort('26257');
                if (parsedType === 'mysql') setPort('3306');
                if (parsedType === 'mariadb') setPort('3306');
                if (parsedType === 'mssql') setPort('1433');
                if (parsedType === 'clickhouse') setPort('8123');
            }

            if (url.username) setUsername(decodeURIComponent(url.username));
            if (url.password) setPassword(decodeURIComponent(url.password));
            if (url.pathname && url.pathname.length > 1) {
                setDatabase(decodeURIComponent(url.pathname.substring(1)));
            }
            if (!name) setName(`${parsedType} @ ${url.hostname}`);
            setError(null);
        } catch {
            setError(t ? "Sai định dạng Connection String. VD: postgresql://user:pass@localhost:5432/mydb" : "Invalid Connection String format. Example: postgresql://user:pass@localhost:5432/mydb");
        }
    };

    const validateForm = (): string | null => {
        if (!isFileType && !host.trim()) {
            return t ? 'Vui lòng nhập Host của database' : 'Database Host is required';
        }
        if (isFileType && !database.trim()) {
            return t ? 'Vui lòng nhập đường dẫn file SQLite' : 'SQLite file path is required';
        }
        if (port.trim()) {
            const parsed = parseInt(port, 10);
            if (isNaN(parsed) || parsed <= 0 || parsed > 65535) {
                return t ? 'Port không hợp lệ (1 - 65535)' : 'Invalid port number (1 - 65535)';
            }
        }
        if (useSshTunnel) {
            if (!sshHost.trim()) {
                return t ? 'Vui lòng nhập SSH Host' : 'SSH Host is required when SSH Tunnel is enabled';
            }
            if (!sshUsername.trim()) {
                return t ? 'Vui lòng nhập SSH Username' : 'SSH Username is required when SSH Tunnel is enabled';
            }
            if (sshPort.trim()) {
                const parsedSshPort = parseInt(sshPort, 10);
                if (isNaN(parsedSshPort) || parsedSshPort <= 0 || parsedSshPort > 65535) {
                    return t ? 'SSH Port không hợp lệ (1 - 65535)' : 'Invalid SSH port number (1 - 65535)';
                }
            }
        }
        return null;
    };

    const getConnectionData = (): ConnectionPayload => {
        const connectionData: ConnectionPayload = {
            name: name || `${type}@${host}`,
            type,
            host: isFileType ? undefined : host.trim(),
            username: isFileType ? undefined : username.trim(),
            password: isFileType ? undefined : password,
            showAllDatabases,
            readOnly,
            allowSchemaChanges: readOnly ? false : allowSchemaChanges,
            allowImportExport: readOnly ? false : allowImportExport,
            allowQueryExecution,
            environment,
            ...(organizationId && organizationId !== 'none' ? { organizationId } : {}),
            ...(useSshTunnel ? {
                sshHost: sshHost.trim(),
                sshPort: parseInt(sshPort, 10) || 22,
                sshUsername: sshUsername.trim(),
                ...(sshAuthType === 'key' ? {
                    sshPrivateKey: sshPrivateKey.trim(),
                    sshPassphrase: sshPassphrase || undefined,
                } : {
                    sshPassphrase: sshPassphrase || undefined,
                }),
            } : {}),
        };

        const parsedPort = parseInt(port, 10);
        if (!isNaN(parsedPort)) connectionData.port = parsedPort;
        if (database && database.trim() !== '') connectionData.database = database.trim();
        return connectionData;
    };

    const handleTest = async () => {
        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsTesting(true);
        setTestResult(null);
        setError(null);
        try {
            const data = getConnectionData();
            const result = await ConnectionService.testConnection(data);
            setTestResult({
                status: result.status,
                latency: result.latencyMs,
                error: result.error || undefined
            });
        } catch (err) {
            setTestResult({
                status: 'error',
                error: getErrorMessage(err, 'Connection failed')
            });
        } finally {
            setIsTesting(false);
        }
    };

    const handleSave = async () => {
        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsSaving(true);
        setError(null);

        const connectionData = getConnectionData();

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
                readOnly: savedConnection.readOnly,
                allowSchemaChanges: savedConnection.allowSchemaChanges,
                allowImportExport: savedConnection.allowImportExport,
                allowQueryExecution: savedConnection.allowQueryExecution,
                lastHealthCheckAt: savedConnection.lastHealthCheckAt,
                lastHealthStatus: savedConnection.lastHealthStatus,
                lastHealthError: savedConnection.lastHealthError,
                lastConnectedAt: savedConnection.lastConnectedAt,
                lastConnectionLatencyMs: savedConnection.lastConnectionLatencyMs,
                sshHost: savedConnection.sshHost,
                sshPort: savedConnection.sshPort,
                sshUsername: savedConnection.sshUsername,
                environment: savedConnection.environment || environment,
            };
            addConnection(newConnection);
            closeConnectionDialog();
            setName('');
            setPassword('');
            setError(null);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to save connection'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog
            open={isConnectionDialogOpen}
            onOpenChange={(open) => {
                if (!open) {
                    closeConnectionDialog();
                }
            }}
        >
            <DialogContent className="max-w-[calc(100vw-1rem)] rounded-xl border-border/50 bg-background p-0 shadow-2xl overflow-hidden sm:max-w-[740px] top-[4.25rem] translate-y-0 max-h-[calc(100vh-5.5rem)]">
                <div className="flex flex-col max-h-[calc(100vh-5.5rem)] h-[84vh]">
                    {/* Header */}
                    <div className="px-6 pt-4 pb-3.5 border-b shrink-0">
                        <DialogTitle asChild>
                            <h2 className="text-base sm:text-lg font-bold tracking-tight flex items-center gap-2">
                                <Database className="w-5 h-5 text-violet-500" />
                                {t ? 'Thêm kết nối mới' : 'Add New Connection'}
                            </h2>
                        </DialogTitle>
                        <DialogDescription asChild>
                            <p className="text-xs text-muted-foreground mt-0.5">{t ? 'Cấu hình thông tin để truy cập database an toàn.' : 'Configure credentials to securely access your database.'}</p>
                        </DialogDescription>
                    </div>

                    {/* Scrollable Body */}
                    <div className="flex-1 overflow-y-auto px-6 py-4">

                        <Tabs defaultValue="form" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-4 h-9">
                                <TabsTrigger value="form" className="text-xs">{t ? 'Form Chuẩn' : 'Standard Form'}</TabsTrigger>
                                <TabsTrigger value="string" className="text-xs">{t ? 'Chuỗi kết nối (URI)' : 'Connection String (URI)'}</TabsTrigger>
                            </TabsList>

                            <TabsContent value="string" className="space-y-3">
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="connectionString" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t ? 'Dán URI / Connection String' : 'Paste URI / Connection String'}</Label>
                                        <span className="text-[10px] text-muted-foreground">{t ? 'Tự động nhận diện khi dán' : 'Auto-detects on paste'}</span>
                                    </div>
                                    <textarea
                                        id="connectionString"
                                        className="w-full h-24 rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono whitespace-pre-wrap"
                                        placeholder={isMongoType ? "mongodb+srv://user:pass@cluster0.abc.mongodb.net/mydb" : isFileType ? "/path/to/database.sqlite" : "postgresql://user:password@localhost:5432/mydatabase"}
                                        value={connectionString}
                                        onChange={(e) => setConnectionString(e.target.value)}
                                        onPaste={(e) => {
                                            const pasted = e.clipboardData.getData('text');
                                            if (pasted && pasted.trim()) {
                                                setConnectionString(pasted);
                                                parseConnectionString(pasted);
                                            }
                                        }}
                                    />
                                </div>
                                <Button type="button" variant="secondary" size="sm" className="w-full font-medium text-xs h-8" onClick={() => parseConnectionString()}>
                                    <Wand2 className="w-3.5 h-3.5 mr-1.5 text-violet-500" />
                                    {t ? 'Phân tích & Tự động điền Form' : 'Parse & Fill Form'}
                                </Button>
                            </TabsContent>

                            <TabsContent value="form" className="space-y-4 m-0">
                                {/* Team + Type + Name */}
                                {teams.length > 0 && (
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t ? 'Team (Tùy chọn)' : 'Team (Optional)'}</Label>
                                        <Select value={organizationId} onValueChange={(v: string) => setOrganizationId(v)}>
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue placeholder={t ? 'Chỉ của tôi' : 'Personal'} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none"><div className="flex items-center gap-2 text-xs"><div className="w-2 h-2 rounded-full bg-muted" />{t ? 'Chỉ của tôi' : 'Personal'}</div></SelectItem>
                                                {teams.map((team) => (
                                                    <SelectItem key={team.id} value={team.id}>
                                                        <div className="flex items-center gap-2 text-xs">
                                                            <Users className="w-3 h-3 text-blue-500" />
                                                            {team.name}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t ? 'Chọn Database Engine' : 'Database Engine'}</Label>
                                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                                        {([
                                            { value: 'postgres', label: 'PostgreSQL', icon: <SiPostgresql className="w-5 h-5" />, accent: 'text-sky-500', accentBg: 'bg-sky-500/10 border-sky-500/40' },
                                            { value: 'cockroach', label: 'CockroachDB', icon: <Server className="w-5 h-5" />, accent: 'text-indigo-500', accentBg: 'bg-indigo-500/10 border-indigo-500/40' },
                                            { value: 'mysql', label: 'MySQL', icon: <SiMysql className="w-5 h-5" />, accent: 'text-orange-500', accentBg: 'bg-orange-500/10 border-orange-500/40' },
                                            { value: 'mariadb', label: 'MariaDB', icon: <SiMariadb className="w-5 h-5" />, accent: 'text-amber-500', accentBg: 'bg-amber-500/10 border-amber-500/40' },
                                            { value: 'mssql', label: 'SQL Server', icon: <DiMsqlServer className="w-5 h-5" />, accent: 'text-red-500', accentBg: 'bg-red-500/10 border-red-500/40' },
                                            { value: 'clickhouse', label: 'ClickHouse', icon: <SiClickhouse className="w-5 h-5" />, accent: 'text-yellow-500', accentBg: 'bg-yellow-500/10 border-yellow-500/40' },
                                            { value: 'sqlite', label: 'SQLite', icon: <SiSqlite className="w-5 h-5" />, accent: 'text-slate-400', accentBg: 'bg-slate-400/10 border-slate-400/40' },
                                            { value: 'mongodb', label: 'MongoDB', icon: <SiMongodb className="w-5 h-5" />, accent: 'text-green-500', accentBg: 'bg-green-500/10 border-green-500/40' },
                                            { value: 'mongodb+srv', label: 'Atlas (SRV)', icon: <SiMongodb className="w-5 h-5" />, accent: 'text-emerald-500', accentBg: 'bg-emerald-500/10 border-emerald-500/40' },
                                        ] as const).map((engine) => {
                                            const isActive = type === engine.value;
                                            return (
                                                <button
                                                    key={engine.value}
                                                    type="button"
                                                    onClick={() => {
                                                        const nextType = engine.value as EditableConnectionType;
                                                        setType(nextType);
                                                        if (nextType === 'postgres') { setPort('5432'); setUsername('postgres'); setHost('localhost'); }
                                                        else if (nextType === 'cockroach') { setPort('26257'); setUsername('root'); setHost('localhost'); }
                                                        else if (nextType === 'mysql') { setPort('3306'); setUsername('root'); setHost('localhost'); }
                                                        else if (nextType === 'mariadb') { setPort('3306'); setUsername('root'); setHost('localhost'); }
                                                        else if (nextType === 'mssql') { setPort('1433'); setUsername('sa'); setHost('localhost'); }
                                                        else if (nextType === 'mongodb') { setPort('27017'); setUsername(''); setHost('localhost'); }
                                                        else if (nextType === 'mongodb+srv') { setPort(''); setUsername(''); setHost(''); }
                                                        else if (nextType === 'sqlite') { setPort(''); setUsername(''); setHost(''); setDatabase(''); }
                                                        else if (nextType === 'clickhouse') { setPort('8123'); setUsername('default'); setHost('localhost'); }
                                                    }}
                                                    className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-3 transition-all text-center ${isActive
                                                        ? `${engine.accentBg} ${engine.accent} shadow-sm`
                                                        : 'border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                                                        }`}
                                                    title={engine.label}
                                                >
                                                    {engine.icon}
                                                    <span className="text-[10px] font-medium leading-tight">{engine.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <div className="col-span-2 space-y-1">
                                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t ? 'Tên hiển thị' : 'Display Name'}</Label>
                                        <Input value={name} onChange={e => { setName(e.target.value); setError(null); }} placeholder="e.g. Production DB" className="h-9 text-xs" />
                                    </div>
                                    <div className="col-span-1 space-y-1">
                                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t ? 'Môi trường' : 'Environment'}</Label>
                                        <Select value={environment} onValueChange={(v: 'development' | 'staging' | 'production') => setEnvironment(v)}>
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="development">
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                                        <span>{t ? 'Phát triển (Dev)' : 'Dev'}</span>
                                                    </div>
                                                </SelectItem>
                                                <SelectItem value="staging">
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                                        <span>{t ? 'Kiểm thử (Stage)' : 'Staging'}</span>
                                                    </div>
                                                </SelectItem>
                                                <SelectItem value="production">
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                                                        <span className="text-red-500 font-semibold">{t ? 'Thực tế (Prod)' : 'Production'}</span>
                                                    </div>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="h-px bg-border/40 w-full" />

                                {/* Network */}
                                {!isFileType && (
                                    <div className="space-y-2.5">
                                        <div className="flex items-center gap-1.5 text-xs font-medium"><Globe className="w-3.5 h-3.5 text-muted-foreground" /> {t ? 'Chi tiết mạng' : 'Network Details'}</div>
                                        <div className={`grid gap-3 ${type === 'mongodb+srv' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3'}`}>
                                            <div className={type === 'mongodb+srv' ? '' : 'col-span-2'}>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] text-muted-foreground">{isMongoType ? 'Hostname / Cluster' : 'Host'}</Label>
                                                    <Input value={host} onChange={e => { setHost(e.target.value); setError(null); }} placeholder={isMongoType ? 'cluster0.xxxxx.mongodb.net' : 'localhost'} className="h-9 font-mono text-xs" />
                                                </div>
                                            </div>
                                            {type !== 'mongodb+srv' && (
                                                <div className="col-span-1 space-y-1">
                                                    <Label className="text-[10px] text-muted-foreground">Port</Label>
                                                    <Input value={port} onChange={e => { setPort(e.target.value); setError(null); }} className="h-9 font-mono text-xs" />
                                                </div>
                                            )}
                                        </div>
                                        {isMongoType && (
                                            <div className="space-y-1">
                                                <Label className="text-[10px] text-muted-foreground">{t ? 'Database (Tùy chọn)' : 'Database (Optional)'}</Label>
                                                <Input value={database} onChange={e => { setDatabase(e.target.value); setError(null); }} placeholder="mydb" className="h-9 font-mono text-xs" />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {isFileType && (
                                    <div className="space-y-2.5">
                                        <div className="flex items-center gap-1.5 text-xs font-medium"><Database className="w-3.5 h-3.5 text-muted-foreground" /> {t ? 'Đường dẫn file' : 'File Path'}</div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">{t ? 'Đường dẫn SQLite' : 'SQLite File Path'}</Label>
                                            <Input value={database} onChange={e => { setDatabase(e.target.value); setError(null); }} placeholder="/path/to/database.sqlite or :memory:" className="h-9 font-mono text-xs" />
                                        </div>
                                    </div>
                                )}

                                <div className="h-px bg-border/40 w-full" />

                                {/* Auth */}
                                {!isFileType && (
                                    <div className="space-y-2.5">
                                        <div className="flex items-center gap-1.5 text-xs font-medium"><Lock className="w-3.5 h-3.5 text-muted-foreground" /> {t ? 'Xác thực' : 'Authentication'}</div>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] text-muted-foreground">{t ? 'Tên đăng nhập' : 'Username'}</Label>
                                                <Input value={username} onChange={e => setUsername(e.target.value)} className="h-9 text-xs" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] text-muted-foreground">{t ? 'Mật khẩu' : 'Password'}</Label>
                                                <div className="relative">
                                                    <Input
                                                        type={showPassword ? 'text' : 'password'}
                                                        value={password}
                                                        onChange={e => setPassword(e.target.value)}
                                                        className="h-9 text-xs pr-8"
                                                    />
                                                    <button
                                                        type="button"
                                                        tabIndex={-1}
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                                    >
                                                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        {!isMongoType && (
                                            <div className="space-y-1">
                                                <Label className="text-[10px] text-muted-foreground">Database</Label>
                                                <Input value={database} onChange={e => { setDatabase(e.target.value); setError(null); }} placeholder="mydatabase" className="h-9 font-mono text-xs" />
                                            </div>
                                        )}
                                        {/* Refined Security Micro-Indicator */}
                                        <div className="flex items-center gap-1.5 pt-0.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium select-none">
                                            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                                            <span>{t ? 'Mã hóa AES-256-GCM an toàn • SSL Mode tự động' : 'AES-256-GCM Encrypted • Auto SSL Mode'}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="h-px bg-border/40 w-full" />

                                {/* SSH Tunneling Accordion */}
                                {!isFileType && (
                                    <div className="space-y-2 rounded-lg border bg-muted/10 p-3">
                                        <div className="flex items-center justify-between">
                                            <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={useSshTunnel}
                                                    onChange={(e) => setUseSshTunnel(e.target.checked)}
                                                    className="rounded border-border text-violet-600 focus:ring-violet-500"
                                                />
                                                <div className="flex items-center gap-1.5 text-xs font-semibold">
                                                    <Terminal className="w-3.5 h-3.5 text-violet-500" />
                                                    {t ? 'Sử dụng SSH Tunnel (Bastion / Jump Host)' : 'Use SSH Tunnel (Bastion / Jump Host)'}
                                                </div>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setUseSshTunnel(!useSshTunnel)}
                                                className="text-muted-foreground hover:text-foreground"
                                            >
                                                {useSshTunnel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        {useSshTunnel && (
                                            <div className="mt-3 pt-3 border-t border-border/40 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                                <p className="text-[11px] text-muted-foreground">
                                                    {t
                                                        ? 'Kết nối an toàn đến database phía sau tường lửa hoặc VPC riêng biệt qua SSH tunnel.'
                                                        : 'Securely connect to databases behind a private VPC or firewall via an SSH tunnel.'}
                                                </p>
                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                                    <div className="col-span-2 space-y-1">
                                                        <Label className="text-[10px] text-muted-foreground">{t ? 'SSH Host / IP' : 'SSH Host / IP'}</Label>
                                                        <Input
                                                            value={sshHost}
                                                            onChange={e => { setSshHost(e.target.value); setError(null); }}
                                                            placeholder="bastion.example.com"
                                                            className="h-9 font-mono text-xs"
                                                        />
                                                    </div>
                                                    <div className="col-span-1 space-y-1">
                                                        <Label className="text-[10px] text-muted-foreground">SSH Port</Label>
                                                        <Input
                                                            value={sshPort}
                                                            onChange={e => { setSshPort(e.target.value); setError(null); }}
                                                            placeholder="22"
                                                            className="h-9 font-mono text-xs"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] text-muted-foreground">{t ? 'SSH Username' : 'SSH Username'}</Label>
                                                        <Input
                                                            value={sshUsername}
                                                            onChange={e => { setSshUsername(e.target.value); setError(null); }}
                                                            placeholder="ubuntu or ec2-user"
                                                            className="h-9 text-xs"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] text-muted-foreground">{t ? 'Hình thức xác thực SSH' : 'SSH Auth Method'}</Label>
                                                        <Select value={sshAuthType} onValueChange={(v: 'password' | 'key') => setSshAuthType(v)}>
                                                            <SelectTrigger className="h-9 text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="password">{t ? 'Password / Mật khẩu' : 'Password'}</SelectItem>
                                                                <SelectItem value="key">{t ? 'Private Key (Khóa riêng tư)' : 'Private Key'}</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>

                                                {sshAuthType === 'key' ? (
                                                    <div className="space-y-3">
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                <KeyRound className="w-3 h-3 text-violet-500" />
                                                                {t ? 'Nội dung Private Key (OpenSSH format)' : 'Private Key Content (OpenSSH format)'}
                                                            </Label>
                                                            <textarea
                                                                value={sshPrivateKey}
                                                                onChange={e => setSshPrivateKey(e.target.value)}
                                                                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                                                                className="w-full h-20 rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] text-muted-foreground">{t ? 'Passphrase khóa (nếu có)' : 'Key Passphrase (optional)'}</Label>
                                                            <div className="relative">
                                                                <Input
                                                                    type={showSshPassphrase ? 'text' : 'password'}
                                                                    value={sshPassphrase}
                                                                    onChange={e => setSshPassphrase(e.target.value)}
                                                                    placeholder="Passphrase"
                                                                    className="h-9 text-xs pr-8"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    tabIndex={-1}
                                                                    onClick={() => setShowSshPassphrase(!showSshPassphrase)}
                                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                                                >
                                                                    {showSshPassphrase ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] text-muted-foreground">{t ? 'SSH Password' : 'SSH Password'}</Label>
                                                        <div className="relative">
                                                            <Input
                                                                type={showSshPassphrase ? 'text' : 'password'}
                                                                value={sshPassphrase}
                                                                onChange={e => setSshPassphrase(e.target.value)}
                                                                placeholder="SSH Password"
                                                                className="h-9 text-xs pr-8"
                                                            />
                                                            <button
                                                                type="button"
                                                                tabIndex={-1}
                                                                onClick={() => setShowSshPassphrase(!showSshPassphrase)}
                                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                                            >
                                                                {showSshPassphrase ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="h-px bg-border/40 w-full" />

                                <div className="space-y-2.5">
                                    <div className="flex items-center gap-1.5 text-xs font-medium">
                                        <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                                        {t ? 'Quyền & An toàn' : 'Access & Safety'}
                                    </div>

                                    {/* Security & Access Checkboxes */}
                                    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                                        <label className="flex items-start gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={readOnly}
                                                onChange={(e) => setReadOnly(e.target.checked)}
                                                className="mt-0.5"
                                            />
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 text-xs font-semibold">
                                                    <FileWarning className="w-3.5 h-3.5 text-amber-500" />
                                                    {t ? 'Chế độ chỉ đọc' : 'Read-only mode'}
                                                </div>
                                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                                    {t
                                                        ? 'Chặn mọi thao tác sửa dữ liệu, đổi schema, import và tạo/xóa database.'
                                                        : 'Blocks data edits, schema changes, imports, and database create/drop actions.'}
                                                </p>
                                            </div>
                                        </label>

                                        <label className="flex items-start gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={allowQueryExecution}
                                                onChange={(e) => setAllowQueryExecution(e.target.checked)}
                                                className="mt-0.5"
                                            />
                                            <div className="min-w-0">
                                                <div className="text-xs font-semibold">
                                                    {t ? 'Cho phép chạy truy vấn' : 'Allow query execution'}
                                                </div>
                                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                                    {t
                                                        ? 'Tắt tùy chọn này nếu chỉ muốn lưu kết nối để xem metadata hoặc kiểm tra sức khỏe.'
                                                        : 'Turn this off if the connection should be discoverable but not runnable.'}
                                                </p>
                                            </div>
                                        </label>

                                        <label className={`flex items-start gap-3 ${readOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                            <input
                                                type="checkbox"
                                                checked={!readOnly && allowSchemaChanges}
                                                onChange={(e) => setAllowSchemaChanges(e.target.checked)}
                                                disabled={readOnly}
                                                className="mt-0.5"
                                            />
                                            <div className="min-w-0">
                                                <div className="text-xs font-semibold">
                                                    {t ? 'Cho phép đổi schema' : 'Allow schema changes'}
                                                </div>
                                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                                    {t
                                                        ? 'Bao gồm table designer, create/drop database và các thay đổi DDL.'
                                                        : 'Includes table designer, create/drop database, and other DDL actions.'}
                                                </p>
                                            </div>
                                        </label>

                                        <label className={`flex items-start gap-3 ${readOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                            <input
                                                type="checkbox"
                                                checked={!readOnly && allowImportExport}
                                                onChange={(e) => setAllowImportExport(e.target.checked)}
                                                disabled={readOnly}
                                                className="mt-0.5"
                                            />
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 text-xs font-semibold">
                                                    <Upload className="w-3.5 h-3.5 text-blue-500" />
                                                    {t ? 'Cho phép import/export' : 'Allow import/export'}
                                                </div>
                                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                                    {t
                                                        ? 'Kiểm soát bulk import và các thao tác copy dữ liệu khối lượng lớn.'
                                                        : 'Controls bulk import and other heavy data transfer workflows.'}
                                                </p>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-3 border-t border-border flex flex-col gap-2.5 shrink-0 bg-muted/20">
                        {/* Full Error / Test Result Message Strip */}
                        {testResult && (
                            <div
                                className={`flex items-start gap-2.5 text-xs p-2.5 rounded-lg border leading-relaxed animate-in fade-in zoom-in-95 ${
                                    testResult.status === 'healthy'
                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                                        : 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400'
                                }`}
                            >
                                {testResult.status === 'healthy' ? (
                                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />
                                ) : (
                                    <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
                                )}
                                <div className="flex-1 min-w-0 font-mono text-[11px] select-text break-words">
                                    <span className="font-semibold block mb-0.5 font-sans">
                                        {testResult.status === 'healthy'
                                            ? (t ? `Kết nối thành công (${testResult.latency}ms)` : `Connection Successful (${testResult.latency}ms)`)
                                            : (t ? 'Kết nối thất bại' : 'Connection Failed')}
                                    </span>
                                    {testResult.status === 'error' && (testResult.error || (t ? 'Không thể kết nối đến máy chủ cơ sở dữ liệu.' : 'Could not connect to database server.'))}
                                </div>
                            </div>
                        )}

                        {!testResult && error && (
                            <div className="flex items-start gap-2.5 text-xs p-2.5 rounded-lg border bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400 leading-relaxed animate-in fade-in zoom-in-95">
                                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
                                <div className="flex-1 min-w-0 font-mono text-[11px] select-text break-words">
                                    {error}
                                </div>
                            </div>
                        )}

                        {/* Action Buttons Row */}
                        <div className="flex items-center justify-between gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleTest}
                                disabled={isTesting || isSaving}
                                className="text-xs h-8 font-semibold shrink-0"
                            >
                                {isTesting ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin text-violet-500" />
                                        {t ? 'Đang test...' : 'Testing...'}
                                    </>
                                ) : (
                                    t ? 'Kiểm tra kết nối' : 'Test Connection'
                                )}
                            </Button>

                            <div className="flex items-center gap-2 shrink-0">
                                <Button variant="ghost" size="sm" onClick={closeConnectionDialog} disabled={isSaving} className="text-xs h-8">
                                    {t ? 'Hủy' : 'Cancel'}
                                </Button>
                                <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-violet-600 hover:bg-violet-700 text-white min-w-[110px] text-xs h-8">
                                    {isSaving ? (t ? 'Đang kết nối...' : 'Connecting...') : (t ? 'Lưu & Kết nối' : 'Save & Connect')}
                                </Button>
                            </div>
                        </div>
                    </div>

                </div>
            </DialogContent>
        </Dialog>
    );
};
