import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';

describe('TokenService notifications stream tickets', () => {
  let tokenService: TokenService;

  beforeEach(() => {
    tokenService = new TokenService(
      new JwtService({ secret: '0123456789abcdef0123456789abcdef' }),
    );
  });

  it('should create and verify a notifications stream ticket', () => {
    const ticket = tokenService.createNotificationsStreamTicket('user-1');
    const payload = tokenService.verifyNotificationsStreamTicket(ticket);

    expect(payload).toMatchObject({
      sub: 'user-1',
      type: 'notifications-stream',
    });
  });

  it('should reject a missing notifications stream ticket', () => {
    expect(() => tokenService.verifyNotificationsStreamTicket()).toThrow(
      UnauthorizedException,
    );
  });

  it('keeps the complete saved profile in refreshed sessions', () => {
    expect(
      tokenService.buildUserProfile({
        id: 'user-1',
        email: 'user@example.com',
        avatarUrl: 'data:image/png;base64,abc123',
        bio: 'Data engineer',
        phoneNumber: '+84 123',
        address: 'Ho Chi Minh City',
      }),
    ).toMatchObject({
      id: 'user-1',
      email: 'user@example.com',
      avatarUrl: 'data:image/png;base64,abc123',
      bio: 'Data engineer',
      phoneNumber: '+84 123',
      address: 'Ho Chi Minh City',
    });
  });
});
