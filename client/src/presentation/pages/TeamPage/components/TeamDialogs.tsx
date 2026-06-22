import React, { useState } from 'react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Textarea } from '@/presentation/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import { useAppStore } from '@/core/services/store';
import { getTeamText } from '../teamI18n';

export function InviteMemberDialog({
  open,
  email,
  role,
  onOpenChange,
  onEmailChange,
  onRoleChange,
  onInvite,
}: {
  open: boolean;
  email: string;
  role: string;
  onOpenChange: (open: boolean) => void;
  onEmailChange: (email: string) => void;
  onRoleChange: (role: string) => void;
  onInvite: () => void;
}) {
  const { lang } = useAppStore();
  const text = getTeamText(lang);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{text.inviteMemberTitle}</DialogTitle>
          <DialogDescription>{text.inviteMemberDescription}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium">{text.email}</label>
            <Input
              type="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">{text.languageRole}</label>
            <Select value={role} onValueChange={onRoleChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">{text.admin}</SelectItem>
                <SelectItem value="MEMBER">{text.member}</SelectItem>
                <SelectItem value="VIEWER">{text.viewer}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {text.cancel}
          </Button>
          <Button onClick={onInvite}>{text.sendInvite}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreateTeamDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const { lang } = useAppStore();
  const text = getTeamText(lang);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim());
    setName('');
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{text.createTeamTitle}</DialogTitle>
          <DialogDescription>{text.createTeamDescription}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium">{text.teamName}</label>
            <Input
              placeholder="Engineering Team"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {text.cancel}
            </Button>
            <Button type="submit">{text.create}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateTeamspaceDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, description?: string) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { lang } = useAppStore();
  const text = getTeamText(lang);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), description.trim() || undefined);
    setName('');
    setDescription('');
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{text.createTeamspaceTitle}</DialogTitle>
          <DialogDescription>{text.createTeamspaceDescription}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">{text.name}</label>
            <Input
              placeholder="Data Platform"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{text.description}</label>
            <Textarea
              placeholder={text.teamspaceNotePlaceholder}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {text.cancel}
            </Button>
            <Button type="submit">{text.create}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
