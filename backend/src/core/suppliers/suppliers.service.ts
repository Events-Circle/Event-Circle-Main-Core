import { Injectable, NotFoundException } from '@nestjs/common';
import { Database } from '../../common/database.js';
import { SupplierDto } from './suppliers.dto.js';
import { requestContext } from '../../common/request-context.js';
@Injectable()
export class SuppliersService {
  constructor(private db: Database) {}
  create(userId: string, data: SupplierDto) {
    return this.db.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: data.businessName, memberships: { create: { userId, role: 'OWNER' } } },
      });
      const supplier = await tx.supplier.create({ data: { ...data, organizationId: org.id } });
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
      const supplier = await tx.supplier.update({ where: { organizationId }, data });
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
  async publicIdentity(id: string) {
    const supplier = await this.db.supplier.findUnique({
      where: { id },
      select: { id: true, businessName: true, category: true, city: true, serviceAreas: true },
    });
    if (!supplier) throw new NotFoundException();
    return supplier;
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
