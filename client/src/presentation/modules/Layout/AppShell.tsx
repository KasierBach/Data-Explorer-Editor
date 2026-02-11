import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/presentation/components/ui/resizable"
import { ExplorerSidebar } from "../Explorer/ExplorerSidebar"
import { MainContent } from "./MainContent"
import { useAppStore } from "@/core/services/store"
import { Navbar } from './Navbar';
import { ConnectionDialog } from '@/presentation/modules/Connection/ConnectionDialog';

export function AppShell() {
    const isSidebarOpen = useAppStore(state => state.isSidebarOpen);

    return (
        <div className="h-screen w-full bg-background overflow-hidden flex flex-col">
            <Navbar />

            <ResizablePanelGroup orientation="horizontal" className="flex-1">
                {isSidebarOpen && (
                    <>
                        <ResizablePanel defaultSize="20" minSize="15" maxSize="40" className="min-w-[200px] border-r">
                            <ExplorerSidebar />
                        </ResizablePanel>
                        <ResizableHandle withHandle />
                    </>
                )}

                <ResizablePanel defaultSize="80">
                    <MainContent />
                </ResizablePanel>
            </ResizablePanelGroup>

            <div className="h-6 border-t bg-muted/40 text-xs flex items-center px-4 text-muted-foreground shrink-0">
                Ready
            </div>
            <ConnectionDialog />
        </div>
    )
}
