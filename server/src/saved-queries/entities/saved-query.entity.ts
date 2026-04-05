export class SavedQueryEntity {
  id: string;
  name: string;
  sql: string;
  database?: string | null;
  connectionId?: string | null;
  visibility: 'private' | 'team' | 'workspace';
  folderId?: string | null;
  tags: string[];
  description?: string | null;
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
