import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { of } from 'rxjs';
import { NotificationsService } from './notifications.service';
import { TokenService } from '../auth/token.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  const notificationsServiceMock = {
    eventStream: jest.fn(),
  };
  const tokenServiceMock = {
    createNotificationsStreamTicket: jest.fn().mockReturnValue('stream-ticket'),
    verifyNotificationsStreamTicket: jest.fn().mockReturnValue({ sub: 'user-1' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: notificationsServiceMock },
        { provide: TokenService, useValue: tokenServiceMock },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should issue a short-lived stream ticket', () => {
    const result = controller.createStreamTicket({ user: { id: 'user-1' } } as any);
    expect(result).toEqual({ ticket: 'stream-ticket' });
    expect(tokenServiceMock.createNotificationsStreamTicket).toHaveBeenCalledWith('user-1');
  });

  it('should stream notifications when ticket is valid', (done) => {
    notificationsServiceMock.eventStream.mockReturnValue(of({ data: { message: 'hi' } }));

    controller.stream('stream-ticket').subscribe({
      next: (event) => {
        expect(event).toEqual({ data: { message: 'hi' } });
        expect(tokenServiceMock.verifyNotificationsStreamTicket).toHaveBeenCalledWith('stream-ticket');
        done();
      },
      error: done.fail,
    });
  });
});
