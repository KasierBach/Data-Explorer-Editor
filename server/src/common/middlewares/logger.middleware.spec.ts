import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import { LoggerMiddleware } from './logger.middleware';

describe('LoggerMiddleware', () => {
  it('propagates a valid request ID without logging query secrets', () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const response = new EventEmitter() as EventEmitter & {
      statusCode: number;
      setHeader: jest.Mock;
      get: jest.Mock;
    };
    response.statusCode = 200;
    response.setHeader = jest.fn();
    response.get = jest.fn(() => '42');
    const request = {
      method: 'GET',
      path: '/api/auth/callback',
      originalUrl: '/api/auth/callback?ticket=secret',
      headers: {},
      get: jest.fn(() => 'request-123'),
    };
    const next = jest.fn();

    new LoggerMiddleware().use(request as never, response as never, next);
    response.emit('finish');

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.setHeader).toHaveBeenCalledWith(
      'x-request-id',
      'request-123',
    );
    expect(request.headers).toEqual({ 'x-request-id': 'request-123' });
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/callback'),
    );
    expect(log).not.toHaveBeenCalledWith(
      expect.stringContaining('ticket=secret'),
    );
    log.mockRestore();
  });
});
