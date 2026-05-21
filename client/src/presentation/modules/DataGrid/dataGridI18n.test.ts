import { describe, expect, it } from 'vitest';
import { getDataGridText } from './dataGridI18n';

describe('dataGridI18n', () => {
  it('returns Vietnamese labels for find and replace actions', () => {
    const text = getDataGridText('vi');

    expect(text.find).toBe('Tìm');
    expect(text.findReplace).toBe('Tìm / Thay');
    expect(text.saveChanges).toBe('Lưu thay đổi');
    expect(text.loadingSchema).toBe('Đang tải cấu trúc...');
  });

  it('returns English labels for find and replace actions', () => {
    const text = getDataGridText('en');

    expect(text.find).toBe('Find');
    expect(text.findReplace).toBe('Find / Replace');
    expect(text.saveChanges).toBe('Save Changes');
    expect(text.loadingSchema).toBe('Loading Schema...');
  });
});
