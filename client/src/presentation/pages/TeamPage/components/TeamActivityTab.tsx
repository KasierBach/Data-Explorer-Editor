import { Activity, Layers, MessageSquare, Share2, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/presentation/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { CollaborationActivityLog } from '@/core/services/CollaborationService';

interface TeamActivityTabProps {
  activities: CollaborationActivityLog[];
  lang: 'vi' | 'en';
}

function getParticipantName(user?: CollaborationActivityLog['user']) {
  if (!user) {
    return 'System';
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fullName || user.email || user.username || 'System';
}

function getActivityIcon(action: string) {
  if (action.includes('COMMENT')) return MessageSquare;
  if (action.includes('RESOURCE')) return Share2;
  if (action.includes('TEAMSPACE')) return Layers;
  if (action.includes('TEAM')) return User;
  return Activity;
}

function formatAction(action: string) {
  return action
    .replace(/^TEAM:/, '')
    .replace(/^DB:/, '')
    .replace(/^AUTH:/, '')
    .replace(/^USER:/, '')
    .replace(/^SYSTEM:/, '')
    .replace(/_/g, ' ')
    .toLowerCase();
}

export function TeamActivityTab({ activities, lang }: TeamActivityTabProps) {
  if (activities.length === 0) {
    return (
      <div className="rounded-lg border px-4 py-8 text-center text-sm text-muted-foreground">
        {lang === 'vi' ? 'Chua co hoat dong nao trong team.' : 'No team activity yet.'}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      {activities.map((log) => {
        const user = log.user;
        const initials = user
          ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}` || user.email?.[0]?.toUpperCase() || 'U'
          : 'U';
        const Icon = getActivityIcon(log.action);
        const actorName = getParticipantName(user);

        return (
          <div key={log.id} className="relative flex gap-3 rounded-lg bg-muted/20 p-3">
            <div className="shrink-0">
              <Avatar className="h-8 w-8 border">
                {user?.avatarUrl && <AvatarImage src={user.avatarUrl} />}
                <AvatarFallback className="bg-blue-500/10 text-[10px] font-bold text-blue-600">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-start gap-2">
                <Icon className={cn('mt-0.5 h-4 w-4 shrink-0 text-muted-foreground')} />
                <p className="min-w-0 text-sm leading-relaxed">
                  <span className="font-semibold">{actorName}</span>{' '}
                  <span className="text-muted-foreground">{formatAction(log.action)}</span>
                  {log.details?.resourceName && (
                    <>
                      {' '}
                      <span className="font-medium text-primary">"{log.details.resourceName}"</span>
                    </>
                  )}
                  {log.details?.name && !log.details.resourceName && (
                    <>
                      {' '}
                      <span className="font-medium text-primary">"{log.details.name}"</span>
                    </>
                  )}
                </p>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {new Date(log.createdAt).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: '2-digit',
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
