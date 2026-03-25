import React, { useState } from "react"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
} from "../../components/ui/select"
import { useAppStore } from "@/core/services/store"
import { PlusCircle, Server, Trash, Loader2 } from "lucide-react"
import { SiPostgresql, SiMysql, SiClickhouse, SiMongodb, SiRedis } from "react-icons/si"
import { DiMsqlServer } from "react-icons/di"
import { ConnectionService } from "@/core/services/ConnectionService"

/** Returns a database-type-specific icon and accent color. */
const getDbBranding = (type?: string) => {
    switch (type) {
        case 'postgres':
            return {
                color: 'text-sky-400',
                bg: 'bg-sky-500/10',
                bgHover: 'group-hover:bg-sky-500/20',
                label: 'PG',
                icon: <SiPostgresql className="w-3.5 h-3.5" />,
            };
        case 'mysql':
            return {
                color: 'text-orange-400',
                bg: 'bg-orange-500/10',
                bgHover: 'group-hover:bg-orange-500/20',
                label: 'MY',
                icon: <SiMysql className="w-4 h-4" />,
            };
        case 'mssql':
            return {
                color: 'text-red-400',
                bg: 'bg-red-500/10',
                bgHover: 'group-hover:bg-red-500/20',
                label: 'MS',
                icon: <DiMsqlServer className="w-4 h-4 scale-150" />,
            };
        case 'clickhouse':
            return {
                color: 'text-yellow-400',
                bg: 'bg-yellow-500/10',
                bgHover: 'group-hover:bg-yellow-500/20',
                label: 'CH',
                icon: <SiClickhouse className="w-3.5 h-3.5" />,
            };
        case 'mongodb':
        case 'mongodb+srv':
            return {
                color: 'text-green-400',
                bg: 'bg-green-500/10',
                bgHover: 'group-hover:bg-green-500/20',
                label: 'MONGO',
                icon: <SiMongodb className="w-3.5 h-3.5" />,
            };
        case 'redis':
            return {
                color: 'text-red-400',
                bg: 'bg-red-500/10',
                bgHover: 'group-hover:bg-red-500/20',
                label: 'REDIS',
                icon: <SiRedis className="w-3.5 h-3.5" />,
            };
        default:
            return {
                color: 'text-blue-400',
                bg: 'bg-blue-500/10',
                bgHover: 'group-hover:bg-blue-500/20',
                label: 'DB',
                icon: <Server className="w-3.5 h-3.5" />,
            };
    }
};

const NOSQL_TYPES = ['mongodb', 'mongodb+srv', 'redis'];
const SQL_TYPES = ['postgres', 'mysql', 'mssql', 'clickhouse'];

interface ConnectionSelectorProps {
    /** 'sql' = only relational, 'nosql' = only MongoDB/Redis, undefined = all */
    filter?: 'sql' | 'nosql';
}

export function ConnectionSelector({ filter }: ConnectionSelectorProps) {
    const { connections, activeConnectionId, setActiveConnectionId, openConnectionDialog, removeConnection } = useAppStore()
    const nosqlActiveConnectionId = useAppStore(state => state.nosqlActiveConnectionId);
    const setNosqlActiveConnectionId = useAppStore(state => state.setNosqlActiveConnectionId);
    const [isDeleting, setIsDeleting] = useState<string | null>(null)

    // Determine which connectionId to use based on workspace filter
    const currentConnectionId = filter === 'nosql' ? nosqlActiveConnectionId : activeConnectionId;
    const setCurrentConnectionId = filter === 'nosql' ? setNosqlActiveConnectionId : setActiveConnectionId;

    // Filter connections based on workspace type
    const visibleConnections = React.useMemo(() => {
        if (!filter) return connections;
        const allowedTypes = filter === 'nosql' ? NOSQL_TYPES : SQL_TYPES;
        return connections.filter(c => allowedTypes.includes(c.type));
    }, [connections, filter]);

    // Auto-select first visible connection if current one isn't in the filtered list
    React.useEffect(() => {
        if (visibleConnections.length > 0) {
            const currentIsVisible = visibleConnections.some(c => c.id === currentConnectionId);
            if (!currentIsVisible) {
                setCurrentConnectionId(visibleConnections[0].id);
            }
        }
    }, [visibleConnections, currentConnectionId, setCurrentConnectionId]);

    const activeConn = visibleConnections.find(c => c.id === currentConnectionId);
    const activeBranding = getDbBranding(activeConn?.type);

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this connection?')) return;

        setIsDeleting(id);
        try {
            await ConnectionService.deleteConnection(id);
            removeConnection(id);
        } catch (error: any) {
            console.error('Error deleting connection:', error);
            alert(error.message || 'Error deleting connection');
        } finally {
            setIsDeleting(null);
        }
    }

    return (
        <div className="px-0">
            <Select value={currentConnectionId || ''} onValueChange={setCurrentConnectionId}>
                <SelectTrigger className="w-full h-10 bg-muted/30 border-none ring-1 ring-border/50 hover:ring-blue-500/30 transition-all rounded-xl shadow-inner group">
                    <div className="flex items-center gap-2.5 truncate">
                        <div className={`w-6 h-6 rounded-lg ${activeBranding.bg} flex items-center justify-center shrink-0 ${activeBranding.bgHover} transition-colors ${activeBranding.color}`}>
                            {activeBranding.icon}
                        </div>
                        <span className="truncate">
                            {activeConn ? activeConn.name : "Select Instance"}
                        </span>
                    </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl ring-1 ring-black/5 backdrop-blur-xl bg-card/95">
                    <SelectGroup>
                        <SelectLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70 px-4 py-2">
                            {filter === 'nosql' ? 'NoSQL Instances' : filter === 'sql' ? 'SQL Instances' : 'Available Instances'}
                        </SelectLabel>
                        {visibleConnections.map((conn) => {
                            const branding = getDbBranding(conn.type);
                            return (
                                <div key={conn.id} className="group relative flex items-center pr-2">
                                    <SelectItem value={conn.id} textValue={conn.name} className="cursor-pointer focus:bg-blue-500/10 focus:text-blue-600 rounded-lg mx-1 flex-1 pr-8">
                                        <div className="flex items-center gap-2.5 text-left py-0.5">
                                            <div className={`w-5 h-5 rounded-md ${branding.bg} flex items-center justify-center shrink-0 ${branding.color}`}>
                                                {branding.icon}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-bold text-sm">{conn.name}</span>
                                                <div className="flex items-center gap-1.5 opacity-60">
                                                    <span className={`text-[9px] font-bold uppercase ${branding.color}`}>{branding.label}</span>
                                                    <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/40" />
                                                    <span className="text-[10px] truncate">{conn.host || 'localhost'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </SelectItem>
                                    <div
                                        className="absolute right-2 p-1.5 rounded-md hover:bg-red-500/20 text-muted-foreground hover:text-red-500 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                        onPointerDown={(e) => handleDelete(e, conn.id)}
                                    >
                                        {isDeleting === conn.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash className="w-3.5 h-3.5" />}
                                    </div>
                                </div>
                            );
                        })}
                    </SelectGroup>
                    <div className="p-2 border-t border-border/10 mt-2 bg-muted/10">
                        <div
                            className="flex items-center gap-3 px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-blue-500/10 hover:text-blue-600 transition-all cursor-pointer text-muted-foreground/70"
                            onClick={(e) => {
                                e.stopPropagation();
                                openConnectionDialog();
                            }}
                        >
                            <PlusCircle className="w-4 h-4" />
                            <span>Provision New Server</span>
                        </div>
                    </div>
                </SelectContent>
            </Select>
        </div>
    )
}
