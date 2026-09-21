import { Injectable, NotFoundException, Inject, ServiceUnavailableException } from '@nestjs/common';
import { SuppliersService } from '../../../core/suppliers/suppliers.service.js';
import { PermissionsService } from '../../../core/permissions/permissions.service.js';
import { PresenceRepository } from '../infrastructure/expansion.repository.js';
import type { PresenceDto } from '../api/presence.dto.js';
import type { ContentWriteDto, ContentPageQuery, Collection, ReorderDto } from '../api/content.dto.js';
import { MediaService } from '../../../core/media/media.service.js';
import { RUNTIME, type Runtime } from '../../../config/runtime.js';
import type { PresenceQueries } from '@events-circle/contracts';
@Injectable()
export class PresenceService implements PresenceQueries {
  constructor(
    private suppliers: SuppliersService,
    private permissions: PermissionsService,
    private repository: PresenceRepository,
    private media: MediaService,
    @Inject(RUNTIME) private config: Runtime,
  ) {}
  async current(userId: string, org: string) {
    await this.permissions.require(userId, org, 'presence.read');
    const supplier = await this.suppliers.forOrganization(org);
    const profile = await this.repository.find(supplier.id);
    if (!profile) throw new NotFoundException();
    return profile;
  }
  async save(userId: string, org: string, data: PresenceDto) {
    await this.permissions.require(userId, org, 'presence.write');
    const supplier = await this.suppliers.forOrganization(org);
    return this.repository.save(userId, org, supplier.id, data);
  }
  async scope(actor: string, org: string, write = false) {
    await this.permissions.require(actor, org, write ? 'presence.write' : 'presence.read');
    return this.suppliers.forOrganization(org);
  }
  async readiness(actor: string, org: string) {
    const supplier = await this.scope(actor, org);
    return this.repository.readiness(supplier.id);
  }
  getPresenceReadiness(actor: string, org: string) {
    return this.readiness(actor, org);
  }
  getPublishedListingSummary(id: string) {
    return this.repository.listingSummary(id);
  }
  async assertListingBelongsToSupplier(actor: string, org: string, id: string) {
    await this.get(actor, org, 'listings', id);
  }
  async publication(actor: string, org: string, published: boolean, version: number) {
    const supplier = await this.scope(actor, org, true);
    const row = await this.repository.find(supplier.id);
    if (!row) throw new NotFoundException();
    if (row.version !== version) {
      return this.repository.save(actor, org, supplier.id, {
        description: row.description,
        published,
        version,
      });
    }
    if (row.published === published) return row;
    return this.repository.save(actor, org, supplier.id, {
      description: row.description,
      published,
      version,
    });
  }
  async write(actor: string, org: string, collection: Collection, data: ContentWriteDto, id?: string) {
    const supplier = await this.scope(actor, org, true);
    return this.repository.write(actor, org, supplier.id, collection, data, id);
  }
  async list(actor: string, org: string, collection: Collection, query: ContentPageQuery) {
    const supplier = await this.scope(actor, org);
    return this.repository.list(supplier.id, collection, query);
  }
  async get(actor: string, org: string, collection: Collection, id: string) {
    const supplier = await this.scope(actor, org);
    return this.repository.get(supplier.id, collection, id);
  }
  async lifecycle(
    actor: string,
    org: string,
    collection: Collection,
    id: string,
    action: 'PUBLISH' | 'UNPUBLISH' | 'ARCHIVE' | 'RESTORE',
    version: number,
  ) {
    const supplier = await this.scope(actor, org, true);
    return this.repository.lifecycle(actor, org, supplier.id, collection, id, action, version);
  }
  async reorder(actor: string, org: string, collection: Collection, data: ReorderDto) {
    const supplier = await this.scope(actor, org, true);
    return this.repository.reorder(actor, org, supplier.id, collection, data);
  }
  async publicList(slug: string, collection: Collection, query: ContentPageQuery, id?: string) {
    const profile = await this.repository.publicProfile(slug);
    if (!profile.sections.includes(collection)) throw new NotFoundException();
    if (id) return this.repository.get(profile.supplierId, collection, id, true);
    return this.repository.list(profile.supplierId, collection, query, true);
  }
  async publicMedia(slug: string, id: string) {
    const profile = await this.repository.publicMedia(slug, id);
    // Organization identity is resolved via Core; no module accesses Core tables.
    return this.media.bytesForSupplier(profile.supplierId, id);
  }
  async share(slug: string) {
    const profile = await this.repository.publicProfile(slug);
    if (!this.config.publicWebUrl) throw new ServiceUnavailableException('Public website not configured');
    const url = `${this.config.publicWebUrl}/p/${profile.slug}`;
    return { url, qrPayload: url, title: profile.seoTitle, description: profile.seoDescription };
  }
  async publicProfile(slug: string) {
    const profile = await this.repository.publicProfile(slug);
    const supplier = await this.suppliers.publicIdentity(profile.supplierId, {
      email: profile.showEmail,
      phone: profile.showPhone,
    });
    let inquiriesEnabled = false;
    if (this.config.enabled.includes('leads')) {
      try {
        await this.suppliers.inquiryTarget(supplier.id);
        inquiriesEnabled = true;
      } catch (error) {
        if (!(error instanceof NotFoundException)) throw error;
      }
    }
    const previews = await Promise.all(
      (['portfolio', 'listings', 'gallery'] as Collection[]).map(async (collection) =>
        profile.sections.includes(collection)
          ? (await this.repository.list(supplier.id, collection, { limit: 6 }, true)).items
          : [],
      ),
    );
    const {
      tagline,
      logoMediaId,
      coverMediaId,
      seoTitle,
      seoDescription,
      accentColor,
      socialLinks,
      openingHours,
      sections,
    } = profile;
    return {
      categoryDetails: profile.categoryDetails,
      slug: profile.slug,
      description: profile.description,
      supplier,
      tagline,
      logoMediaId,
      coverMediaId,
      seoTitle,
      seoDescription,
      accentColor,
      socialLinks,
      openingHours,
      sections,
      inquiriesEnabled,
      inquiryPath: inquiriesEnabled ? `/api/v1/leads/public/${supplier.id}` : null,
      portfolio: previews[0],
      listings: previews[1],
      gallery: previews[2],
    };
  }
}
