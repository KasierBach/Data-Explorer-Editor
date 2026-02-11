import React from 'react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '../../components/ui/popover';
import { Filter, X } from 'lucide-react';

interface FilterPopoverProps {
    currentFilter: string;
    onFilterChange: (value: string) => void;
}

export const FilterPopover: React.FC<FilterPopoverProps> = ({ currentFilter, onFilterChange }) => {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant={currentFilter ? "secondary" : "ghost"} size="sm" className={currentFilter ? "text-blue-500" : ""}>
                    <Filter className="w-3 h-3 mr-1" />
                    {currentFilter ? 'Filtered' : 'Filter'}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="start">
                <div className="space-y-4">
                    <h4 className="font-medium text-xs text-muted-foreground uppercase">Global Search</h4>
                    <div className="flex gap-2">
                        <Input
                            placeholder="Type to search..."
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
                        Filters across all columns locally.
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};
