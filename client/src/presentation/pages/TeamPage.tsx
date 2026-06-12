import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/presentation/components/ui/button';
import { Textarea } from '@/presentation/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/presentation/components/ui/select';
import {
  OrganizationService,
  type OrganizationEntity,
  type OrganizationInvitationEntity,
  type OrganizationMemberEntity,
  type OrganizationBackupPackage,
  type OrganizationBackupRestoreResult,
  type TeamActivityEntity,
  type TeamConnectionEntity,
  type TeamDashboardEntity,
  type TeamQueryEntity,
  type TeamResourcePermissionPolicy,
} from '@/core/services/OrganizationService';
import {
  TeamspaceService,
  type TeamspaceEntity,
} from '@/core/services/TeamspaceService';
import { ApiError } from '@/core/services/api.service';
import {
  CollaborationService,
  type CollaborationResourceType,
} from '@/core/services/CollaborationService';
import { useAppStore } from '@/core/services/store';
import { useResponsiveLayoutMode } from '@/presentation/hooks/useResponsiveLayoutMode';
import { cn } from '@/lib/utils';
import { TeamActivityTab } from './TeamPage/components/TeamActivityTab';
import { TeamCommentsDrawer } from './TeamPage/components/TeamCommentsDrawer';
import { CreateTeamDialog, CreateTeamspaceDialog, InviteMemberDialog } from './TeamPage/components/TeamDialogs';
import { TeamMembersPanel } from './TeamPage/components/TeamMembersPanel';
import { TeamspaceCard, TeamspaceResourceGroups } from './TeamPage/components/TeamspaceResourceGroups';
import { getTeamText } from './TeamPage/teamI18n';
import {
  ArrowLeft, Database, FileText, LayoutDashboard, Mail,
  MessageSquare, Plus, Trash2, Users, Download, Upload,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

type TeamTab = 'members' | 'connections' | 'queries' | 'dashboards' | 'activity' | 'backups';

interface TeamCommentTarget {
  resourceType: CollaborationResourceType;
  resourceId: string;
  resourceName: string;
}

const TEAMSPACE_UNASSIGNED = '__unassigned__';

function getPermissionLabel(
  role: string | undefined,
  permissions: TeamResourcePermissionPolicy | undefined,
  lang: 'vi' | 'en',
) {
  const text = getTeamText(lang);

  if (!role) {
    return text.shared;
  }

  const normalizedRole = role.toUpperCase();
  const allowed = permissions?.[normalizedRole] ?? [];

  if (allowed.includes('manage')) return text.manage;
  if (allowed.includes('write')) return text.edit;
  if (allowed.includes('comment')) return text.comments;
  if (allowed.includes('read')) return text.read;
  return text.shared;
}

function canCommentResource(role: string | undefined, permissions?: TeamResourcePermissionPolicy) {
  if (!role) {
    return false;
  }

  const normalizedRole = role.toUpperCase();
  const allowed = permissions?.[normalizedRole] ?? [];
  return allowed.includes('comment') || allowed.includes('write') || allowed.includes('manage');
}

function ResourceActions({
  permissionLabel,
  canComment,
  onCommentClick,
  lang,
}: {
  permissionLabel: string;
  canComment: boolean;
  onCommentClick: () => void;
  lang: 'vi' | 'en';
}) {
  const text = getTeamText(lang);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        {permissionLabel}
      </span>
      {canComment && (
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onCommentClick}>
          <MessageSquare className="mr-1 h-3.5 w-3.5" />
          {text.comments}
        </Button>
      )}
    </div>
  );
}

function renderTeamspaceOptions(teamspaces: TeamspaceEntity[]) {
  return teamspaces.map((teamspace) => (
    <SelectItem key={teamspace.id} value={teamspace.id} className="text-xs">
      {teamspace.name}
    </SelectItem>
  ));
}

