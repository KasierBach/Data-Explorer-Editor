import { Moon, Sun, Laptop } from "lucide-react"

import { Button } from "@/presentation/components/ui/button"
import { useTheme } from "@/presentation/components/theme-provider"
import { toast } from "sonner"

export function ModeToggle() {
    const { theme, setTheme } = useTheme()

    const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
        setTheme(newTheme);
        const labels = { light: 'Sáng', dark: 'Tối', system: 'Hệ thống' };
        toast.info(`Giao diện: ${labels[newTheme]}`, { 
            duration: 1500,
            icon: newTheme === 'light' ? <Sun className="h-4 w-4" /> : newTheme === 'dark' ? <Moon className="h-4 w-4" /> : <Laptop className="h-4 w-4" />
        });
    };

    return (
        <div className="flex items-center gap-1 border rounded-md p-0.5 bg-background">
            <Button
                variant={theme === 'light' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => handleThemeChange("light")}
            >
                <Sun className="h-4 w-4" />
                <span className="sr-only">Light</span>
            </Button>
            <Button
                variant={theme === 'dark' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => handleThemeChange("dark")}
            >
                <Moon className="h-4 w-4" />
                <span className="sr-only">Dark</span>
            </Button>
            <Button
                variant={theme === 'system' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => handleThemeChange("system")}
            >
                <Laptop className="h-4 w-4" />
                <span className="sr-only">System</span>
            </Button>
        </div>
    )
}
