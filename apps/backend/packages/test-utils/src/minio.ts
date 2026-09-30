/**
 * MinIO test client: a plain minio Client against the docker instance,
 * pointed at a dedicated `ain-rider-test` bucket (created on demand) so
 * tests never touch the dev `ain-rider` bucket.
 */

import { Client } from 'minio';
import { loadTestEnv } from './env';

export function createTestMinio(): Client {
  const env = loadTestEnv();
  return new Client({
    endPoint: env.minioEndpoint,
    port: env.minioPort,
    useSSL: false,
    accessKey: env.minioAccessKey,
    secretKey: env.minioSecretKey,
    region: env.minioRegion,
  });
}

/** Create the test bucket if it does not exist yet. */
export async function ensureTestBucket(client: Client): Promise<string> {
  const env = loadTestEnv();
  const exists = await client.bucketExists(env.minioBucket);
  if (!exists) {
    await client.makeBucket(env.minioBucket, env.minioRegion);
  }
  return env.minioBucket;
}
