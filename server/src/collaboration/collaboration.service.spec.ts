import { BadRequestException } from '@nestjs/common';
import { CollaborationService } from './collaboration.service';

describe('CollaborationService attachments validation', () => {
  let service: CollaborationService;

  beforeEach(() => {
    service = new CollaborationService(
      {} as never,
      { findOrganizationLogs: jest.fn() } as never,
      {} as never,
      {} as never,
    );
  });

  const validate = (attachments?: string[]) =>
    (
      service as unknown as {
        validateAttachments: (items?: string[]) => string[] | null;
      }
    ).validateAttachments(attachments);

  it('returns null when no attachments are provided', () => {
    expect(validate(undefined)).toBeNull();
    expect(validate([])).toBeNull();
  });

  it('accepts whitelisted image types', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    expect(validate([png])).toEqual([png]);
  });

  it('accepts pdf and plain text', () => {
    expect(validate(['data:application/pdf;base64,AAAA'])).toEqual([
      'data:application/pdf;base64,AAAA',
    ]);
    expect(validate(['data:text/plain;base64,aGVsbG8='])).toEqual([
      'data:text/plain;base64,aGVsbG8=',
    ]);
  });

  it('rejects non-whitelisted MIME types', () => {
    expect(() => validate(['data:text/html;base64,PHNjcmlwdD4='])).toThrow(
      BadRequestException,
    );
    expect(() =>
      validate(['data:application/x-msdownload;base64,AAA']),
    ).toThrow(BadRequestException);
  });

  it('rejects malformed data URLs', () => {
    expect(() => validate(['not-a-data-url'])).toThrow(BadRequestException);
  });

  it('rejects payloads above the 2MB total limit', () => {
    const chunk = 'data:text/plain;base64,' + 'A'.repeat(1_200_000);
    expect(() => validate([chunk, chunk])).toThrow(BadRequestException);
  });
});
