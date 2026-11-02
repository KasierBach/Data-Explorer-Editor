import { Moon, Sun, Laptop } from "lucide-react"

import { Button } from "@/presentation/components/ui/button"
import { useTheme } from "@/presentation/components/theme-provider"
import { useAppStore } from "@/core/services/store"
import { getWorkspaceText } from "@/core/utils/workspaceText"

export function ModeToggle() {
    const { theme, setTheme } = useTheme()
    const text = getWorkspaceText(useAppStore((state) => state.lang)).themeToggle

    return (
        <div className="flex items-center gap-1 border rounded-md p-0.5 bg-background">
            <Button
                variant={theme === 'light' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => setTheme("light")}
            >
                <Sun className="h-4 w-4" />
                <span className="sr-only">{text.light}</span>
            </Button>
            <Button
                variant={theme === 'dark' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => setTheme("dark")}
            >
                <Moon className="h-4 w-4" />
                <span className="sr-only">{text.dark}</span>
            </Button>
            <Button
                variant={theme === 'system' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => setTheme("system")}
            >
                <Laptop className="h-4 w-4" />
                <span className="sr-only">{text.system}</span>
            </Button>
        </div>
    )
}
