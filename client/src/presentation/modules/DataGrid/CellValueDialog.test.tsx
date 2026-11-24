import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import type { AppLang } from '@/core/utils/i18n';
import type { SelectedCellState } from './dataGridUtils';
import { CellValueDialog } from './CellValueDialog';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
beforeEach(() => { vi.clearAllMocks(); });

describe('CellValueDialog', () => {
  it.each([
    ['en', 'Close', 'Copy value'],
    ['vi', 'Đóng', 'Sao chép giá trị'],
  ] as const)('localizes its %s close and copy controls and forwards close focus recovery', async (lang: AppLang, closeLabel, copyLabel) => {
    const user = userEvent.setup();
    const onCloseAutoFocus = vi.fn();
    function Harness() {
      const [cell, setCell] = useState<SelectedCellState | null>({ columnName: 'payload', columnType: 'unknown', rowKey: 'row 1', value: '  raw\nvalue  ' });
      return <CellValueDialog cell={cell} lang={lang} onOpenChange={open => { if (!open) setCell(null); }} onCloseAutoFocus={onCloseAutoFocus} />;
    }
    render(<Harness />);
    const dialog = screen.getByRole('dialog', { name: 'payload' });
    expect(dialog.querySelector('pre')?.textContent).toBe('  raw\nvalue  ');
    expect(within(dialog).getByRole('button', { name: copyLabel })).toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: closeLabel }));
    await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalledTimes(1));
  });

  it.each([null, ''])('previews and copies the raw null/empty value %j', async value => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    render(<CellValueDialog cell={{ columnName: 'payload', columnType: 'text', rowKey: 'row 1', value }} lang="en" onOpenChange={vi.fn()} />);
    const expected = value === null ? 'NULL' : '';
    const dialog = screen.getByRole('dialog', { name: 'payload' });
    expect(dialog.querySelector('pre')?.textContent).toBe(expected);
    await user.click(within(dialog).getByRole('button', { name: 'Copy value' }));
    expect(writeText).toHaveBeenCalledWith(expected);
    expect(toast.success).toHaveBeenCalledWith('Copied payload');
  });

  it('keeps the inspector open and reports a generic clipboard failure', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('SYNTHETIC_CLIPBOARD_SECRET'));
    render(<CellValueDialog cell={{ columnName: 'payload', columnType: 'text', rowKey: 'row 1', value: 'raw value' }} lang="en" onOpenChange={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Copy value' }));
    expect(toast.error).toHaveBeenCalledWith('Unable to copy value');
    expect(screen.getByRole('dialog', { name: 'payload' })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SYNTHETIC_CLIPBOARD_SECRET');
  });
});
