import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SaveQueryDialog, type SaveQueryFormValues } from './SaveQueryDialog';

const initialValues: SaveQueryFormValues = {
  name: 'Daily report',
  visibility: 'private',
  organizationId: '',
  folderId: '',
  tags: '',
  description: '',
};

describe('Save query accessible form', () => {
  it('names its fields and selectors from the active language', () => {
    render(<SaveQueryDialog open onOpenChange={vi.fn()} lang="en" initialValues={initialValues} onSubmit={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Save query' })).toBeInTheDocument();
    expect(screen.getByLabelText('Display name', { exact: true })).toHaveValue('Daily report');
    expect(screen.getByRole('combobox', { name: 'Visibility' })).toBeInTheDocument();
    expect(screen.getByLabelText('Folder / Group', { exact: true })).toBeInTheDocument();
    expect(screen.getByLabelText('Tags (comma-separated)', { exact: true })).toBeInTheDocument();
    expect(screen.getByLabelText('Description', { exact: true })).toBeInTheDocument();
  });

  it('announces a failed save, keeps the dialog open, and associates the error with its name field', async () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn().mockRejectedValue(new Error('You no longer have write access.'));
    render(<SaveQueryDialog open onOpenChange={onOpenChange} lang="en" initialValues={initialValues} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save query' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('You no longer have write access.'));
    expect(screen.getByLabelText('Display name', { exact: true })).toHaveAccessibleDescription('You no longer have write access.');
    expect(screen.getByRole('dialog', { name: 'Save query' })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('names the Vietnamese workspace selector without changing its sharing contract', () => {
    render(<SaveQueryDialog open onOpenChange={vi.fn()} lang="vi" initialValues={{ ...initialValues, visibility: 'workspace', organizationId: 'team-fixture' }} workspaceOptions={[{ id: 'team-fixture', name: 'Fixture team' }]} onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('Tên hiển thị', { exact: true })).toHaveValue('Daily report');
    expect(screen.getByRole('combobox', { name: 'Quyền hiển thị' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Workspace / Team' })).toHaveTextContent('Fixture team');
  });
});