function downloadJsonFile(filename: string, content: unknown) {
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function TeamPage() {
  const navigate = useNavigate();
  const { lang } = useAppStore();
  const text = getTeamText(lang);
  const { isCompactMobileLayout, isSmallMobile } = useResponsiveLayoutMode();
  const [orgs, setOrgs] = useState<OrganizationEntity[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitationEntity[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationEntity | null>(null);
  const [members, setMembers] = useState<OrganizationMemberEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateTeamspace, setShowCreateTeamspace] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [activeTab, setActiveTab] = useState<TeamTab>('members');
  const [teamConnections, setTeamConnections] = useState<TeamConnectionEntity[]>([]);
  const [teamQueries, setTeamQueries] = useState<TeamQueryEntity[]>([]);
  const [teamDashboards, setTeamDashboards] = useState<TeamDashboardEntity[]>([]);
  const [teamspaces, setTeamspaces] = useState<TeamspaceEntity[]>([]);
  const [teamActivities, setTeamActivities] = useState<TeamActivityEntity[]>([]);
  const [backupJson, setBackupJson] = useState('');
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupRestoring, setBackupRestoring] = useState(false);
  const [backupSummary, setBackupSummary] = useState<OrganizationBackupRestoreResult | null>(null);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [commentTarget, setCommentTarget] = useState<TeamCommentTarget | null>(null);
  const selectedOrgId = selectedOrg?.id ?? null;

  const loadOrgs = useCallback(async () => {
    try {
      const data = await OrganizationService.getMyOrganizations();
      setOrgs(data);
      if (data.length > 0) {
        setSelectedOrg((current) => current ?? data[0]);
      }
    } catch {
      toast.error(text.failedLoadTeams);
    } finally {
      setLoading(false);
    }
  }, [text.failedLoadTeams]);

  const loadInvitations = useCallback(async () => {
    try {
      const data = await OrganizationService.getMyInvitations();
      setInvitations(data);
    } catch {
      toast.error(text.failedLoadInvitations);
    }
  }, [text.failedLoadInvitations]);

  const loadMembers = useCallback(async (orgId: string) => {
    try {
      const data = await OrganizationService.getMembers(orgId);
      setMembers(data);
    } catch {
      toast.error(text.failedLoadMembers);
    }
  }, [text.failedLoadMembers]);

  const loadResources = useCallback(async (orgId: string) => {
    setResourcesLoading(true);
    try {
      const [connections, queries, dashboards] = await Promise.all([
        OrganizationService.getTeamConnections(orgId).catch(() => [] as TeamConnectionEntity[]),
        OrganizationService.getTeamQueries(orgId).catch(() => [] as TeamQueryEntity[]),
        OrganizationService.getTeamDashboards(orgId).catch(() => [] as TeamDashboardEntity[]),
      ]);
      setTeamConnections(connections);
      setTeamQueries(queries);
      setTeamDashboards(dashboards);
    } finally {
      setResourcesLoading(false);
    }
  }, []);

  const loadTeamspaces = useCallback(async (orgId: string) => {
    try {
      const data = await TeamspaceService.getTeamspaces(orgId);
      setTeamspaces(data);
    } catch {
      toast.error(text.failedLoadTeamspaces);
    }
  }, [text.failedLoadTeamspaces]);

  const loadActivity = useCallback(async (orgId: string) => {
    setActivityLoading(true);
    try {
      const data = await CollaborationService.getOrganizationActivity(orgId, 50);
      setTeamActivities(data);
    } catch {
      toast.error(text.failedLoadActivity);
    } finally {
      setActivityLoading(false);
    }
  }, [text.failedLoadActivity]);

  useEffect(() => {
    void loadOrgs();
    void loadInvitations();
  }, [loadInvitations, loadOrgs]);

  useEffect(() => {
    if (selectedOrgId) {
      void loadMembers(selectedOrgId);
      void loadTeamspaces(selectedOrgId);
      void loadResources(selectedOrgId);
    }
  }, [loadMembers, loadResources, loadTeamspaces, selectedOrgId]);

  useEffect(() => {
    if (selectedOrgId && activeTab === 'activity') {
      void loadActivity(selectedOrgId);
    }
  }, [activeTab, loadActivity, selectedOrgId]);

  useEffect(() => {
    setCommentTarget(null);
    setBackupJson('');
    setBackupSummary(null);
  }, [selectedOrgId]);

  async function handleExportBackup() {
    if (!selectedOrg) return;

    setBackupLoading(true);
    try {
      const backup = await OrganizationService.exportOrganizationBackup(selectedOrg.id);
      setBackupJson(JSON.stringify(backup, null, 2));
      downloadJsonFile(`data-explorer-backup-${selectedOrg.slug}.json`, backup);
      toast.success(text.backupExported);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : text.exportBackupFailed;
      toast.error(message);
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleRestoreBackup() {
    if (!selectedOrg || !backupJson.trim()) return;

    setBackupRestoring(true);
    setBackupSummary(null);
    try {
      const parsed = JSON.parse(backupJson) as OrganizationBackupPackage;
      const result = await OrganizationService.restoreOrganizationBackup(selectedOrg.id, parsed);
      setBackupSummary(result);

      const [orgsData] = await Promise.all([
        OrganizationService.getMyOrganizations(),
        loadResources(selectedOrg.id),
        loadTeamspaces(selectedOrg.id),
        loadMembers(selectedOrg.id),
      ]);

      setOrgs(orgsData);
      setSelectedOrg(orgsData.find((org) => org.id === selectedOrg.id) ?? selectedOrg);
      toast.success(text.restoreComplete);
    } catch (error) {
      const message = error instanceof SyntaxError
        ? text.backupJsonInvalid
        : error instanceof ApiError
          ? error.message
          : text.restoreBackupFailed;
      toast.error(message);
    } finally {
      setBackupRestoring(false);
    }
  }

  async function handleCreate(name: string) {
    try {
      const org = await OrganizationService.createOrganization({ name });
      setOrgs((prev) => [...prev, org]);
      setSelectedOrg(org);
      setShowCreate(false);
      toast.success(text.createTeamSuccess);
    } catch {
      toast.error(text.createTeamFailed);
    }
  }

  async function handleCreateTeamspace(name: string, description?: string) {
    if (!selectedOrg) return;

    try {
      const teamspace = await TeamspaceService.createTeamspace(selectedOrg.id, {
        name,
        description,
      });
      setTeamspaces((prev) => [...prev, teamspace]);
      setShowCreateTeamspace(false);
      toast.success(text.teamspaceCreated);
    } catch {
      toast.error(text.createTeamspaceFailed);
    }
  }

  async function handleDeleteTeamspace(teamspaceId: string) {
    if (!selectedOrg) return;

    try {
      await TeamspaceService.deleteTeamspace(selectedOrg.id, teamspaceId);
      setTeamspaces((prev) => prev.filter((teamspace) => teamspace.id !== teamspaceId));
      await loadResources(selectedOrg.id);
      toast.success(text.teamspaceDeleted);
    } catch {
      toast.error(text.teamspaceDeleteFailed);
    }
  }

  async function handleAssignResourceTeamspace(
    resourceType: CollaborationResourceType,
    resourceId: string,
    teamspaceId: string | null,
  ) {
    if (!selectedOrg) return;

    try {
      await TeamspaceService.assignResourceTeamspace(selectedOrg.id, resourceType, resourceId, {
        teamspaceId,
      });
      await loadResources(selectedOrg.id);
      await loadTeamspaces(selectedOrg.id);
      toast.success(teamspaceId ? text.movedToTeamspace : text.unassignedResource);
    } catch {
      toast.error(text.moveToTeamspaceFailed);
    }
  }

  async function handleInvite() {
    if (!selectedOrg || !inviteEmail.trim()) return;
    const normalizedEmail = inviteEmail.trim().toLowerCase();
    try {
      await OrganizationService.inviteMember(selectedOrg.id, {
        email: normalizedEmail,
        role: inviteRole,
      });
      setInviteEmail('');
      setShowInvite(false);
      await loadInvitations();
      toast.success(text.invitationSent(normalizedEmail));
    } catch (error) {
      const message = error instanceof ApiError ? error.message : text.inviteMemberFailed;
      toast.error(message);
    }
  }

  async function handleAcceptInvitation(invitationId: string) {
    try {
      await OrganizationService.acceptInvitation(invitationId);
      await Promise.all([loadOrgs(), loadInvitations()]);
      toast.success(text.invitationAccepted);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : text.failedAcceptInvitation;
      toast.error(message);
    }
  }

  async function handleDeclineInvitation(invitationId: string) {
    try {
      await OrganizationService.declineInvitation(invitationId);
      await loadInvitations();
      toast.success(text.invitationDeclined);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : text.failedDeclineInvitation;
      toast.error(message);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!selectedOrg) return;
    try {
      await OrganizationService.removeMember(selectedOrg.id, userId);
      await loadMembers(selectedOrg.id);
      toast.success(text.memberRemoved);
    } catch {
      toast.error(text.removeMemberFailed);
    }
  }

  async function handleUpdateRole(userId: string, role: string) {
    if (!selectedOrg) return;
    try {
      await OrganizationService.updateMemberRole(selectedOrg.id, userId, role);
      await loadMembers(selectedOrg.id);
      toast.success(text.roleUpdated);
    } catch {
      toast.error(text.roleUpdatedFailed);
    }
  }

  async function handleDeleteOrg() {
    if (!selectedOrg) return;
    try {
      const nextOrg = orgs.find((org) => org.id !== selectedOrg.id) || null;
      await OrganizationService.deleteOrganization(selectedOrg.id);
      setOrgs((prev) => prev.filter((org) => org.id !== selectedOrg.id));
      setSelectedOrg(nextOrg);
      if (!nextOrg) {
        setMembers([]);
        setTeamConnections([]);
        setTeamQueries([]);
        setTeamDashboards([]);
        setTeamspaces([]);
        setTeamActivities([]);
        setCommentTarget(null);
      }
      toast.success(text.teamDeleted);
    } catch {
      toast.error(text.teamDeleteFailed);
    }
  }

  function openCommentsFor(resourceType: CollaborationResourceType, resourceId: string, resourceName: string) {
    if (!selectedOrg) return;
    setCommentTarget({ resourceType, resourceId, resourceName });
  }

  const canManage = selectedOrg?.currentUserRole === 'OWNER' || selectedOrg?.currentUserRole === 'ADMIN';

  const TabButton = ({ value, label, icon: Icon, count }: {
    value: TeamTab;
    label: string;
    icon: LucideIcon;
    count?: number;
  }) => (
    <button
      onClick={() => setActiveTab(value)}
      className={cn(
        'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
        activeTab === value
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {count !== undefined && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{count}</span>}
    </button>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-3 border-b px-4 py-3 sm:gap-4 sm:px-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/sql-explorer')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">{text.title}</h1>
      </header>

      <main className="mx-auto max-w-5xl p-4 sm:p-6">
        {loading ? (
          <div className="text-muted-foreground">{text.loading}</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
            <aside className="space-y-3">
              {invitations.length > 0 && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-medium uppercase text-muted-foreground">{text.pendingInvites}</h2>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      {invitations.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {invitations.map((invitation) => (
                      <div key={invitation.id} className="rounded-md border bg-background p-3">
                        <div className="text-sm font-medium">{invitation.organization.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {invitation.email} · {invitation.role}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => handleAcceptInvitation(invitation.id)}>
                            {text.accept}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeclineInvitation(invitation.id)}>
                            {text.decline}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium uppercase text-muted-foreground">{text.yourTeams}</h2>
                <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {orgs.map((org) => (
                <button
                  key={org.id}
                  onClick={() => setSelectedOrg(org)}
                  className={`w-full rounded-lg border px-3 py-3 text-left transition-colors sm:px-4 ${
                    selectedOrg?.id === org.id
                      ? 'border-primary/30 bg-primary/10'
                      : 'bg-card hover:bg-muted/50'
                  }`}
                >
                  <div className="font-medium">{org.name}</div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {text.memberCount(org.memberCount)}
                  </div>
                </button>
              ))}
              {selectedOrg && (
                <div className="rounded-lg border bg-card p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-medium uppercase text-muted-foreground">{text.teamspaces}</h2>
                      <p className="text-[11px] text-muted-foreground">
                        {text.createTeamspaceHint}
                      </p>
                    </div>
                    {canManage && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 text-xs"
                        onClick={() => setShowCreateTeamspace(true)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {teamspaces.length > 0 ? (
                      teamspaces.map((teamspace) => (
                        <TeamspaceCard
                          key={teamspace.id}
                          organizationId={selectedOrg.id}
                          teamspace={teamspace}
                          canManage={canManage}
                          lang={lang}
                          onDelete={handleDeleteTeamspace}
                        />
                      ))
                    ) : (
                      <div className="rounded-md border border-dashed px-3 py-4 text-xs text-muted-foreground">
                        {text.noTeamspacesYet}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {orgs.length === 0 && (
                <div className="px-2 text-sm text-muted-foreground">
                  {text.noTeamsYet}
                </div>
              )}
            </aside>

            <section className="space-y-6 md:col-span-2">
              {selectedOrg ? (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-xl font-semibold">{selectedOrg.name}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {text.role}: <span className="capitalize">{selectedOrg.currentUserRole?.toLowerCase() || text.defaultOwner}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      {canManage && (
                        <Button size="sm" onClick={() => setShowInvite(true)}>
                          <Mail className="mr-1 h-4 w-4" />
                          {text.invite}
                        </Button>
                      )}
                      {selectedOrg.currentUserRole === 'OWNER' && (
                        <Button size="sm" variant="destructive" onClick={handleDeleteOrg}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="-mx-1 overflow-x-auto pb-1 hide-scrollbar">
                    <div className="flex min-w-max items-center gap-1 border-b px-1 pb-1">
                      <TabButton value="members" label={text.members} icon={Users} count={members.length} />
                      <TabButton value="connections" label={text.connections} icon={Database} count={teamConnections.length} />
                      <TabButton value="queries" label={text.queries} icon={FileText} count={teamQueries.length} />
                      <TabButton value="dashboards" label={lang === 'vi' ? 'Dashboard' : 'Dashboards'} icon={LayoutDashboard} count={teamDashboards.length} />
                      <TabButton value="backups" label={text.backups} icon={Download} />
                      <TabButton value="activity" label={text.activity} icon={MessageSquare} count={teamActivities.length} />
                    </div>
                  </div>

                  {activeTab === 'members' && (
                    <TeamMembersPanel
                      members={members}
                      canManage={canManage}
                      isCompactMobileLayout={isCompactMobileLayout}
                      onUpdateRole={handleUpdateRole}
                      onRemoveMember={handleRemoveMember}
                    />
                  )}

                  {activeTab === 'connections' && (
                    <div className="overflow-hidden rounded-lg border">
                      <TeamspaceResourceGroups
                        items={teamConnections}
                        teamspaces={teamspaces}
                        loading={resourcesLoading}
                        emptyMessage={text.noSharedConnectionsYet}
                        lang={lang}
                        renderItem={(connection) => (
                          <div className="flex flex-col gap-3 px-4 py-3 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-center gap-3">
                              <Database className="h-4 w-4 shrink-0 text-blue-500" />
                              <div className="min-w-0">
                                <div className="text-sm font-medium">{connection.name}</div>
                                <div className="break-all text-xs text-muted-foreground">
                                  {connection.type} - {connection.host}
                                  {connection.port ? `:${connection.port}` : ''}
                                  {connection.database ? `/${connection.database}` : ''}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-start gap-2 sm:items-end">
                              {canManage && (
                                <Select
                                  value={connection.teamspaceId ?? TEAMSPACE_UNASSIGNED}
                                  onValueChange={(value) =>
                                    handleAssignResourceTeamspace(
                                      'CONNECTION',
                                      connection.id,
                                      value === TEAMSPACE_UNASSIGNED ? null : value,
                                    )
                                  }
                                >
                                  <SelectTrigger className="h-8 w-full text-xs sm:w-40">
                                    <SelectValue placeholder={text.teamspace} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={TEAMSPACE_UNASSIGNED} className="text-xs">
                                      {text.unassigned}
                                    </SelectItem>
                                    {renderTeamspaceOptions(teamspaces)}
                                  </SelectContent>
                                </Select>
                              )}
                              <ResourceActions
                                permissionLabel={getPermissionLabel(selectedOrg?.currentUserRole, connection.permissions, lang)}
                                canComment={canCommentResource(selectedOrg?.currentUserRole, connection.permissions)}
                                onCommentClick={() => openCommentsFor('CONNECTION', connection.id, connection.name)}
                                lang={lang}
                              />
                              <div className="flex flex-wrap items-center gap-2">
                                {connection.lastHealthStatus === 'healthy' && (
                                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600">{text.allGood}</span>
                                )}
                                {connection.lastHealthStatus === 'error' && (
                                  <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] text-red-600">{text.errorState}</span>
                                )}
                                {connection.readOnly && (
                                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600">{text.readOnly}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      />
                    </div>
                  )}

                  {activeTab === 'queries' && (
                    <div className="overflow-hidden rounded-lg border">
                      <TeamspaceResourceGroups
                        items={teamQueries}
                        teamspaces={teamspaces}
                        loading={resourcesLoading}
                        emptyMessage={text.noSharedQueriesYet}
                        lang={lang}
                        renderItem={(query) => (
                          <div className="flex flex-col gap-3 px-4 py-3 hover:bg-muted/30 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex min-w-0 items-start gap-3">
                              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium">{query.name}</div>
                                <div
                                  className={cn(
                                    'font-mono text-xs text-muted-foreground',
                                    isSmallMobile ? 'break-words whitespace-pre-wrap' : 'max-w-md truncate'
                                  )}
                                >
                                  {query.sql}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-start gap-2 sm:items-end">
                              {canManage && (
                                <Select
                                  value={query.teamspaceId ?? TEAMSPACE_UNASSIGNED}
                                  onValueChange={(value) =>
                                    handleAssignResourceTeamspace(
                                      'QUERY',
                                      query.id,
                                      value === TEAMSPACE_UNASSIGNED ? null : value,
                                    )
                                  }
                                >
                                  <SelectTrigger className="h-8 w-full text-xs sm:w-40">
                                    <SelectValue placeholder={text.teamspace} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={TEAMSPACE_UNASSIGNED} className="text-xs">
                                      {text.unassigned}
                                    </SelectItem>
                                    {renderTeamspaceOptions(teamspaces)}
                                  </SelectContent>
                                </Select>
                              )}
                              <ResourceActions
                                permissionLabel={getPermissionLabel(selectedOrg?.currentUserRole, query.permissions, lang)}
                                canComment={canCommentResource(selectedOrg?.currentUserRole, query.permissions)}
                                onCommentClick={() => openCommentsFor('QUERY', query.id, query.name)}
                                lang={lang}
                              />
                            </div>
                          </div>
                        )}
                      />
                    </div>
                  )}

                  {activeTab === 'dashboards' && (
                    <div className="overflow-hidden rounded-lg border">
                      <TeamspaceResourceGroups
                        items={teamDashboards}
                        teamspaces={teamspaces}
                        loading={resourcesLoading}
                        emptyMessage={text.noSharedDashboardsYet}
                        lang={lang}
                        renderItem={(dashboard) => (
                          <div className="flex flex-col gap-3 px-4 py-3 hover:bg-muted/30 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex min-w-0 items-start gap-3">
                              <LayoutDashboard className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium">{dashboard.name}</div>
                                {dashboard.description && (
                                  <div className="break-words text-xs text-muted-foreground">{dashboard.description}</div>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-start gap-2 sm:items-end">
                              {canManage && (
                                <Select
                                  value={dashboard.teamspaceId ?? TEAMSPACE_UNASSIGNED}
                                  onValueChange={(value) =>
                                    handleAssignResourceTeamspace(
                                      'DASHBOARD',
                                      dashboard.id,
                                      value === TEAMSPACE_UNASSIGNED ? null : value,
                                    )
                                  }
                                >
                                  <SelectTrigger className="h-8 w-full text-xs sm:w-40">
                                    <SelectValue placeholder={text.teamspace} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={TEAMSPACE_UNASSIGNED} className="text-xs">
                                      {text.unassigned}
                                    </SelectItem>
                                    {renderTeamspaceOptions(teamspaces)}
                                  </SelectContent>
                                </Select>
                              )}
                              <ResourceActions
                                permissionLabel={getPermissionLabel(selectedOrg?.currentUserRole, dashboard.permissions, lang)}
                                canComment={canCommentResource(selectedOrg?.currentUserRole, dashboard.permissions)}
                                onCommentClick={() => openCommentsFor('DASHBOARD', dashboard.id, dashboard.name)}
                                lang={lang}
                              />
                            </div>
                          </div>
                        )}
                      />
                    </div>
                  )}

                  {activeTab === 'backups' && (
                    <div className="overflow-hidden rounded-lg border">
                      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_1.2fr]">
                        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                          <div className="flex items-center gap-2">
                            <Download className="h-4 w-4 text-muted-foreground" />
                            <div className="font-medium">{text.exportBackup}</div>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {text.exportBackupDescription}
                          </p>
                          <ul className="space-y-1 text-xs text-muted-foreground">
                            <li>{text.restoreWarning}</li>
                            <li>{text.backupRestoreDetails}</li>
                            <li>{text.backupReviewWarning}</li>
                          </ul>
                          <Button type="button" onClick={handleExportBackup} disabled={backupLoading}>
                            {backupLoading ? text.exporting : text.exportBackupButton}
                          </Button>
                        </div>

                        <div className="space-y-3 rounded-lg border bg-background p-4">
                          <div className="flex items-center gap-2">
                            <Upload className="h-4 w-4 text-muted-foreground" />
                            <div className="font-medium">{text.restoreBackup}</div>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {text.restoreBackupDescription}
                          </p>
                          <Textarea
                            value={backupJson}
                            onChange={(event) => setBackupJson(event.target.value)}
                            placeholder={lang === 'vi' ? 'Dan backup JSON vao day...' : 'Paste backup JSON here...'}
                            className="min-h-56 font-mono text-xs"
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" variant="outline" onClick={() => setBackupJson('')} disabled={!backupJson}>
                              {text.clear}
                            </Button>
                            <Button type="button" onClick={handleRestoreBackup} disabled={!backupJson.trim() || backupRestoring}>
                              {backupRestoring ? text.restoring : text.restoreBackupButton}
                            </Button>
                          </div>
                          {backupSummary && (
                            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                              <div className="font-medium text-foreground">{text.restoreComplete}</div>
                              <div className="mt-1">
                                {text.teamspaces}: {backupSummary.created.teamspaces}, {text.queries}: {backupSummary.created.savedQueries}, {lang === 'vi' ? 'Dashboard' : 'Dashboards'}: {backupSummary.created.dashboards}, ERD: {backupSummary.created.erdWorkspaces}
                              </div>
                              {backupSummary.warnings.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {backupSummary.warnings.map((warning) => (
                                    <div key={warning}>• {warning}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'activity' && (
                    <div className="overflow-hidden rounded-lg border">
                      {activityLoading ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">{text.loadingActivity}</div>
                      ) : (
                        <TeamActivityTab activities={teamActivities} lang={lang} />
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-muted-foreground">
                  {text.noTeamsSelected}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <CreateTeamDialog open={showCreate} onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      <CreateTeamspaceDialog
        open={showCreateTeamspace}
        onClose={() => setShowCreateTeamspace(false)}
        onCreate={handleCreateTeamspace}
      />
      {selectedOrg && commentTarget && (
        <TeamCommentsDrawer
          open={Boolean(commentTarget)}
          onOpenChange={(open) => {
            if (!open) {
              setCommentTarget(null);
            }
          }}
          organizationId={selectedOrg.id}
          resourceType={commentTarget.resourceType}
          resourceId={commentTarget.resourceId}
          resourceName={commentTarget.resourceName}
        />
      )}

      <InviteMemberDialog
        open={showInvite}
        email={inviteEmail}
        role={inviteRole}
        onOpenChange={setShowInvite}
        onEmailChange={setInviteEmail}
        onRoleChange={setInviteRole}
        onInvite={handleInvite}
      />
    </div>
  );
}
