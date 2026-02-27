import { useState } from "react"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "../../components/ui/select"
import { useAppStore } from "@/core/services/store"
import { PlusCircle, Server, Globe, Trash, Loader2 } from "lucide-react"

export function ConnectionSelector() {
    const { connections, activeConnectionId, setActiveConnectionId, openConnectionDialog, removeConnection, accessToken, logout } = useAppStore()
    const [isDeleting, setIsDeleting] = useState<string | null>(null)

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this connection?')) return;

        setIsDeleting(id);
        try {
            const headers: Record<string, string> = {};
            if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

            const response = await fetch(`http://localhost:3000/api/connections/${id}`, {
                method: 'DELETE',
                headers
            });
            if (response.ok) {
                removeConnection(id);
            } else if (response.status === 401) {
                logout();
                window.location.href = '/login';
            } else {
                const errText = await response.text();
                alert(`Failed to delete connection. Status: ${response.status}\n\nDetails: ${errText}`);
            }
        } catch (error) {
            console.error('Error deleting connection:', error);
            alert('Error deleting connection');
        } finally {
            setIsDeleting(null);
        }
    }

    return (
        <div className="px-0">
            <Select value={activeConnectionId || ''} onValueChange={setActiveConnectionId}>
                <SelectTrigger className="w-full h-10 bg-muted/30 border-none ring-1 ring-border/50 hover:ring-blue-500/30 transition-all rounded-xl shadow-inner group">
                    <div className="flex items-center gap-2.5 truncate">
                        <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors">
                            <Server className="w-3.5 h-3.5 text-blue-500" />
                        </div>
                        <SelectValue placeholder="Select Instance" />
                    </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl ring-1 ring-black/5 backdrop-blur-xl bg-card/95">
                    <SelectGroup>
                        <SelectLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70 px-4 py-2">Available Instances</SelectLabel>
                        {connections.map((conn) => (
                            <div key={conn.id} className="group relative flex items-center pr-2">
                                <SelectItem value={conn.id} className="cursor-pointer focus:bg-blue-500/10 focus:text-blue-600 rounded-lg mx-1 flex-1 pr-8">
                                    <div className="flex flex-col text-left py-0.5">
                                        <span className="font-bold text-sm">{conn.name}</span>
                                        <div className="flex items-center gap-1.5 opacity-60">
                                            <Globe className="w-3 h-3" />
                                            <span className="text-[10px] truncate">{conn.host || 'localhost'}</span>
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
                        ))}
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
