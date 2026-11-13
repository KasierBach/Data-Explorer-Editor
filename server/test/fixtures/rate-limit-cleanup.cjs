'use strict';

function trackRateLimitKeys(client, keys) {
  const call = client.call;
  client.call = function (...args) {
    if (
      args[0] === 'eval' &&
      args[2] === 2 &&
      typeof args[3] === 'string' &&
      typeof args[4] === 'string' &&
      /^\{[^{}]+:default\}:hits$/.test(args[3]) &&
      args[4] === args[3].replace(/:hits$/, ':blocked')
    ) {
      keys.add(args[3]);
      keys.add(args[4]);
    }
    return call.apply(this, args);
  };
  return () => {
    client.call = call;
  };
}

async function cleanupRateLimitFixture({
  client,
  keys,
  apps,
  closeApp,
  timeoutMs = 2_000,
}) {
  const failures = [];
  let timer;
  try {
    if (client && keys.size) {
      await Promise.race([
        Promise.resolve().then(() => client.del(...keys)),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('R10_REDIS_CLEANUP_TIMEOUT')),
            timeoutMs,
          );
        }),
      ]);
      keys.clear();
    }
  } catch (error) {
    failures.push(error);
  } finally {
    clearTimeout(timer);
    try {
      client?.disconnect();
    } catch (error) {
      failures.push(error);
    }
    const closed = await Promise.allSettled(
      apps
        .filter(Boolean)
        .map((app) => Promise.resolve().then(() => closeApp(app))),
    );
    for (const result of closed) {
      if (result.status === 'rejected') failures.push(result.reason);
    }
  }
  if (failures.length)
    throw new AggregateError(failures, 'R10_FIXTURE_CLEANUP_FAILED');
}

module.exports = { cleanupRateLimitFixture, trackRateLimitKeys };
