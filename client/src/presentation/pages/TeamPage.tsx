import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/presentation/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/presentation/components/ui/select';
import {
  OrganizationService,
  type OrganizationEntity,
  type OrganizationMemberEntity,
} from '@/core/services/OrganizationService';
import { useResponsiveLayoutMode } from '@/presentation/hooks/useResponsiveLayoutMode';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Database, FileText, LayoutDashboard, Mail,
  Plus, Shield, Trash2, User, Users,
} from 'lucide-react';
import { toast } from 'sonner';

type TeamTab = 'members' | 'connections' | 'queries' | 'dashboards';

export function TeamPage() {
  const navigate = useNavigate();
  const { isCompactMobileLayout, isSmallMobile } = useResponsiveLayoutMode();
  const [orgs, setOrgs] = useState<OrganizationEntity[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationEntity | null>(null);
  const [members, setMembers] = useState<OrganizationMemberEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [activeTab, setActiveTab] = useState<TeamTab>('members');
  const [teamConnections, setTeamConnections] = useState<any[]>([]);
  const [teamQueries, setTeamQueries] = useState<any[]>([]);
  const [teamDashboards, setTeamDashboards] = useState<any[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);

  useEffect(() => {
    loadOrgs();
  }, []);

  useEffect(() => {
    if (selectedOrg) {
      loadMembers(selectedOrg.id);
      loadResources(selectedOrg.id);
    }
  }, [selectedOrg]);

  async function loadOrgs() {
    try {
      const data = await OrganizationService.getMyOrganizations();
      setOrgs(data);
      if (data.length > 0 && !selectedOrg) {
        setSelectedOrg(data[0]);
      }
    } catch {
      toast.error('Failed to load teams');
    } finally {
      setLoading(false);
    }
  }

  async function loadMembers(orgId: string) {
    try {
      const data = await OrganizationService.getMembers(orgId);
      setMembers(data);
    } catch {
      toast.error('Failed to load members');
    }
  }

  async function loadResources(orgId: string) {
    setResourcesLoading(true);
    try {
      const [connections, queries, dashboards] = await Promise.all([
        OrganizationService.getTeamConnections(orgId).catch(() => []),
        OrganizationService.getTeamQueries(orgId).catch(() => []),
        OrganizationService.getTeamDashboards(orgId).catch(() => []),
      ]);
      setTeamConnections(connections);
      setTeamQueries(queries);
      setTeamDashboards(dashboards);
    } finally {
      setResourcesLoading(false);
    }
  }

  async function handleCreate(name: string) {
    try {
      const org = await OrganizationService.createOrganization({ name });
      setOrgs((prev) => [...prev, org]);
      setSelectedOrg(org);
      setShowCreate(false);
      toast.success('Team created');
    } catch {
      toast.error('Failed to create team');
    }
  }

  async function handleInvite() {
    if (!selectedOrg || !inviteEmail) return;
    try {
      await OrganizationService.inviteMember(selectedOrg.id, {
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteEmail('');
      setShowInvite(false);
      await loadMembers(selectedOrg.id);
      toast.success('Invitation sent');
    } catch {
      toast.error('Failed to invite member');
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!selectedOrg) return;
    try {
      await OrganizationService.removeMember(selectedOrg.id, userId);
      await loadMembers(selectedOrg.id);
      toast.success('Member removed');
    } catch {
      toast.error('Failed to remove member');
    }
  }

  async function handleUpdateRole(userId: string, role: string) {
    if (!selectedOrg) return;
    try {
      await OrganizationService.updateMemberRole(selectedOrg.id, userId, role);
      await loadMembers(selectedOrg.id);
      toast.success('Role updated');
    } catch {
      toast.error('Failed to update role');
    }
  }

  async function handleDeleteOrg() {
    if (!selectedOrg) return;
    try {
      await OrganizationService.deleteOrganization(selectedOrg.id);
      setOrgs((prev) => prev.filter((org) => org.id !== selectedOrg.id));
      setSelectedOrg(orgs.find((org) => org.id !== selectedOrg.id) || null);
      toast.success('Team deleted');
    } catch {
      toast.error('Failed to delete team');
    }
  }

  const canManage = selectedOrg?.currentUserRole === 'OWNER' || selectedOrg?.currentUserRole === 'ADMIN';

  const TabButton = ({ value, label, icon: Icon, count }: {
    value: TeamTab;
    label: string;
    icon: any;
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
        <h1 className="text-lg font-semibold">Teams</h1>
      </header>

      <main className="mx-auto max-w-5xl p-4 sm:p-6">
        {loading ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
            <aside className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium uppercase text-muted-foreground">Your Teams</h2>
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
                    {org.memberCount} members
                  </div>
                </button>
              ))}
              {orgs.length === 0 && (
                <div className="px-2 text-sm text-muted-foreground">
                  No teams yet. Create one to get started.
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
                        Role: <span className="capitalize">{selectedOrg.currentUserRole?.toLowerCase() || 'owner'}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      {canManage && (
                        <Button size="sm" onClick={() => setShowInvite(true)}>
                          <Mail className="mr-1 h-4 w-4" />
                          Invite
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
                      <TabButton value="members" label="Members" icon={Users} count={members.length} />
                      <TabButton value="connections" label="Connections" icon={Database} count={teamConnections.length} />
                      <TabButton value="queries" label="Queries" icon={FileText} count={teamQueries.length} />
                      <TabButton value="dashboards" label="Dashboards" icon={LayoutDashboard} count={teamDashboards.length} />
                    </div>
                  </div>

                  {activeTab === 'members' && (
                    <div className="overflow-hidden rounded-lg border">
                      {isCompactMobileLayout ? (
                        <div className="divide-y">
                          {members.map((member) => (
                            <div key={member.id} className="space-y-3 px-4 py-4">
                              <div className="flex items-start gap-3">
                                <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                <div className="min-w-0 flex-1">
                                  <div className="break-words font-medium">
                                    {member.user.firstName || member.user.lastName
                                      ? `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim()
                                      : member.user.email}
                                  </div>
                                  <div className="break-all text-xs text-muted-foreground">{member.user.email}</div>
                                </div>
                              </div>
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Role</div>
                                  {canManage && member.role !== 'OWNER' ? (
                                    <Select
                                      value={member.role}
                                      onValueChange={(value) => handleUpdateRole(member.userId, value)}
                                    >
                                      <SelectTrigger className="mt-1 h-8 w-full text-xs sm:w-28">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="ADMIN">Admin</SelectItem>
                                        <SelectItem value="MEMBER">Member</SelectItem>
                                        <SelectItem value="VIEWER">Viewer</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
                                      {member.role === 'OWNER' && <Shield className="h-3 w-3" />}
                                      {member.role}
                                    </span>
                                  )}
                                </div>
                                {canManage && member.role !== 'OWNER' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 justify-start px-0 text-destructive sm:h-7 sm:w-7 sm:justify-center"
                                    onClick={() => handleRemoveMember(member.userId)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span className="ml-2 sm:hidden">Remove member</span>
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-4 py-2 text-left font-medium">Member</th>
                              <th className="px-4 py-2 text-left font-medium">Role</th>
                              <th className="px-4 py-2 text-right font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {members.map((member) => (
                              <tr key={member.id} className="border-t">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    <div className="min-w-0">
                                      <div className="font-medium">
                                        {member.user.firstName || member.user.lastName
                                          ? `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim()
                                          : member.user.email}
                                      </div>
                                      <div className="text-xs text-muted-foreground">{member.user.email}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  {canManage && member.role !== 'OWNER' ? (
                                    <Select
                                      value={member.role}
                                      onValueChange={(value) => handleUpdateRole(member.userId, value)}
                                    >
                                      <SelectTrigger className="h-8 w-28 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="ADMIN">Admin</SelectItem>
                                        <SelectItem value="MEMBER">Member</SelectItem>
                                        <SelectItem value="VIEWER">Viewer</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
                                      {member.role === 'OWNER' && <Shield className="h-3 w-3" />}
                                      {member.role}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {canManage && member.role !== 'OWNER' && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-destructive"
                                      onClick={() => handleRemoveMember(member.userId)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      {members.length === 0 && (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                          No members yet.
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'connections' && (
                    <div className="overflow-hidden rounded-lg border">
                      {resourcesLoading ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading...</div>
                      ) : teamConnections.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                          No shared connections yet. Create one from the SQL Explorer and select this team.
                        </div>
                      ) : (
                        <div className="divide-y">
                          {teamConnections.map((connection) => (
                            <div
                              key={connection.id}
                              className="flex flex-col gap-3 px-4 py-3 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                            >
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
                              <div className="flex flex-wrap items-center gap-2">
                                {connection.lastHealthStatus === 'healthy' && (
                                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600">Healthy</span>
                                )}
                                {connection.lastHealthStatus === 'error' && (
                                  <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] text-red-600">Error</span>
                                )}
                                {connection.readOnly && (
                                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600">Read-only</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'queries' && (
                    <div className="overflow-hidden rounded-lg border">
                      {resourcesLoading ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading...</div>
                      ) : teamQueries.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                          No shared queries yet.
                        </div>
                      ) : (
                        <div className="divide-y">
                          {teamQueries.map((query) => (
                            <div key={query.id} className="px-4 py-3 hover:bg-muted/30">
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
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'dashboards' && (
                    <div className="overflow-hidden rounded-lg border">
                      {resourcesLoading ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading...</div>
                      ) : teamDashboards.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                          No shared dashboards yet.
                        </div>
                      ) : (
                        <div className="divide-y">
                          {teamDashboards.map((dashboard) => (
                            <div key={dashboard.id} className="px-4 py-3 hover:bg-muted/30">
                              <div className="flex min-w-0 items-start gap-3">
                                <LayoutDashboard className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium">{dashboard.name}</div>
                                  {dashboard.description && (
                                    <div className="break-words text-xs text-muted-foreground">{dashboard.description}</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Select a team from the sidebar to view details.
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <CreateTeamDialog open={showCreate} onClose={() => setShowCreate(false)} onCreate={handleCreate} />

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Role</label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MEMBER">Member</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button onClick={handleInvite}>Send Invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateTeamDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim());
    setName('');
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Team</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium">Team Name</label>
            <Input
              placeholder="Engineering Team"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
