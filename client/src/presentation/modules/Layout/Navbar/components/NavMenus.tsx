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
import { FileText, FolderOpen, LogOut, LifeBuoy, Github, Cloud } from 'lucide-react';

interface NavMenusProps {
    lang: string;
    openQueryTab: () => void;
    isSidebarOpen: boolean;
    setSidebarOpen: (v: boolean) => void;
}

export const NavMenus: React.FC<NavMenusProps> = ({ 
    lang, 
    openQueryTab, 
    isSidebarOpen, 
    setSidebarOpen 
}) => {
    return (
        <nav className="flex items-center gap-1">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted">
                        {lang === 'vi' ? 'Tệp' : 'File'}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                    <DropdownMenuLabel>{lang === 'vi' ? 'Thao tác Tệp' : 'File Operations'}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => openQueryTab()}>
                        <FileText className="mr-2 h-4 w-4" />
                        <span>{lang === 'vi' ? 'Truy vấn mới' : 'New Query'}</span>
                        <DropdownMenuShortcut>Ctrl+N</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <FolderOpen className="mr-2 h-4 w-4" />
                        <span>{lang === 'vi' ? 'Mở kết nối...' : 'Open Connection...'}</span>
                        <DropdownMenuShortcut>Ctrl+O</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>{lang === 'vi' ? 'Thoát' : 'Exit'}</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted">
                        {lang === 'vi' ? 'Sửa' : 'Edit'}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                    <DropdownMenuItem>{lang === 'vi' ? 'Hoàn tác' : 'Undo'} <DropdownMenuShortcut>Ctrl+Z</DropdownMenuShortcut></DropdownMenuItem>
                    <DropdownMenuItem>{lang === 'vi' ? 'Lấy lại' : 'Redo'} <DropdownMenuShortcut>Ctrl+Y</DropdownMenuShortcut></DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>{lang === 'vi' ? 'Cắt' : 'Cut'} <DropdownMenuShortcut>Ctrl+X</DropdownMenuShortcut></DropdownMenuItem>
                    <DropdownMenuItem>{lang === 'vi' ? 'Sao chép' : 'Copy'} <DropdownMenuShortcut>Ctrl+C</DropdownMenuShortcut></DropdownMenuItem>
                    <DropdownMenuItem>{lang === 'vi' ? 'Dán' : 'Paste'} <DropdownMenuShortcut>Ctrl+V</DropdownMenuShortcut></DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted">
                        {lang === 'vi' ? 'Xem' : 'View'}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                    <DropdownMenuItem onClick={() => setSidebarOpen(!isSidebarOpen)}>
                        {isSidebarOpen ? (lang === 'vi' ? "Ẩn thanh bên" : "Hide Sidebar") : (lang === 'vi' ? "Hiện thanh bên" : "Show Sidebar")}
                        <DropdownMenuShortcut>Ctrl+B</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>{lang === 'vi' ? 'Cửa sổ toàn màn hình' : 'Toggle Full Screen'} <DropdownMenuShortcut>F11</DropdownMenuShortcut></DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted">
                        {lang === 'vi' ? 'Trợ giúp' : 'Help'}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                    <DropdownMenuItem className="cursor-pointer" onClick={() => window.open('/docs', '_blank')}>
                        <LifeBuoy className="mr-2 h-4 w-4" />
                        <span>{lang === 'vi' ? 'Tài liệu hướng dẫn' : 'Documentation'}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer" onClick={() => window.open('https://github.com/KasierBach/Data-Explorer-Editor.git', '_blank')}>
                        <Github className="mr-2 h-4 w-4" />
                        <span>GitHub</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled>
                        <Cloud className="mr-2 h-4 w-4" />
                        <span>{lang === 'vi' ? 'Kiểm tra cập nhật...' : 'Check for Updates...'}</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </nav>
    );
};
