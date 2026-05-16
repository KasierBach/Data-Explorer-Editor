import { Injectable } from '@nestjs/common';
import {
  FullTableMetadata,
  ColumnInfo,
  IndexInfo,
} from '../database-strategies';
import { StartMigrationDto } from './dto/start-migration.dto';
import {
  type MigrationConnection,
  type ResolvedMigrationContext,
  type MigrationColumnDiff,
  type MigrationIndexDiff,
  type MigrationReviewSummary,
} from './migration.types';

@Injectable()
export class MigrationComparisonService {
  isMongoLike(type: string): boolean {
    return type === 'mongodb' || type === 'mongodb+srv';
  }

  normalizeSchemaName(type: string, schema?: string): string {
    if (this.isMongoLike(type)) return '';
    return schema?.trim() || (type === 'postgres' ? 'public' : '');
  }

  normalizeTableName(table: string): string {
    return table.trim();
  }

  sameMigrationEndpoint(dto: StartMigrationDto): boolean {
    return (
      dto.sourceConnectionId === dto.targetConnectionId &&
      (dto.sourceSchema || '') === (dto.targetSchema || '') &&
      dto.sourceTable === dto.targetTable
    );
  }

  collectTargetCompatibilityIssues(
    sourceConn: MigrationConnection,
    targetConn: MigrationConnection,
    sourceMetadata: FullTableMetadata,
    targetMetadata: FullTableMetadata,
  ): string[] {
    const issues: string[] = [];

    if (this.isMongoLike(targetConn.type)) {
      return issues;
    }

    const sourceColumns = new Set(
      (sourceMetadata?.columns || []).map((column) => column.name),
    );
    const targetColumns = Array.isArray(targetMetadata?.columns)
      ? targetMetadata.columns
      : [];

    if (targetColumns.length === 0) {
      issues.push('Target table not found or has no accessible columns.');
      return issues;
    }

    const missingColumns = targetColumns
      .filter((column) => !sourceColumns.has(column.name))
      .filter(
        (column) =>
          !column.isNullable &&
          column.defaultValue == null &&
          !column.isPrimaryKey,
      )
      .map((column) => column.name);

    if (missingColumns.length > 0) {
      issues.push(
        `Target table is missing required values for columns: ${missingColumns.slice(0, 5).join(', ')}`,
      );
    }

    const unsupportedSourceColumns = (sourceMetadata?.columns || [])
      .map((column) => column.name)
      .filter(
        (columnName) =>
          !targetColumns.some(
            (targetColumn) => targetColumn.name === columnName,
          ),
      );

    if (unsupportedSourceColumns.length > 0) {
      issues.push(
        `Target table is missing source columns: ${unsupportedSourceColumns.slice(0, 5).join(', ')}`,
      );
    }

    if (
      this.isMongoLike(sourceConn.type) &&
      unsupportedSourceColumns.some(
        (name) => name.includes('.') || name.includes('[]'),
      )
    ) {
      issues.push(
        'MongoDB nested document fields are not compatible with the selected SQL target table.',
      );
    }

    return issues;
  }

  validateTargetCompatibility(
    sourceConn: MigrationConnection,
    targetConn: MigrationConnection,
    sourceMetadata: FullTableMetadata,
    targetMetadata: FullTableMetadata,
  ): void {
    const issues = this.collectTargetCompatibilityIssues(
      sourceConn,
      targetConn,
      sourceMetadata,
      targetMetadata,
    );
    if (issues.length > 0) {
      throw new Error(issues[0]);
    }
  }

  compareColumns(
    sourceColumns: ColumnInfo[],
    targetColumns: ColumnInfo[],
  ): MigrationColumnDiff[] {
    const sourceMap = new Map(
      sourceColumns.map((column) => [column.name, column]),
    );
    const targetMap = new Map(
      targetColumns.map((column) => [column.name, column]),
    );
    const names = Array.from(
      new Set([...sourceMap.keys(), ...targetMap.keys()]),
    ).sort((a, b) => a.localeCompare(b));

    return names.map((name) => {
      const source = sourceMap.get(name) ?? null;
      const target = targetMap.get(name) ?? null;
      const changes: string[] = [];

      if (!source) {
        changes.push('added in target');
      } else if (!target) {
        changes.push('removed from target');
      } else {
        if (source.type !== target.type)
          changes.push(`type ${source.type} -> ${target.type}`);
        if (source.isNullable !== target.isNullable)
          changes.push(
            `nullable ${source.isNullable ? 'yes' : 'no'} -> ${target.isNullable ? 'yes' : 'no'}`,
          );
        if (
          JSON.stringify(source.defaultValue ?? null) !==
          JSON.stringify(target.defaultValue ?? null)
        )
          changes.push('default value changed');
        if (source.isPrimaryKey !== target.isPrimaryKey)
          changes.push(
            `primary key ${source.isPrimaryKey ? 'yes' : 'no'} -> ${target.isPrimaryKey ? 'yes' : 'no'}`,
          );
        if (
          (source.pkConstraintName ?? null) !==
          (target.pkConstraintName ?? null)
        )
          changes.push('primary key constraint changed');
        if ((source.comment ?? null) !== (target.comment ?? null))
          changes.push('comment changed');
      }

      return {
        name,
        status: !source
          ? 'added'
          : !target
            ? 'removed'
            : changes.length > 0
              ? 'changed'
              : 'unchanged',
        changes,
        source,
        target,
      };
    });
  }

