import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { Database } from '../../common/database.js';
import { PermissionsService } from '../permissions/permissions.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ObjectStore } from './object-store.js';
import type { Prisma } from '../../../generated/client/index.js';
import type { MediaAttachmentPort } from './media.port.js';
import { paginate, type PageQuery } from '../../common/pagination.js';
@Injectable()
export class MediaService implements MediaAttachmentPort {
  constructor(
    private db: Database,
    private permissions: PermissionsService,
    private audit: AuditService,
    private store: ObjectStore,
  ) {}
  async upload(actor: string, org: string, buffer?: Buffer) {
    await this.permissions.require(actor, org, 'media.write');
    if (!buffer?.length || buffer.length > 5 * 1024 * 1024) throw new BadRequestException();
    let output;
    try {
      const image = sharp(buffer, { limitInputPixels: 20000000, failOn: 'warning' });
      const meta = await image.metadata();
      if (!['jpeg', 'png', 'webp'].includes(meta.format ?? '') || (meta.pages ?? 1) !== 1) throw new Error();
      output = await image
        .rotate()
        .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new BadRequestException('Invalid image');
    }
    const id = randomUUID();
    const objectKey = `${org}/${id}.webp`;
    // Immutable object is persisted before READY metadata. Failed DB commits leave
    // an unreferenced private object, never a public/broken attachment.
    await this.store.put(objectKey, output.data);
    return this.db.$transaction(async (tx) => {
      const row = await tx.coreMedia.create({
        data: {
          id,
          organizationId: org,
          objectKey,
          width: output.info.width,
          height: output.info.height,
          bytes: output.data.length,
        },
      });
      await this.audit.record(tx, actor, 'core.media.ready', id);
      return this.view(row);
    });
  }
  view(row: { id: string; width: number; height: number; bytes: number; mimeType: string }) {
    return {
      id: row.id,
      width: row.width,
      height: row.height,
      bytes: row.bytes,
      mimeType: row.mimeType,
      status: 'READY' as const,
    };
  }
  async requireReady(org: string, ids: readonly string[], tx: Prisma.TransactionClient = this.db) {
    const distinct = [...new Set(ids)];
    const rows = await tx.coreMedia.findMany({ where: { id: { in: distinct }, organizationId: org } });
    if (rows.length !== distinct.length) throw new NotFoundException();
    return rows.map((row) => ({ ...this.view(row), organizationId: org }));
  }
  async bytes(org: string, id: string) {
    const row = await this.db.coreMedia.findFirst({ where: { id, organizationId: org } });
    if (!row) throw new NotFoundException();
    return this.store.get(row.objectKey);
  }
  async ownedBytes(actor: string, org: string, id: string) {
    await this.permissions.require(actor, org, 'media.read');
    return this.bytes(org, id);
  }
  async list(actor: string, org: string, query: PageQuery) {
    await this.permissions.require(actor, org, 'media.read');
    const page = await paginate(
      query,
      (id) => this.db.coreMedia.findFirst({ where: { id, organizationId: org } }),
      (args) =>
        this.db.coreMedia.findMany({
          where: { organizationId: org },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          ...args,
        }),
    );
    return { ...page, items: page.items.map((row) => this.view(row)) };
  }
  async bytesForSupplier(supplierId: string, id: string) {
    const supplier = await this.db.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new NotFoundException();
    return this.bytes(supplier.organizationId, id);
  }
}
