import { Injectable, NotFoundException } from '@nestjs/common';
import { SuppliersService } from '../../../core/suppliers/suppliers.service.js';
import { PermissionsService } from '../../../core/permissions/permissions.service.js';
import { PresenceRepository } from '../infrastructure/presence.repository.js';
import type { Profile } from '../domain/profile.js';
@Injectable()
export class PresenceService {
  constructor(
    private suppliers: SuppliersService,
    private permissions: PermissionsService,
    private repository: PresenceRepository,
  ) {}
  async current(userId: string, org: string) {
    await this.permissions.require(userId, org, 'presence.read');
    const supplier = await this.suppliers.forOrganization(org);
    const profile = await this.repository.find(supplier.id);
    if (!profile) throw new NotFoundException();
    return profile;
  }
  async save(userId: string, org: string, data: Omit<Profile, 'supplierId'>) {
    await this.permissions.require(userId, org, 'presence.write');
    const supplier = await this.suppliers.forOrganization(org);
    return this.repository.save(userId, org, { ...data, supplierId: supplier.id });
  }
  async publicProfile(slug: string) {
    const profile = await this.repository.publicProfile(slug);
    if (!profile) throw new NotFoundException();
    return {
      slug: profile.slug,
      description: profile.description,
      supplier: await this.suppliers.publicIdentity(profile.supplierId),
    };
  }
}
