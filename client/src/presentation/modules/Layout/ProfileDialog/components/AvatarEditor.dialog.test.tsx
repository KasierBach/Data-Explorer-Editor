import { useRef, useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/presentation/components/ui/dialog';
import { AvatarEditor } from './AvatarEditor';

const labels: Record<string, string> = {
    'labels.close': 'Đóng',
    edit_avatar_title: 'Chỉnh ảnh đại diện',
    edit_avatar_description: 'Thu phóng và căn ảnh trước khi lưu.',
    avatar_preview_alt: 'Xem trước ảnh đại diện',
    avatar_zoom: 'Thu phóng',
    avatar_horizontal: 'Căn ngang',
    avatar_vertical: 'Căn dọc',
    reset: 'Đặt lại',
    cancel: 'Hủy',
    apply_avatar: 'Lưu ảnh',
};

function NestedAvatarFixture({ busy = false }: { busy?: boolean }) {
    const [profileOpen, setProfileOpen] = useState(true);
    const [avatarOpen, setAvatarOpen] = useState(false);
    const opener = useRef<HTMLButtonElement | null>(null);

    return (
        <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
            <DialogContent closeLabel='Đóng hồ sơ'>
                <DialogTitle>Hồ sơ</DialogTitle>
                <DialogDescription>Hồ sơ kiểm thử</DialogDescription>
                <button ref={opener} onClick={() => setAvatarOpen(true)}>Đổi ảnh đại diện</button>
                <input aria-label='Tên' />
                {avatarOpen && (
                    <AvatarEditor
                        source='data:image/png;base64,iVBORw0KGgo='
                        isSaving={busy}
                        t={(key) => labels[key] || key}
                        returnFocusRef={opener}
                        onClose={() => setAvatarOpen(false)}
                        onApply={vi.fn().mockResolvedValue(true)}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

describe('nested avatar dialog', () => {
    it('traps focus in the child, closes only the child, and restores the opener', async () => {
        const user = userEvent.setup();
        render(<NestedAvatarFixture />);
        const opener = screen.getByRole('button', { name: 'Đổi ảnh đại diện' });
        await user.click(opener);
        const child = screen.getByRole('dialog', { name: 'Chỉnh ảnh đại diện' });
        await waitFor(() => expect(child.contains(document.activeElement)).toBe(true));
        expect(within(child).getByRole('button', { name: 'Đóng' })).toBeInTheDocument();
        expect(within(child).getAllByRole('slider')).toHaveLength(3);

        for (let index = 0; index < 12; index += 1) {
            await user.tab();
            expect(child.contains(document.activeElement)).toBe(true);
        }
        await user.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Chỉnh ảnh đại diện' })).not.toBeInTheDocument());
        expect(screen.getByRole('dialog', { name: 'Hồ sơ' })).toBeInTheDocument();
        await waitFor(() => expect(opener).toHaveFocus());
        await user.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('does not dismiss either dialog while the avatar is saving', async () => {
        const user = userEvent.setup();
        render(<NestedAvatarFixture busy />);
        await user.click(screen.getByRole('button', { name: 'Đổi ảnh đại diện' }));
        const child = screen.getByRole('dialog', { name: 'Chỉnh ảnh đại diện' });
        await waitFor(() => expect(child.contains(document.activeElement)).toBe(true));
        expect(within(child).getByRole('button', { name: 'Đóng' })).toBeDisabled();
        expect(within(child).getByRole('button', { name: 'Hủy' })).toBeDisabled();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(child).toBeInTheDocument();
        expect(document.querySelector('[role="dialog"][aria-hidden="true"]')).toBeInTheDocument();
    });
});
