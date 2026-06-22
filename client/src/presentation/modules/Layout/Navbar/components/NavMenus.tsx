import React from 'react';
import { Button } from '@/presentation/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from "@/presentation/components/ui/dropdown-menu"
import { FileText, LifeBuoy, Github, Cloud, Copy, X } from 'lucide-react';
import { useAppStore } from '@/core/services/store';
import { getWorkspaceText } from '@/core/utils/workspaceText';

interface NavMenusProps {
    lang: string;
    openQueryTab: () => void;
    isSidebarOpen: boolean;
    setSidebarOpen: (v: boolean) => void;
    isNoSql?: boolean;
}

export const NavMenus: React.FC<NavMenusProps> = ({ 
    lang, 
    openQueryTab, 
    isSidebarOpen, 
    setSidebarOpen,
    isNoSql
}) => {
    const { openTab, closeAllTabs, isResultPanelOpen, toggleResultPanel } = useAppStore();
    const text = getWorkspaceText(lang).navMenus;

    const handleDuplicateTab = () => {
        const state = useAppStore.getState();
        const activeTab = state.tabs.find(t => t.id === state.activeTabId);
        if (activeTab) {
            openTab({
                ...activeTab,
                id: `tab-${Date.now()}`,
                title: `${activeTab.title} (Copy)`,
            });
        }
    };

    return (
        <nav className="flex items-center gap-1">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted">
                        {text.file}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" sideOffset={8} align="start">
                    <DropdownMenuLabel>{text.fileOperations}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => {
                        if (isNoSql) {
                            const { setNosqlMqlQuery } = useAppStore.getState();
                            setNosqlMqlQuery('{\n  "query": {},\n  "limit": 50\n}');
                        } else {
                            openQueryTab();
                        }
                    }}>
                        <FileText className="mr-2 h-4 w-4" />
                        <span>{text.newQuery}</span>
                        <DropdownMenuShortcut>Ctrl+N</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDuplicateTab} disabled={isNoSql}>
                        <Copy className="mr-2 h-4 w-4" />
                        <span>{text.duplicateTab}</span>
                        <DropdownMenuShortcut>Ctrl+D</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={closeAllTabs} className="text-destructive focus:text-destructive" disabled={isNoSql}>
                        <X className="mr-2 h-4 w-4" />
                        <span>{text.closeAllTabs}</span>
                        <DropdownMenuShortcut>Ctrl+Shift+W</DropdownMenuShortcut>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted">
                        {text.edit}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" sideOffset={8} align="start">
                    <DropdownMenuItem>{text.undo} <DropdownMenuShortcut>Ctrl+Z</DropdownMenuShortcut></DropdownMenuItem>
                    <DropdownMenuItem>{text.redo} <DropdownMenuShortcut>Ctrl+Y</DropdownMenuShortcut></DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>{text.cut} <DropdownMenuShortcut>Ctrl+X</DropdownMenuShortcut></DropdownMenuItem>
                    <DropdownMenuItem>{text.copy} <DropdownMenuShortcut>Ctrl+C</DropdownMenuShortcut></DropdownMenuItem>
                    <DropdownMenuItem>{text.paste} <DropdownMenuShortcut>Ctrl+V</DropdownMenuShortcut></DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted">
                        {text.view}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" sideOffset={8} align="start">
                    <DropdownMenuItem onClick={() => setSidebarOpen(!isSidebarOpen)}>
                        {isSidebarOpen ? text.hideSidebar : text.showSidebar}
                        <DropdownMenuShortcut>Ctrl+B</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={toggleResultPanel}>
                        {isResultPanelOpen ? text.hideResultPanel : text.showResultPanel}
                        <DropdownMenuShortcut>Ctrl+J</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>{text.toggleFullScreen} <DropdownMenuShortcut>F11</DropdownMenuShortcut></DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted">
                        {text.help}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" sideOffset={8} align="start">
                    <DropdownMenuItem className="cursor-pointer" onClick={() => window.open('/docs', '_blank')}>
                        <LifeBuoy className="mr-2 h-4 w-4" />
                        <span>{text.documentation}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer" onClick={() => window.open('https://github.com/KasierBach/Data-Explorer-Editor.git', '_blank')}>
                        <Github className="mr-2 h-4 w-4" />
                        <span>GitHub</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled>
                        <Cloud className="mr-2 h-4 w-4" />
                        <span>{text.checkUpdates}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="opacity-50 text-[10px] flex justify-center py-1">
                        {text.globalShortcuts}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </nav>
    );
};