  compareIndices(
    sourceIndices: IndexInfo[],
    targetIndices: IndexInfo[],
  ): MigrationIndexDiff[] {
    const sourceMap = new Map(
      sourceIndices.map((index) => [index.name, index]),
    );
    const targetMap = new Map(
      targetIndices.map((index) => [index.name, index]),
    );
    const names = Array.from(
      new Set([...sourceMap.keys(), ...targetMap.keys()]),
    ).sort((a, b) => a.localeCompare(b));

    return names.map((name) => {
      const source = sourceMap.get(name) ?? null;
      const target = targetMap.get(name) ?? null;
      const changes: string[] = [];

      if (!source) {
        changes.push('index added in target');
      } else if (!target) {
        changes.push('index removed from target');
      } else {
        if (source.isUnique !== target.isUnique)
          changes.push(
            `unique ${source.isUnique ? 'yes' : 'no'} -> ${target.isUnique ? 'yes' : 'no'}`,
          );
        if (source.isPrimary !== target.isPrimary)
          changes.push(
            `primary ${source.isPrimary ? 'yes' : 'no'} -> ${target.isPrimary ? 'yes' : 'no'}`,
          );
        if (JSON.stringify(source.columns) !== JSON.stringify(target.columns))
          changes.push('indexed columns changed');
      }

      return {
        name,
        status: !source
          ? 'added'
          : !target
            ? 'removed'
            : changes.length > 0
              ? 'changed'
              : 'unchanged',
        changes,
        source,
        target,
      };
    });
  }

  buildMigrationReviewSummary(
    context: ResolvedMigrationContext,
    dto: StartMigrationDto,
  ): MigrationReviewSummary {
    const columnDiffs = this.compareColumns(
      context.sourceMetadata.columns || [],
      context.targetMetadata.columns || [],
    );
    const indexDiffs = this.compareIndices(
      context.sourceMetadata.indices || [],
      context.targetMetadata.indices || [],
    );
    const blockers = this.collectTargetCompatibilityIssues(
      context.sourceConn,
      context.targetConn,
      context.sourceMetadata,
      context.targetMetadata,
    );
    const warnings: string[] = [];

    const changedColumns = columnDiffs.filter(
      (diff) => diff.status === 'changed',
    ).length;
    const removedColumns = columnDiffs.filter(
      (diff) => diff.status === 'removed',
    ).length;
    const addedColumns = columnDiffs.filter(
      (diff) => diff.status === 'added',
    ).length;
    const changedIndices = indexDiffs.filter(
      (diff) => diff.status === 'changed',
    ).length;
    const removedIndices = indexDiffs.filter(
      (diff) => diff.status === 'removed',
    ).length;
    const addedIndices = indexDiffs.filter(
      (diff) => diff.status === 'added',
    ).length;

    if ((context.sourceMetadata.rowCount ?? 0) > 100_000) {
      warnings.push(
        'Large source table detected. Expect the transfer to take noticeable time.',
      );
    }

    if (changedColumns > 0 || changedIndices > 0) {
      warnings.push(
        'Structure differs between source and target. Review the diff carefully before running.',
      );
    }

    if (!context.targetMetadata.columns?.length) {
      warnings.push(
        'Target metadata could not be inspected fully. Double-check the target schema before running.',
      );
    }

    return {
      canProceed: blockers.length === 0,
      blockers,
      warnings,
      rollbackCaveats: [
        'This transfer is one-way and does not automatically roll back inserted rows.',
        'If the target structure differs, run a fresh backup before reattempting the transfer.',
        'Primary key and index mismatches may require manual cleanup after a failed run.',
      ],
      estimatedImpact: {
        addedColumns,
        removedColumns,
        changedColumns,
        addedIndices,
        removedIndices,
        changedIndices,
      },
      source: {
        connectionId: context.sourceConn.id,
        connectionName: context.sourceConn.name,
        schema: this.normalizeSchemaName(
          context.sourceConn.type,
          dto.sourceSchema,
        ),
        table: this.normalizeTableName(dto.sourceTable),
        rowCount: context.sourceMetadata.rowCount ?? null,
        columnCount: context.sourceMetadata.columns?.length ?? 0,
        indexCount: context.sourceMetadata.indices?.length ?? 0,
      },
      target: {
        connectionId: context.targetConn.id,
        connectionName: context.targetConn.name,
        schema: this.normalizeSchemaName(
          context.targetConn.type,
          dto.targetSchema,
        ),
        table: this.normalizeTableName(dto.targetTable),
        rowCount: context.targetMetadata.rowCount ?? null,
        columnCount: context.targetMetadata.columns?.length ?? 0,
        indexCount: context.targetMetadata.indices?.length ?? 0,
      },
      columnDiffs,
      indexDiffs,
    };
  }
}
