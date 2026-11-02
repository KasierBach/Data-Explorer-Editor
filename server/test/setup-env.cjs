const { createE2eEnvironment } = require('./e2e-environment.cjs');

process.env = createE2eEnvironment(process.env);

// The generated Prisma entrypoint also loads .env independently of Nest config.
jest.mock('@prisma/client/runtime/client.js', () => ({
  ...jest.requireActual('@prisma/client/runtime/client.js'),
  warnEnvConflicts: () => {},
}));

// AppModule must not import workstation credentials from .env in this harness.
const { ConfigModule } = require('@nestjs/config');
const forRoot = ConfigModule.forRoot.bind(ConfigModule);
jest
  .spyOn(ConfigModule, 'forRoot')
  .mockImplementation((options) =>
    forRoot({ ...options, ignoreEnvFile: true }),
  );
