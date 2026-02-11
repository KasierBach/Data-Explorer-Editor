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
import { PlusCircle, Server, Globe } from "lucide-react"

export function ConnectionSelector() {
    const { connections, activeConnectionId, setActiveConnectionId, openConnectionDialog } = useAppStore()

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
                        <SelectLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/50 px-4 py-2">Available Instances</SelectLabel>
                        {connections.map((conn) => (
                            <SelectItem key={conn.id} value={conn.id} className="cursor-pointer focus:bg-blue-500/10 focus:text-blue-600 rounded-lg mx-1">
                                <div className="flex flex-col text-left py-0.5">
                                    <span className="font-bold text-sm">{conn.name}</span>
                                    <div className="flex items-center gap-1.5 opacity-60">
                                        <Globe className="w-3 h-3" />
                                        <span className="text-[10px] truncate">{conn.host || 'localhost'}</span>
                                    </div>
                                </div>
                            </SelectItem>
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
