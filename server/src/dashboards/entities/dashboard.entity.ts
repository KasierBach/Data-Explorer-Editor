export interface DashboardWidgetEntity {
  id: string;
  title: string;
  chartType: string;
  queryText?: string | null;
  connectionId?: string | null;
  database?: string | null;
  columns: string[];
  xAxis?: string | null;
  yAxis: string[];
  orderIndex: number;
  config?: Record<string, any> | null;
  dataSnapshot: Record<string, any>[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardEntity {
  id: string;
  name: string;
  description?: string | null;
  visibility: string;
  connectionId?: string | null;
  database?: string | null;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  };
  isOwner: boolean;
  widgets: DashboardWidgetEntity[];
}
