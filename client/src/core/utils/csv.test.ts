import { describe, expect, it } from 'vitest';
import { csvCell, csvDocument, parseCsv } from './csv';

describe('csv serialization', () => {
    it('quotes structural characters and neutralizes spreadsheet formulas', () => {
        expect(csvCell('a,b')).toBe('"a,b"');
        expect(csvCell('say "hi"')).toBe('"say ""hi"""');
        expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
        expect(csvCell(null)).toBe('');
    });

    it('serializes headers and rows with CRLF delimiters', () => {
        expect(csvDocument(['name', 'value,raw'], [['Ada', 'line\nnext']]))
            .toBe('name,"value,raw"\r\nAda,"line\nnext"');
    });

    it('parses quoted CSV fields without splitting embedded commas', async () => {
        const csv = 'name,note\r\nAda,"one,two"';
        const data = new TextEncoder().encode(csv).buffer;
        await expect(parseCsv(data)).resolves.toEqual([{ name: 'Ada', note: 'one,two' }]);
    });
});
