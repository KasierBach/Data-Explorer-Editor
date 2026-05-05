export interface ErdWorkspaceEntity {
  id: string;
  name: string;
  notes?: string | null;
  organizationId?: string | null;
  connectionId?: string | null;
  database?: string | null;
  layout: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  };
  isOwner: boolean;
}
