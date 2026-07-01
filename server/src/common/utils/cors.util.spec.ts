import { getAllowedOrigins } from './cors.util';

describe('getAllowedOrigins', () => {
  it('does not allow localhost origins in production', () => {
    expect(getAllowedOrigins('production', 'https://app.example.com')).toEqual([
      'https://app.example.com',
    ]);
  });

  it('keeps local development origins and accepts comma-separated URLs', () => {
    expect(
      getAllowedOrigins(
        'development',
        'https://preview.example.com, https://app.example.com',
      ),
    ).toEqual([
      'http://localhost:5173',
      'http://localhost:4173',
      'https://preview.example.com',
      'https://app.example.com',
    ]);
  });
});
