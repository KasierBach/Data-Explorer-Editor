import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const assetDirectory = path.resolve('dist/assets');
const maxApplicationChunkBytes = 750 * 1024;
const applicationChunks = readdirSync(assetDirectory)
  .filter((name) => name.endsWith('.js'))
  .filter((name) => !name.startsWith('vendor-') && !name.includes('.worker-'))
  .map((name) => ({ name, bytes: statSync(path.join(assetDirectory, name)).size }))
  .sort((a, b) => b.bytes - a.bytes);
const oversized = applicationChunks.filter(
  (chunk) => chunk.bytes > maxApplicationChunkBytes,
);

if (oversized.length > 0) {
  for (const chunk of oversized) {
    console.error(`${chunk.name} exceeds 750 KB (${Math.ceil(chunk.bytes / 1024)} KB).`);
  }
  process.exitCode = 1;
} else {
  const largest = applicationChunks[0];
  console.log(
    `Bundle budget passed; largest application chunk is ${largest.name} (${Math.ceil(largest.bytes / 1024)} KB).`,
  );
}
