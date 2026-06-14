export interface SearchIndexItem {
  id: string;
  name: string;
  type: string;
  connectionId: string;
  connectionName: string;
  database?: string;
  schema?: string;
}

export interface StoredSearchIndexItem extends SearchIndexItem {
  searchText: string;
}
