import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDataGridEditing } from './useDataGridEditing';
import type { RowData, TableMetadata } from '@/core/domain/entities';
import { getRowIdentity } from './rowIdentity';

const fixture = vi.hoisted(() => ({updateRow:vi.fn(),deleteRows:vi.fn(),toastError:vi.fn(),store:{activeConnectionId:'connection',connections:[{id:'connection',type:'postgres'}],lang:'en'}}));
vi.mock('@/core/services/store',()=>({useAppStore:()=>fixture.store}));
vi.mock('@/core/services/ConnectionService',()=>({connectionService:{getAdapter:()=>({updateRow:fixture.updateRow,deleteRows:fixture.deleteRows})}}));
vi.mock('sonner',()=>({toast:{error:fixture.toastError,success:vi.fn()}}));

function setup(rows:RowData[], keys=['id']) {
  const metadata:TableMetadata={columns:[...keys.map(name=>({name,type:'text',isPrimaryKey:true,isNullable:false,isForeignKey:false})),{name:'note',type:'text',isPrimaryKey:false,isNullable:true,isForeignKey:false}]};
  const params={tableId:'items',metadata,dbName:'test',schema:'public',cleanTableName:'items',pkField:keys[0],rows,refetch:vi.fn()};
  return {params,...renderHook(props=>useDataGridEditing(props),{initialProps:params})};
}
function keyFor(editing:ReturnType<typeof useDataGridEditing>,row:RowData) {
  const getRowKey=(editing as {getRowKey?:(row:RowData)=>string|undefined}).getRowKey;
  return getRowKey?.(row) ?? String(row.tenant ?? row.id);
}
describe('R04 editing keeps database keys separate from UI state',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    fixture.updateRow.mockResolvedValue({success:true,rowCount:1});
    fixture.deleteRows.mockResolvedValue({success:true,rowCount:1});
    vi.stubGlobal('confirm',vi.fn(()=>true));
  });
  it('sends text 001 without converting it into number 1',async()=>{
    const rows=[{id:'001',note:'first'},{id:'1',note:'second'}];
    const {result}=setup(rows);
    act(()=>result.current.handleCellChange(keyFor(result.current,rows[0]),'note','changed'));
    await act(()=>result.current.handleSaveData());
    expect(fixture.updateRow).toHaveBeenCalledWith(expect.objectContaining({pkValue:'001',identity:[{column:'id',value:'001'}],updates:{note:'changed'}}));
  });
  it('retains both pending edits for A/1 and A/2',async()=>{
    const rows=[{tenant:'A',id:1,note:'a1'},{tenant:'A',id:2,note:'a2'},{tenant:'B',id:1,note:'b1'}];
    const {result}=setup(rows,['tenant','id']);
    act(()=>{result.current.handleCellChange(keyFor(result.current,rows[0]),'note','first');result.current.handleCellChange(keyFor(result.current,rows[1]),'note','second');});
    await act(()=>result.current.handleSaveData());
    expect(fixture.updateRow).toHaveBeenCalledTimes(2);
    expect(fixture.updateRow).toHaveBeenNthCalledWith(1,expect.objectContaining({identity:[{column:'tenant',value:'A'},{column:'id',value:1}],updates:{note:'first'}}));
    expect(fixture.updateRow).toHaveBeenNthCalledWith(2,expect.objectContaining({identity:[{column:'tenant',value:'A'},{column:'id',value:2}],updates:{note:'second'}}));
  });
  it('selects and deletes just A/2 without selecting A/1',async()=>{
    const rows=[{tenant:'A',id:1},{tenant:'A',id:2},{tenant:'B',id:1}];
    const {result}=setup(rows,['tenant','id']);
    act(()=>result.current.toggleRowSelection(keyFor(result.current,rows[1])));
    expect(result.current.selectedRows.has(keyFor(result.current,rows[0]))).toBe(false);
    await act(()=>result.current.handleDeleteRows());
    expect(fixture.deleteRows).toHaveBeenCalledWith(expect.objectContaining({identities:[[{column:'tenant',value:'A'},{column:'id',value:2}]]}));
  });
  it('does not send a confirmed delete after cancel',async()=>{
    const rows=[{id:'001'}]; const {result}=setup(rows);
    act(()=>result.current.toggleRowSelection(keyFor(result.current,rows[0])));
    vi.mocked(confirm).mockReturnValue(false);
    await act(()=>result.current.handleDeleteRows());
    expect(fixture.deleteRows).not.toHaveBeenCalled();
  });
  it('refuses a no-PK or unsafe-number identity instead of sending a write',async()=>{
    const rows=[{id:9007199254740992,note:'original'}]; const {result}=setup(rows);
    act(()=>result.current.handleCellChange(keyFor(result.current,rows[0]),'note','changed'));
    await act(()=>result.current.handleSaveData());
    expect(fixture.updateRow).not.toHaveBeenCalled();
  });
  it('does not clear new-table edits when an old-table save finishes',async()=>{
    let finish!:(value:{success:boolean;rowCount:number})=>void;
    fixture.updateRow.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    const rows=[{id:'001',note:'old'}]; const {result,rerender,params}=setup(rows);
    act(()=>result.current.handleCellChange(keyFor(result.current,rows[0]),'note','old change'));
    let task!:Promise<void>;act(()=>{task=result.current.handleSaveData();});
    rerender({...params,tableId:'other',cleanTableName:'other',rows:[{id:'002',note:'new'}]});
    act(()=>result.current.handleCellChange(keyFor(result.current,{id:'002'}),'note','new change'));
    await act(async()=>{finish({success:true,rowCount:1});await task;});
    expect(Object.values(result.current.pendingChanges)).toEqual([{note:'new change'}]);
  });
  it('freezes edits while a save is in flight',async()=>{
    let finish!:(value:{success:boolean;rowCount:number})=>void;
    fixture.updateRow.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    const rows=[{id:'001',note:'old'}]; const {result}=setup(rows);
    const key=keyFor(result.current,rows[0]);
    act(()=>result.current.handleCellChange(key,'note','first'));
    let task!:Promise<void>;act(()=>{task=result.current.handleSaveData();});
    act(()=>result.current.handleCellChange(key,'note','second'));
    const pendingDuringSave=Object.values(result.current.pendingChanges);
    await act(async()=>{finish({success:true,rowCount:1});await task;});
    expect(pendingDuringSave).toEqual([{note:'first'}]);
  });
  it('retains only failed edits after a partially successful save',async()=>{
    fixture.updateRow.mockResolvedValueOnce({success:true,rowCount:1}).mockRejectedValueOnce(new Error('write conflict'));
    const rows=[{id:'001'},{id:'1'}];const {result}=setup(rows);
    act(()=>{result.current.handleCellChange(keyFor(result.current,rows[0]),'note','first');result.current.handleCellChange(keyFor(result.current,rows[1]),'note','second');});
    await act(()=>result.current.handleSaveData());
    expect(Object.values(result.current.pendingChanges)).toEqual([{note:'second'}]);
    expect(fixture.toastError).toHaveBeenCalledWith('write conflict');
  });
  it('contains temporal keys whose driver representation can lose precision',()=>{
    const {params}=setup([{id:'2026-01-01T00:00:00.123Z'}]);
    params.metadata.columns[0].type='timestamp with time zone';
    expect(getRowIdentity({id:'2026-01-01T00:00:00.123Z'},params.metadata)).toBeUndefined();
  });
  it('requires exact decimal strings instead of rounded driver numbers',()=>{
    const {params}=setup([{id:1}]);params.metadata.columns[0].type='decimal';
    expect(getRowIdentity({id:1},params.metadata)).toBeUndefined();
    expect(getRowIdentity({id:'1.000000000000000001'},params.metadata)).toEqual([{column:'id',value:'1.000000000000000001'}]);
  });
});
