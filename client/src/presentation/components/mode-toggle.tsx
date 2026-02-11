import { Moon, Sun, Laptop } from "lucide-react"

import { Button } from "@/presentation/components/ui/button"
import { useTheme } from "@/presentation/components/theme-provider"

export function ModeToggle() {
    const { theme, setTheme } = useTheme()

    return (
        <div className="flex items-center gap-1 border rounded-md p-0.5 bg-background">
            <Button
                variant={theme === 'light' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => setTheme("light")}
            >
                <Sun className="h-4 w-4" />
                <span className="sr-only">Light</span>
            </Button>
            <Button
                variant={theme === 'dark' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => setTheme("dark")}
            >
                <Moon className="h-4 w-4" />
                <span className="sr-only">Dark</span>
            </Button>
            <Button
                variant={theme === 'system' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => setTheme("system")}
            >
                <Laptop className="h-4 w-4" />
                <span className="sr-only">System</span>
            </Button>
        </div>
    )
}
