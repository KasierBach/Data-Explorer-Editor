import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog';

function TestDialog({ closeLabel }: { closeLabel?: string }) {
  return (
    <Dialog open>
      <DialogContent closeLabel={closeLabel}>
        <DialogTitle>Example</DialogTitle>
        <DialogDescription>Dialog fixture</DialogDescription>
      </DialogContent>
    </Dialog>
  );
}

describe('DialogContent', () => {
  it('uses a custom accessible close label without leaking the prop', () => {
    render(<TestDialog closeLabel="Đóng" />);

    const button = screen.getByRole('button', { name: 'Đóng' });
    expect(button).toBeInTheDocument();
    expect(screen.getByRole('dialog')).not.toHaveAttribute('closeLabel');
  });

  it('keeps Close as the backward-compatible default', () => {
    render(<TestDialog />);

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});
