
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
import { Database, PlusCircle } from "lucide-react"

export function ConnectionSelector() {
    const { connections, activeConnectionId, setActiveConnectionId, openConnectionDialog } = useAppStore()

    return (
        <div className="p-2">
            <Select value={activeConnectionId || ''} onValueChange={setActiveConnectionId}>
                <SelectTrigger className="w-full h-9">
                    <div className="flex items-center gap-2 truncate">
                        <Database className="w-4 h-4 text-muted-foreground shrink-0" />
                        <SelectValue placeholder="Select Connection" />
                    </div>
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        <SelectLabel>Connections</SelectLabel>
                        {connections.map((conn) => (
                            <SelectItem key={conn.id} value={conn.id}>
                                <div className="flex flex-col text-left">
                                    <span className="font-medium">{conn.name}</span>
                                    <span className="text-[10px] text-muted-foreground">{conn.host}</span>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectGroup>
                    <div className="p-1 border-t mt-1">
                        <div
                            className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent cursor-pointer text-muted-foreground"
                            onClick={(e) => {
                                e.stopPropagation();
                                openConnectionDialog();
                            }}
                        >
                            <PlusCircle className="w-4 h-4" />
                            <span>Manage Connections...</span>
                        </div>
                    </div>
                </SelectContent>
            </Select>
        </div>
    )
}
