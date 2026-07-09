import type { DatabaseRelationship } from '@/core/domain/database-adapter.interface';
import type { Connection } from '@/core/services/store/slices/connectionSlice';
import { parseNodeId } from '@/core/utils/id-parser';

export type ReviewContextText = {
    contextTitle: string;
    contextLoading: string;
    contextConnection: string;
    contextDatabase: string;
    contextRows: (count: number) => string;
    contextColumns: (count: number) => string;
    contextIndexes: (count: number) => string;
    contextDependencies: (count: number) => string;
    contextReadOnly: string;
    contextSchemaChangesDisabled: string;
    contextQueryExecutionDisabled: string;
};

export type WarningObjectContext = {
    rowCount?: number;
    columnCount?: number;
    indexCount?: number;
    dependencyCount?: number;
};

export function isMetadataBackedObjectType(objectType?: string | null) {
    return objectType === 'TABLE' || objectType === 'VIEW';
}

export function countObjectDependencies(
    relationships: DatabaseRelationship[],
    affectedObject?: string | null,
) {
    if (!affectedObject) return 0;

    const parsed = parseNodeId(affectedObject);
    const targetName = (parsed.table || affectedObject).toLowerCase();
    const keys = new Set(
        relationships
            .filter((relationship) => (
                relationship.source_table.toLowerCase() === targetName
                || relationship.target_table.toLowerCase() === targetName
            ))
            .map((relationship) => (
                relationship.constraint_name
                || `${relationship.source_table}.${relationship.source_column}->${relationship.target_table}.${relationship.target_column}`
            )),
    );

    return keys.size;
}

export function buildReviewContextLines({
    connection,
    context,
    database,
    text,
}: {
    connection?: Connection | null;
    context?: WarningObjectContext | null;
    database?: string | null;
    text: ReviewContextText;
}) {
    const lines: string[] = [];

    if (connection) {
        lines.push(`${text.contextConnection}: ${connection.name} (${connection.type})`);
    }

    if (database) {
        lines.push(`${text.contextDatabase}: ${database}`);
    }

    if (context?.rowCount !== undefined) {
        lines.push(text.contextRows(context.rowCount));
    }

    if (context?.columnCount !== undefined) {
        lines.push(text.contextColumns(context.columnCount));
    }

    if (context?.indexCount !== undefined) {
        lines.push(text.contextIndexes(context.indexCount));
    }

    if (context?.dependencyCount !== undefined) {
        lines.push(text.contextDependencies(context.dependencyCount));
    }

    if (connection?.readOnly) {
        lines.push(text.contextReadOnly);
    }

    if (connection?.allowSchemaChanges === false) {
        lines.push(text.contextSchemaChangesDisabled);
    }

    if (connection?.allowQueryExecution === false) {
        lines.push(text.contextQueryExecutionDisabled);
    }

    return lines;
}