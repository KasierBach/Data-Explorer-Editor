import React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import type { TeamspaceEntity } from '@/core/services/TeamspaceService';
import { useResourcePresence } from '@/presentation/hooks/useResourcePresence';
import { PresenceBadge } from '@/presentation/components/presence/PresenceBadge';

type TeamspaceGroupedResource<T> = {
  teamspace: TeamspaceEntity | null;
  items: T[];
};

function groupResourcesByTeamspace<T extends { id: string; teamspaceId?: string | null }>(
  items: T[],
  teamspaces: TeamspaceEntity[],
) {
  const grouped = new Map<string | null, T[]>();

  for (const item of items) {
    const key = item.teamspaceId ?? null;
    const current = grouped.get(key) ?? [];
    current.push(item);
    grouped.set(key, current);
  }

  const sections: TeamspaceGroupedResource<T>[] = [];

  for (const teamspace of teamspaces) {
    const teamspaceItems = grouped.get(teamspace.id);
    if (teamspaceItems && teamspaceItems.length > 0) {
      sections.push({ teamspace, items: teamspaceItems });
      grouped.delete(teamspace.id);
    }
  }

  const unassignedItems = grouped.get(null);
  if (unassignedItems && unassignedItems.length > 0) {
    sections.push({ teamspace: null, items: unassignedItems });
  }

  return sections;
}

export function TeamspaceCard({
  organizationId,
  teamspace,
  canManage,
  lang,
  onDelete,
}: {
  organizationId: string;
  teamspace: TeamspaceEntity;
  canManage: boolean;
  lang: 'vi' | 'en';
  onDelete: (teamspaceId: string) => void;
}) {
  const presence = useResourcePresence(
    organizationId
      ? {
          organizationId,
          teamspaceId: teamspace.id,
        }
      : null,
    {
      enabled: Boolean(organizationId),
      intervalMs: 20_000,
    },
  );

  return (
    <div className="rounded-md border border-border/60 bg-background px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{teamspace.name}</div>
          {teamspace.description && (
            <div className="mt-1 max-h-10 overflow-hidden text-xs text-muted-foreground">
              {teamspace.description}
            </div>
          )}
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
          {teamspace.resourceCount}
        </span>
      </div>
      <div className="mt-2">
        <PresenceBadge
          entries={presence.entries}
          isLoading={presence.isLoading}
          label={lang === 'vi' ? 'Teamspace live' : 'Teamspace live'}
          emptyLabel={lang === 'vi' ? 'Chua co ai dang hoat dong' : 'No one active yet'}
          className="w-full justify-between"
        />
      </div>
      {canManage && (
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] text-destructive"
            onClick={() => onDelete(teamspace.id)}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            {lang === 'vi' ? 'Xoa' : 'Delete'}
          </Button>
        </div>
      )}
    </div>
  );
}

export function TeamspaceResourceGroups<T extends { id: string; teamspaceId?: string | null }>({
  items,
  teamspaces,
  loading,
  emptyMessage,
  renderItem,
}: {
  items: T[];
  teamspaces: TeamspaceEntity[];
  loading: boolean;
  emptyMessage: string;
  renderItem: (item: T) => React.ReactNode;
}) {
  if (loading) {
    return <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading...</div>;
  }

  if (items.length === 0) {
    return <div className="px-4 py-8 text-center text-sm text-muted-foreground">{emptyMessage}</div>;
  }

  const sections = groupResourcesByTeamspace(items, teamspaces);

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <section key={section.teamspace?.id ?? 'unassigned'} className="overflow-hidden rounded-lg border">
          <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-2">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {section.teamspace?.name ?? 'Unassigned'}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {section.items.length} resource{section.items.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>
          <div className="divide-y">
            {section.items.map((item) => (
              <React.Fragment key={item.id}>{renderItem(item)}</React.Fragment>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
