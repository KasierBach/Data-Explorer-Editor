import React, { useState } from 'react';
import { ModeToggle } from '@/presentation/components/mode-toggle';
import { Database, Settings, User, LogOut, User as UserIcon, Github, LifeBuoy, Cloud, CreditCard, FileText, FolderOpen, BarChart3, PieChart, GitGraph } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from "@/presentation/components/ui/dropdown-menu"
import { useAppStore } from '@/core/services/store';
import { ProfileDialog } from './ProfileDialog';

export const Navbar: React.FC = () => {
    const { isSidebarOpen, setSidebarOpen, openQueryTab, openInsightsTab, openVisualizeTab, openErdTab, activeConnectionId, user, logout } = useAppStore();
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    return (
        <div className="h-14 border-b flex items-center px-4 bg-card justify-between select-none shrink-0">
            <ProfileDialog isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />

            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <div className="bg-primary/10 p-1.5 rounded-md">
                        <Database className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="font-semibold text-sm leading-none">Data Explorer</h1>
                        <span className="text-[10px] text-muted-foreground">v0.1.0-beta</span>
                    </div>
                </div>

                <div className="flex items-center gap-1 ml-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-muted-foreground hover:text-foreground gap-1.5 px-3"
                        onClick={() => activeConnectionId && openInsightsTab(activeConnectionId)}
                        disabled={!activeConnectionId}
                    >
                        <BarChart3 className="w-4 h-4 text-purple-600" />
                        <span className="font-semibold">Insights</span>
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-muted-foreground hover:text-foreground gap-1.5 px-3"
                        onClick={() => openVisualizeTab()}
                    >
                        <PieChart className="w-4 h-4 text-emerald-500" />
                        <span className="font-semibold">Visualize</span>
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-muted-foreground hover:text-foreground gap-1.5 px-3"
                        onClick={() => activeConnectionId && openErdTab(activeConnectionId, useAppStore.getState().activeDatabase || undefined)}
                        disabled={!activeConnectionId}
                    >
                        <GitGraph className="w-4 h-4 text-blue-500" />
                        <span className="font-semibold">Diagram</span>
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <nav className="flex items-center gap-1">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted">File</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56">
                            <DropdownMenuLabel>File Operations</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openQueryTab()}>
                                <FileText className="mr-2 h-4 w-4" />
                                <span>New Query</span>
                                <DropdownMenuShortcut>Ctrl+N</DropdownMenuShortcut>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <FolderOpen className="mr-2 h-4 w-4" />
                                <span>Open Connection...</span>
                                <DropdownMenuShortcut>Ctrl+O</DropdownMenuShortcut>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Exit</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted">Edit</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56">
                            <DropdownMenuItem>Undo <DropdownMenuShortcut>Ctrl+Z</DropdownMenuShortcut></DropdownMenuItem>
                            <DropdownMenuItem>Redo <DropdownMenuShortcut>Ctrl+Y</DropdownMenuShortcut></DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>Cut <DropdownMenuShortcut>Ctrl+X</DropdownMenuShortcut></DropdownMenuItem>
                            <DropdownMenuItem>Copy <DropdownMenuShortcut>Ctrl+C</DropdownMenuShortcut></DropdownMenuItem>
                            <DropdownMenuItem>Paste <DropdownMenuShortcut>Ctrl+V</DropdownMenuShortcut></DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted">View</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56">
                            <DropdownMenuItem onClick={() => setSidebarOpen(!isSidebarOpen)}>
                                {isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
                                <DropdownMenuShortcut>Ctrl+B</DropdownMenuShortcut>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>Toggle Full Screen <DropdownMenuShortcut>F11</DropdownMenuShortcut></DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted">Help</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56">
                            <DropdownMenuItem>
                                <LifeBuoy className="mr-2 h-4 w-4" />
                                <span>Documentation</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <Github className="mr-2 h-4 w-4" />
                                <span>GitHub</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem disabled>
                                <Cloud className="mr-2 h-4 w-4" />
                                <span>Check for Updates...</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </nav>

                <div className="h-4 w-px bg-border mx-1" />

                <ModeToggle />

                <div className="h-4 w-px bg-border mx-1" />

                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Settings className="w-4 h-4 text-muted-foreground" />
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-muted">
                            <User className="w-4 h-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium leading-none">{user?.name}</p>
                                <p className="text-xs leading-none text-muted-foreground">
                                    {user?.email}
                                </p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem onClick={() => setIsProfileOpen(true)}>
                                <UserIcon className="mr-2 h-4 w-4" />
                                <span>Profile</span>
                                <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <CreditCard className="mr-2 h-4 w-4" />
                                <span>Billing</span>
                                <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <Settings className="mr-2 h-4 w-4" />
                                <span>Settings</span>
                                <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600 focus:text-red-600">
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Log out</span>
                            <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
};
