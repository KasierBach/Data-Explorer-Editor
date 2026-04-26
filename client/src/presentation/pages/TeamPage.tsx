import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/presentation/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/presentation/components/ui/select';
import {
  OrganizationService,
  type OrganizationEntity,
  type OrganizationMemberEntity,
} from '@/core/services/OrganizationService';
import {
  ArrowLeft, Plus, Users, Shield, User, Trash2, Mail,
  Database, FileText, LayoutDashboard,
} from 'lucide-react';
import { toast } from 'sonner';

export function TeamPage() {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<OrganizationEntity[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationEntity | null>(null);
  const [members, setMembers] = useState<OrganizationMemberEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');

  // Shared resources
  const [activeTab, setActiveTab] = useState<'members' | 'connections' | 'queries' | 'dashboards'>('members');
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
      const [conns, queries, dashboards] = await Promise.all([
        OrganizationService.getTeamConnections(orgId).catch(() => []),
        OrganizationService.getTeamQueries(orgId).catch(() => []),
        OrganizationService.getTeamDashboards(orgId).catch(() => []),
      ]);
      setTeamConnections(conns);
      setTeamQueries(queries);
      setTeamDashboards(dashboards);
    } catch {
      // silent
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
      setOrgs((prev) => prev.filter((o) => o.id !== selectedOrg.id));
      setSelectedOrg(orgs.find((o) => o.id !== selectedOrg.id) || null);
      toast.success('Team deleted');
    } catch {
      toast.error('Failed to delete team');
    }
  }

  const canManage = selectedOrg?.currentUserRole === 'OWNER' || selectedOrg?.currentUserRole === 'ADMIN';

  const TabButton = ({ value, label, icon: Icon, count }: { value: typeof activeTab; label: string; icon: any; count?: number }) => (
    <button
      onClick={() => setActiveTab(value)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
        activeTab === value
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
      {count !== undefined && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{count}</span>}
    </button>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-6 py-3 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/sql-explorer')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold">Teams</h1>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {loading ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <aside className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted-foreground uppercase">Your Teams</h2>
                <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {orgs.map((org) => (
                <button
                  key={org.id}
                  onClick={() => setSelectedOrg(org)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    selectedOrg?.id === org.id
                      ? 'bg-primary/10 border-primary/30'
                      : 'bg-card hover:bg-muted/50'
                  }`}
                >
                  <div className="font-medium">{org.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Users className="w-3 h-3" />
                    {org.memberCount} members
                  </div>
                </button>
              ))}
              {orgs.length === 0 && (
                <div className="text-sm text-muted-foreground px-2">
                  No teams yet. Create one to get started.
                </div>
              )}
            </aside>

            <section className="md:col-span-2 space-y-6">
              {selectedOrg ? (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">{selectedOrg.name}</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Role: <span className="capitalize">{selectedOrg.currentUserRole?.toLowerCase() || 'Owner'}</span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {canManage && (
                        <Button size="sm" onClick={() => setShowInvite(true)}>
                          <Mail className="w-4 h-4 mr-1" />
                          Invite
                        </Button>
                      )}
                      {selectedOrg.currentUserRole === 'OWNER' && (
                        <Button size="sm" variant="destructive" onClick={handleDeleteOrg}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex items-center gap-1 border-b pb-1">
                    <TabButton value="members" label="Members" icon={Users} count={members.length} />
                    <TabButton value="connections" label="Connections" icon={Database} count={teamConnections.length} />
                    <TabButton value="queries" label="Queries" icon={FileText} count={teamQueries.length} />
                    <TabButton value="dashboards" label="Dashboards" icon={LayoutDashboard} count={teamDashboards.length} />
                  </div>

                  {/* Members Tab */}
                  {activeTab === 'members' && (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left px-4 py-2 font-medium">Member</th>
                            <th className="text-left px-4 py-2 font-medium">Role</th>
                            <th className="text-right px-4 py-2 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {members.map((m) => (
                            <tr key={m.id} className="border-t">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-muted-foreground" />
                                  <div>
                                    <div className="font-medium">
                                      {m.user.firstName || m.user.lastName
                                        ? `${m.user.firstName || ''} ${m.user.lastName || ''}`
                                        : m.user.email}
                                    </div>
                                    <div className="text-xs text-muted-foreground">{m.user.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {canManage && m.role !== 'OWNER' ? (
                                  <Select
                                    value={m.role}
                                    onValueChange={(v) => handleUpdateRole(m.userId, v)}
                                  >
                                    <SelectTrigger className="w-28 h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="ADMIN">Admin</SelectItem>
                                      <SelectItem value="MEMBER">Member</SelectItem>
                                      <SelectItem value="VIEWER">Viewer</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-muted">
                                    {m.role === 'OWNER' && <Shield className="w-3 h-3" />}
                                    {m.role}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {canManage && m.role !== 'OWNER' && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-destructive"
                                    onClick={() => handleRemoveMember(m.userId)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {members.length === 0 && (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                          No members yet.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Connections Tab */}
                  {activeTab === 'connections' && (
                    <div className="border rounded-lg overflow-hidden">
                      {resourcesLoading ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading...</div>
                      ) : teamConnections.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                          No shared connections yet. Create one from the SQL Explorer and select this team.
                        </div>
                      ) : (
                        <div className="divide-y">
                          {teamConnections.map((c) => (
                            <div key={c.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30">
                              <div className="flex items-center gap-3">
                                <Database className="w-4 h-4 text-blue-500" />
                                <div>
                                  <div className="text-sm font-medium">{c.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {c.type} • {c.host}{c.port ? `:${c.port}` : ''}{c.database ? `/${c.database}` : ''}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {c.lastHealthStatus === 'healthy' && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">Healthy</span>
                                )}
                                {c.lastHealthStatus === 'error' && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-600">Error</span>
                                )}
                                {c.readOnly && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">Read-only</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Queries Tab */}
                  {activeTab === 'queries' && (
                    <div className="border rounded-lg overflow-hidden">
                      {resourcesLoading ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading...</div>
                      ) : teamQueries.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                          No shared queries yet.
                        </div>
                      ) : (
                        <div className="divide-y">
                          {teamQueries.map((q) => (
                            <div key={q.id} className="px-4 py-3 hover:bg-muted/30">
                              <div className="flex items-center gap-3">
                                <FileText className="w-4 h-4 text-violet-500" />
                                <div>
                                  <div className="text-sm font-medium">{q.name}</div>
                                  <div className="text-xs text-muted-foreground font-mono truncate max-w-md">{q.sql}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dashboards Tab */}
                  {activeTab === 'dashboards' && (
                    <div className="border rounded-lg overflow-hidden">
                      {resourcesLoading ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading...</div>
                      ) : teamDashboards.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                          No shared dashboards yet.
                        </div>
                      ) : (
                        <div className="divide-y">
                          {teamDashboards.map((d) => (
                            <div key={d.id} className="px-4 py-3 hover:bg-muted/30">
                              <div className="flex items-center gap-3">
                                <LayoutDashboard className="w-4 h-4 text-orange-500" />
                                <div>
                                  <div className="text-sm font-medium">{d.name}</div>
                                  {d.description && <div className="text-xs text-muted-foreground">{d.description}</div>}
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
                <div className="text-muted-foreground text-sm">
                  Select a team from the sidebar to view details.
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <CreateTeamDialog open={showCreate} onClose={() => setShowCreate(false)} onCreate={handleCreate} />

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
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
          <DialogFooter>
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
      <DialogContent>
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
