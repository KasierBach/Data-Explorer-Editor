import { describe, expect, it } from 'vitest';
import {
  ALL_TEXT_COLUMNS,
  buildBulkSearchPlan,
  buildBulkReplacePlan,
  type BulkReplaceOptions,
} from './bulkReplaceUtils';

const baseOptions: BulkReplaceOptions = {
  scope: 'page',
  columnId: 'customer_name',
  findText: 'Customer 1',
  replaceText: 'Khach Hang 1',
  matchMode: 'exact',
  caseSensitive: false,
};

describe('bulkReplaceUtils', () => {
  it('replaces exact matches ignoring case when requested', () => {
    const plan = buildBulkReplacePlan({
      targetRows: [
        {
          rowId: '1',
          rowIndex: 0,
          values: { customer_name: 'customer 1' },
        },
      ],
      pendingChanges: {},
      options: baseOptions,
      textColumnIds: ['customer_name'],
    });

    expect(plan.matchedRows).toBe(1);
    expect(plan.matchedCells).toBe(1);
    expect(plan.updatesByRow['1']).toEqual({
      customer_name: 'Khach Hang 1',
    });
  });

  it('replaces repeated substrings for contains mode', () => {
    const plan = buildBulkReplacePlan({
      targetRows: [
        {
          rowId: '1',
          rowIndex: 0,
          values: { notes: 'foo foo food' },
        },
      ],
      pendingChanges: {},
      options: {
        ...baseOptions,
        columnId: 'notes',
        findText: 'foo',
        replaceText: 'bar',
        matchMode: 'contains',
      },
      textColumnIds: ['notes'],
    });

    expect(plan.updatesByRow['1']).toEqual({
      notes: 'bar bar bard',
    });
  });

  it('replaces whole words without touching partial suffixes', () => {
    const plan = buildBulkReplacePlan({
      targetRows: [
        {
          rowId: '1',
          rowIndex: 0,
          values: { notes: 'sinh viên sinh viên123' },
        },
      ],
      pendingChanges: {},
      options: {
        ...baseOptions,
        columnId: 'notes',
        findText: 'sinh viên',
        replaceText: 'hoc vien',
        matchMode: 'whole-word',
      },
      textColumnIds: ['notes'],
    });

    expect(plan.updatesByRow['1']).toEqual({
      notes: 'hoc vien sinh viên123',
    });
  });

  it('uses pending changes as the source for repeated replace runs', () => {
    const plan = buildBulkReplacePlan({
      targetRows: [
        {
          rowId: '1',
          rowIndex: 0,
          values: { status: 'pending review' },
        },
      ],
      pendingChanges: {
        '1': {
          status: 'pending approval',
        },
      },
      options: {
        ...baseOptions,
        columnId: 'status',
        findText: 'approval',
        replaceText: 'review',
        matchMode: 'contains',
      },
      textColumnIds: ['status'],
    });

    expect(plan.updatesByRow['1']).toEqual({
      status: 'pending review',
    });
  });

  it('targets all text columns when requested', () => {
    const plan = buildBulkReplacePlan({
      targetRows: [
        {
          rowId: '1',
          rowIndex: 0,
          values: {
            customer_name: 'Lan sai chinh ta',
            email: 'sai@example.com',
            amount: 100,
          },
        },
      ],
      pendingChanges: {},
      options: {
        ...baseOptions,
        columnId: ALL_TEXT_COLUMNS,
        findText: 'sai',
        replaceText: 'dung',
        matchMode: 'contains',
      },
      textColumnIds: ['customer_name', 'email'],
    });

    expect(plan.matchedCells).toBe(2);
    expect(plan.updatesByRow['1']).toEqual({
      customer_name: 'Lan dung chinh ta',
      email: 'dung@example.com',
    });
  });

  it('builds search matches without staging updates', () => {
    const plan = buildBulkSearchPlan({
      targetRows: [
        {
          rowId: '1',
          rowIndex: 2,
          values: { notes: 'foo bar' },
        },
      ],
      pendingChanges: {},
      options: {
        columnId: 'notes',
        findText: 'foo',
        matchMode: 'contains',
        caseSensitive: false,
      },
      textColumnIds: ['notes'],
    });

    expect(plan.matchedRows).toBe(1);
    expect(plan.matchedCells).toBe(1);
    expect(plan.matches[0]).toEqual({
      rowId: '1',
      rowIndex: 2,
      columnId: 'notes',
      cellKey: '1::notes',
      preview: 'foo bar',
    });
  });

  it('uses pending changes as the source for search previews too', () => {
    const plan = buildBulkSearchPlan({
      targetRows: [
        {
          rowId: '1',
          rowIndex: 0,
          values: { notes: 'old value' },
        },
      ],
      pendingChanges: {
        '1': { notes: 'new staged value' },
      },
      options: {
        columnId: 'notes',
        findText: 'staged',
        matchMode: 'contains',
        caseSensitive: false,
      },
      textColumnIds: ['notes'],
    });

    expect(plan.matchedCells).toBe(1);
    expect(plan.matches[0]?.preview).toBe('new staged value');
  });
});
