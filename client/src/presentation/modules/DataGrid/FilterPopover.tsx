import React from 'react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '../../components/ui/popover';
import { Filter, X } from 'lucide-react';
import type { AppLang } from '@/core/utils/i18n';
import { getDataGridText } from './dataGridI18n';

interface FilterPopoverProps {
    lang: AppLang;
    currentFilter: string;
    onFilterChange: (value: string) => void;
}

export const FilterPopover: React.FC<FilterPopoverProps> = ({ lang, currentFilter, onFilterChange }) => {
    const text = getDataGridText(lang);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant={currentFilter ? "secondary" : "ghost"} size="sm" className={currentFilter ? "text-blue-500" : ""}>
                    <Filter className="w-3 h-3 mr-1" />
                    {currentFilter ? text.filtered : text.filter}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(20rem,calc(100vw-1rem))] p-3" align="start">
                <div className="space-y-4">
                    <h4 className="font-medium text-xs text-muted-foreground uppercase">{text.globalSearch}</h4>
                    <div className="flex gap-2">
                        <Input
                            placeholder={text.typeToSearch}
                            value={currentFilter}
                            onChange={(e) => onFilterChange(e.target.value)}
                            className="h-8 text-xs"
                        />
                        {currentFilter && (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => onFilterChange('')}>
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                        {text.filtersAcrossAllColumns}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};
