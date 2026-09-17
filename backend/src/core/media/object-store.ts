import { Inject, Injectable, ServiceUnavailableException, type OnModuleDestroy } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { RUNTIME, type Runtime } from '../../config/runtime.js';

/** Private Railway S3 bucket; credentials and object keys remain server-only. */
@Injectable()
export class ObjectStore implements OnModuleDestroy {
  private readonly client?: S3Client;
  constructor(@Inject(RUNTIME) private config: Runtime) {
    if (
      config.storageUrl &&
      config.storageAccessKeyId &&
      config.storageSecretAccessKey &&
      config.storageBucket &&
      config.storageRegion
    )
      this.client = new S3Client({
        endpoint: config.storageUrl,
        region: config.storageRegion,
        credentials: {
          accessKeyId: config.storageAccessKeyId,
          secretAccessKey: config.storageSecretAccessKey,
        },
        forcePathStyle: config.storageForcePathStyle ?? false,
        maxAttempts: 2,
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      });
  }
  onModuleDestroy() {
    this.client?.destroy();
  }
  private ready(key: string): S3Client {
    if (!this.client || !/^[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+\.webp$/.test(key))
      throw new ServiceUnavailableException('Media storage unavailable');
    return this.client;
  }
  async put(key: string, bytes: Buffer) {
    try {
      await this.ready(key).send(
        new PutObjectCommand({
          Bucket: this.config.storageBucket,
          Key: key,
          Body: bytes,
          ContentType: 'image/webp',
        }),
        { abortSignal: AbortSignal.timeout(15000) },
      );
    } catch {
      throw new ServiceUnavailableException('Media storage unavailable');
    }
  }
  async get(key: string) {
    try {
      const result = await this.ready(key).send(
        new GetObjectCommand({
          Bucket: this.config.storageBucket,
          Key: key,
        }),
        { abortSignal: AbortSignal.timeout(15000) },
      );
      if (!result.Body) throw new Error('Empty storage response');
      return Buffer.from(await result.Body.transformToByteArray());
    } catch {
      throw new ServiceUnavailableException('Media storage unavailable');
    }
  }
}
