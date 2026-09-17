import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Prisma } from '../../../generated/client/index.js';
import { Database } from '../../common/database.js';
import { SupplierDto } from './suppliers.dto.js';
import { requestContext } from '../../common/request-context.js';
@Injectable()
export class SuppliersService {
  constructor(private db: Database) {}
  async categoryReady(id: string, tx: Prisma.TransactionClient = this.db) {
    const supplier = await tx.supplier.findUnique({ where: { id } });
    if (!supplier) return false;
    if (!supplier.categoryId) return !!supplier.category.trim(); // Legacy free-text identity remains valid.
    return !!(await tx.coreCatalog.findFirst({
      where: { id: supplier.categoryId, kind: 'CATEGORY', active: true },
    }));
  }
  private async identity(tx: Prisma.TransactionClient, data: SupplierDto) {
    const category = await tx.coreCatalog.findFirst({
      where: {
        kind: 'CATEGORY',
        active: true,
        ...(data.categoryId
          ? { id: data.categoryId }
          : { label: { equals: data.category, mode: 'insensitive' } }),
      },
    });
    const location = await tx.coreCatalog.findFirst({
      where: {
        kind: 'LOCATION',
        active: true,
        ...(data.locationId
          ? { id: data.locationId }
          : { label: { equals: data.city, mode: 'insensitive' } }),
      },
    });
    if ((data.categoryId && !category) || (data.locationId && !location)) throw new BadRequestException();
    return {
      ...data,
      category: category?.label ?? data.category,
      city: location?.label ?? data.city,
      categoryId: category?.id ?? null,
      locationId: location?.id ?? null,
    };
  }
  create(userId: string, data: SupplierDto) {
    return this.db.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: data.businessName, memberships: { create: { userId, role: 'OWNER' } } },
      });
      const supplier = await tx.supplier.create({
        data: { ...(await this.identity(tx, data)), organizationId: org.id },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'core.supplier.created',
          targetId: supplier.id,
          correlationId: requestContext.getStore()?.correlationId,
        },
      });
      return supplier;
    });
  }
  update(userId: string, organizationId: string, data: SupplierDto) {
    return this.db.$transaction(async (tx) => {
      const supplier = await tx.supplier.update({
        where: { organizationId },
        data: await this.identity(tx, data),
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'core.supplier.updated',
          targetId: supplier.id,
          correlationId: requestContext.getStore()?.correlationId,
        },
      });
      return supplier;
    });
  }
  async forOrganization(organizationId: string) {
    const supplier = await this.db.supplier.findUnique({ where: { organizationId } });
    if (!supplier) throw new NotFoundException();
    return supplier;
  }
  async publicIdentity(id: string, visibility = { email: false, phone: false }) {
    const supplier = await this.db.supplier.findUnique({
      where: { id },
      select: {
        id: true,
        businessName: true,
        category: true,
        city: true,
        serviceAreas: true,
        contactEmail: true,
        contactPhone: true,
      },
    });
    if (!supplier) throw new NotFoundException();
    const { contactEmail, contactPhone, ...identity } = supplier;
    return {
      ...identity,
      ...(visibility.email && contactEmail ? { contactEmail } : {}),
      ...(visibility.phone && contactPhone ? { contactPhone } : {}),
    };
  }
  async inquiryTarget(id: string) {
    const supplier = await this.db.supplier.findFirst({
      where: { id, acceptInquiries: true },
      select: { id: true, organizationId: true },
    });
    if (!supplier) throw new NotFoundException();
    return supplier;
  }
}
