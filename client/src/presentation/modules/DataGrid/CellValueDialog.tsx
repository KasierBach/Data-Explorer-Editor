import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/presentation/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog';
import type { SelectedCellState } from './dataGridUtils';
import { serializeDatabaseValue } from './dataGridUtils';

interface CellValueDialogProps {
  cell: SelectedCellState | null;
  onOpenChange: (open: boolean) => void;
}

function isStructuredValue(value: SelectedCellState['value']) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !(value instanceof Date) &&
    !(value instanceof Uint8Array)
  );
}

export function CellValueDialog({
  cell,
  onOpenChange,
}: CellValueDialogProps) {
  const handleCopy = async () => {
    if (!cell) return;

    try {
      await navigator.clipboard.writeText(
        serializeDatabaseValue(cell.value, true),
      );
      toast.success(`Copied ${cell.columnName}`);
    } catch {
      toast.error('Unable to copy value');
    }
  };

  const displayValue = cell
    ? serializeDatabaseValue(cell.value, isStructuredValue(cell.value))
    : '';

  return (
    <Dialog open={Boolean(cell)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-1rem)] border-border/60 bg-background/95 p-0 shadow-2xl backdrop-blur-xl sm:max-w-3xl">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <DialogTitle className="text-base font-semibold text-foreground">
                {cell?.columnName || 'Cell value'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Full value preview for the selected cell.
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={!cell}
              className="h-8 gap-1.5 text-[11px]"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy value
            </Button>
          </div>
          {cell ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {cell.columnType}
              </span>
              <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {cell.rowKey}
              </span>
            </div>
          ) : null}
        </DialogHeader>

        <div className="px-5 pb-5 pt-4">
          <div className="rounded-xl border border-border/60 bg-muted/[0.18] p-4">
            <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-6 text-foreground/92">
              {displayValue}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
