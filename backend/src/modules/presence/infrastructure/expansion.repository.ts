import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
  BadRequestException,
} from '@nestjs/common';
import { eventNames, presenceEventNames } from '@events-circle/contracts';
import { Database } from '../../../common/database.js';
import { EventsService } from '../../../core/audit/events.service.js';
import { AuditService } from '../../../core/audit/audit.service.js';
import { MediaService } from '../../../core/media/media.service.js';
import { CatalogsService } from '../../../core/catalogs/catalogs.service.js';
import { SuppliersService } from '../../../core/suppliers/suppliers.service.js';
import { paginate } from '../../../common/pagination.js';
import {
  normalizeSlug,
  profileReadiness,
  contentReadiness,
  validateMediaReferences,
  validatePrice,
  validateOfferWindow,
  validateSocialUrl,
  validateOrder,
  transition,
  PresenceRuleError,
} from '../domain/rules.js';
import type { PresenceDto } from '../api/presence.dto.js';
import type { ContentWriteDto, ContentPageQuery, Collection, ReorderDto } from '../api/content.dto.js';
import type { Prisma, PresenceContentKind } from '../../../../generated/client/index.js';
const kinds: Record<Collection, PresenceContentKind> = {
  portfolio: 'PORTFOLIO',
  listings: 'LISTING',
  gallery: 'GALLERY',
};
const include = { media: { orderBy: { displayOrder: 'asc' as const } } };
type Content = Prisma.PresenceContentGetPayload<{ include: typeof include }>;
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
function policy<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof PresenceRuleError)
      throw new UnprocessableEntityException({ code: error.code, details: { fields: error.fields } });
    throw error;
  }
}
function notReady(missing: string[]) {
  throw new UnprocessableEntityException({ code: 'PRESENCE_NOT_READY', details: { missing } });
}
@Injectable()
export class PresenceRepository {
  constructor(
    private db: Database,
    private events: EventsService,
    private audit: AuditService,
    private media: MediaService,
    private catalogs: CatalogsService,
    private suppliers: SuppliersService,
  ) {}
  find(supplierId: string) {
    return this.db.presenceProfile.findUnique({ where: { supplierId } });
  }
  async listingSummary(id: string) {
    const row = await this.db.presenceContent.findFirst({
      where: { id, kind: 'LISTING', status: 'PUBLISHED' },
      include,
    });
    if (!row) return null;
    const profile = await this.find(row.supplierId);
    const now = new Date();
    if (
      !profile?.published ||
      !profile.sections.includes('listings') ||
      (row.validFrom && row.validFrom > now) ||
      (row.validUntil && row.validUntil <= now)
    )
      return null;
    const cover = row.media.find((m) => m.role === 'COVER');
    if (!cover) return null;
    return {
      id: row.id,
      supplierId: row.supplierId,
      type: row.type!,
      title: row.title,
      coverMediaId: cover.mediaId,
    };
  }
  async publicProfile(slug: string) {
    const row = await this.db.presenceProfile.findFirst({
      where: { slug: slug.trim().toLowerCase(), published: true },
    });
    if (!row) throw new NotFoundException();
    return row;
  }
  async readiness(supplierId: string) {
    const row = await this.find(supplierId);
    if (!row) throw new NotFoundException();
    return profileReadiness({
      ...row,
      supplierExists: true,
      categoryActive: await this.suppliers.categoryReady(supplierId),
      logoReady: !!row.logoMediaId,
    });
  }
  async save(actor: string, org: string, supplierId: string, data: PresenceDto) {
    return this.db.$transaction(async (tx) => {
      const old = await tx.presenceProfile.findUnique({ where: { supplierId } });
      if (old && data.version !== undefined && old.version !== data.version) throw new ConflictException();
      const slug = policy(() => normalizeSlug(data.slug));
      const { version: _version, socialLinks, openingHours, ...inputFields } = data;
      // DTO instances have undefined optional own-properties. They must not erase
      // previously saved values when evaluating a partial profile update.
      const fields = Object.fromEntries(
        Object.entries(inputFields).filter(([, value]) => value !== undefined),
      ) as typeof inputFields;
      if (socialLinks)
        policy(() => socialLinks.forEach((link) => validateSocialUrl(link.provider, link.url)));
      if (
        openingHours &&
        (new Set(openingHours.map((h) => h.weekday)).size !== openingHours.length ||
          openingHours.some((h) =>
            h.closed ? !!h.opens || !!h.closes : !h.opens || !h.closes || h.opens >= h.closes,
          ))
      )
        throw new BadRequestException();
      const candidate = { ...old, ...fields, slug };
      await this.media.requireReady(
        org,
        [candidate.logoMediaId, candidate.coverMediaId].filter((id): id is string => !!id),
        tx,
      );
      if (candidate.published) {
        const check = profileReadiness({
          ...candidate,
          supplierExists: true,
          categoryActive: await this.suppliers.categoryReady(supplierId, tx),
          logoReady: !!candidate.logoMediaId,
        });
        if (!check.ready) notReady(check.missing);
      }
      const patch = {
        ...fields,
        slug,
        ...(socialLinks ? { socialLinks: json(socialLinks) } : {}),
        ...(openingHours ? { openingHours: json(openingHours) } : {}),
        publishedAt: candidate.published ? (old?.publishedAt ?? new Date()) : null,
      };
      let profile;
      if (old) {
        const updated = await tx.presenceProfile.updateMany({
          where: { id: old.id, version: old.version },
          data: { ...patch, version: { increment: 1 } },
        });
        if (!updated.count) throw new ConflictException();
        profile = await tx.presenceProfile.findUniqueOrThrow({ where: { id: old.id } });
      } else profile = await tx.presenceProfile.create({ data: { ...patch, supplierId } });
      await this.audit.record(tx, actor, 'presence.updated', profile.id);
      await this.events.record(tx, eventNames.presenceUpdated, org, {
        profileId: profile.id,
        supplierId,
        published: profile.published,
      });
      if (old?.slug && old.slug !== slug)
        await this.events.record(tx, presenceEventNames.slugChanged, org, {
          profileId: profile.id,
          supplierId,
          oldSlug: old.slug,
          newSlug: slug,
        });
      if (profile.published && !old?.published)
        await this.events.record(tx, presenceEventNames.published, org, {
          profileId: profile.id,
          supplierId,
          slug,
          publishedAt: profile.publishedAt!.toISOString(),
        });
      if (!profile.published && old?.published)
        await this.events.record(tx, presenceEventNames.unpublished, org, {
          profileId: profile.id,
          supplierId,
          reasonCode: 'OWNER_WITHDRAWAL',
        });
      return profile;
    });
  }
  private async lock(tx: Prisma.TransactionClient, supplierId: string, version?: number) {
    const updated = await tx.presenceProfile.updateMany({
      where: { supplierId, ...(version === undefined ? {} : { version }) },
      data: { version: { increment: 1 } },
    });
    if (!updated.count) {
      if (!(await tx.presenceProfile.findUnique({ where: { supplierId } }))) throw new NotFoundException();
      throw new ConflictException();
    }
  }
  private async validate(
    tx: Prisma.TransactionClient,
    org: string,
    kind: PresenceContentKind,
    data: ContentWriteDto,
  ) {
    policy(() => validateMediaReferences(data.media));
    await this.media.requireReady(
      org,
      data.media.map((m) => m.mediaId),
      tx,
    );
    if (data.categoryId) await this.catalogs.require(data.categoryId, 'CATEGORY', tx);
    if (data.locationId) await this.catalogs.require(data.locationId, 'LOCATION', tx);
    if (
      kind !== 'LISTING' &&
      [data.type, data.pricingMode, data.amountMinor, data.currency, data.validFrom, data.validUntil].some(
        (v) => v != null,
      )
    )
      throw new BadRequestException();
    if (kind === 'LISTING')
      policy(() => {
        validatePrice({
          pricingMode: data.pricingMode ?? 'ON_REQUEST',
          amountMinor: data.amountMinor,
          currency: data.currency,
        });
        validateOfferWindow(
          {
            type: data.type ?? 'SERVICE',
            validFrom: data.validFrom ? new Date(data.validFrom) : null,
            validUntil: data.validUntil ? new Date(data.validUntil) : null,
          },
          new Date(),
        );
      });
  }
  private ready(row: Content) {
    if (row.kind === 'GALLERY')
      return {
        ready: row.media.length > 0,
        missing: row.media.length ? [] : ['media'],
        score: row.media.length ? 100 : 0,
      };
    return contentReadiness(
      {
        ...row,
        categoryActive: !!row.categoryId,
        allMediaReady: true,
        media: row.media.map((m) => ({ ...m, role: m.role as 'COVER' | 'GALLERY' })),
        ...(row.kind === 'LISTING'
          ? {
              listing: {
                type: row.type!,
                pricingMode: row.pricingMode!,
                amountMinor: row.amountMinor,
                currency: row.currency,
                validFrom: row.validFrom,
                validUntil: row.validUntil,
              },
            }
          : {}),
      },
      new Date(),
    );
  }
  async write(
    actor: string,
    org: string,
    supplierId: string,
    collection: Collection,
    data: ContentWriteDto,
    id?: string,
  ) {
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, supplierId);
      const kind = kinds[collection];
      const old = id ? await tx.presenceContent.findFirst({ where: { id, supplierId, kind } }) : null;
      if (id && !old) throw new NotFoundException();
      if (old && (data.version !== old.version || old.status === 'ARCHIVED')) throw new ConflictException();
      if (!old && (await tx.presenceContent.count({ where: { supplierId, kind } })) >= 500)
        throw new ConflictException('Collection limit');
      await this.validate(tx, org, kind, data);
      const { media, version: _version, ...rest } = data;
      const fields = {
        ...rest,
        categoryId: rest.categoryId ?? null,
        locationId: rest.locationId ?? null,
        occurredAt: rest.occurredAt ? new Date(rest.occurredAt) : null,
        type: kind === 'LISTING' ? (rest.type ?? 'SERVICE') : null,
        pricingMode: kind === 'LISTING' ? (rest.pricingMode ?? 'ON_REQUEST') : null,
        amountMinor: rest.amountMinor ?? null,
        currency: rest.currency ?? null,
        validFrom: rest.validFrom ? new Date(rest.validFrom) : null,
        validUntil: rest.validUntil ? new Date(rest.validUntil) : null,
      };
      const attachments = media.map((m, displayOrder) => ({ ...m, displayOrder }));
      const row = old
        ? await tx.presenceContent.update({
            where: { id: old.id },
            data: { ...fields, version: { increment: 1 }, media: { deleteMany: {}, create: attachments } },
            include,
          })
        : await tx.presenceContent.create({
            data: { ...fields, supplierId, kind, media: { create: attachments } },
            include,
          });
      if (row.status === 'PUBLISHED') {
        const check = this.ready(row);
        if (!check.ready) notReady(check.missing);
      }
      await this.audit.record(tx, actor, `presence.${collection}.saved`, row.id);
      await this.events.record(tx, 'presence.content.updated.v1', org, {
        contentId: row.id,
        supplierId,
        kind,
      });
      return this.management(row);
    });
  }
  management(row: Content) {
    return {
      ...row,
      media: row.media.map(({ mediaId, role, altText, caption }) => ({ mediaId, role, altText, caption })),
    };
  }
  publicView(row: Content) {
    const {
      id,
      title,
      summary,
      description,
      categoryId,
      locationId,
      occurredAt,
      type,
      pricingMode,
      amountMinor,
      currency,
      validFrom,
      validUntil,
      serviceAreas,
      availabilityNote,
      featured,
      displayOrder,
    } = row;
    return {
      id,
      title,
      summary,
      description,
      categoryId,
      locationId,
      occurredAt,
      type,
      pricingMode,
      amountMinor,
      currency,
      validFrom,
      validUntil,
      serviceAreas,
      availabilityNote,
      featured,
      displayOrder,
      media: this.management(row).media,
    };
  }
  private filter(
    supplierId: string,
    collection: Collection,
    published: boolean,
    query: ContentPageQuery = { limit: 100 },
  ): Prisma.PresenceContentWhereInput {
    const now = new Date();
    return {
      supplierId,
      kind: kinds[collection],
      ...(query.type ? { type: query.type } : {}),
      ...(published
        ? {
            status: 'PUBLISHED',
            AND: [
              { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
              { OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
            ],
          }
        : {}),
    };
  }
  async list(supplierId: string, collection: Collection, query: ContentPageQuery, published = false) {
    const where = this.filter(supplierId, collection, published, query);
    const page = await paginate(
      query,
      (id) => this.db.presenceContent.findFirst({ where: { ...where, id } }),
      (args) =>
        this.db.presenceContent.findMany({
          where,
          include,
          orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
          ...args,
        }),
    );
    return {
      ...page,
      items: page.items.map((row) => (published ? this.publicView(row) : this.management(row))),
    };
  }
  async get(supplierId: string, collection: Collection, id: string, published = false) {
    const row = await this.db.presenceContent.findFirst({
      where: { ...this.filter(supplierId, collection, published), id },
      include,
    });
    if (!row) throw new NotFoundException();
    return published ? this.publicView(row) : this.management(row);
  }
  async lifecycle(
    actor: string,
    org: string,
    supplierId: string,
    collection: Collection,
    id: string,
    action: 'PUBLISH' | 'UNPUBLISH' | 'ARCHIVE' | 'RESTORE',
    version: number,
  ) {
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, supplierId);
      const row = await tx.presenceContent.findFirst({
        where: { id, supplierId, kind: kinds[collection] },
        include,
      });
      if (!row) throw new NotFoundException();
      if (row.version !== version) throw new ConflictException();
      const next = policy(() => transition(row.status, action));
      if (!next.changed) return this.management(row);
      if (action === 'PUBLISH') {
        await this.media.requireReady(
          org,
          row.media.map((m) => m.mediaId),
          tx,
        );
        if (row.categoryId) await this.catalogs.require(row.categoryId, 'CATEGORY', tx);
        if (row.locationId) await this.catalogs.require(row.locationId, 'LOCATION', tx);
        const check = this.ready(row);
        if (!check.ready) notReady(check.missing);
      }
      const result = await tx.presenceContent.update({
        where: { id },
        data: {
          status: next.status,
          version: { increment: 1 },
          publishedAt: action === 'PUBLISH' ? new Date() : null,
        },
        include,
      });
      await this.audit.record(tx, actor, `presence.${collection}.${action.toLowerCase()}`, id);
      if (action === 'PUBLISH' && collection === 'portfolio')
        await this.events.record(tx, presenceEventNames.portfolioPublished, org, {
          projectId: id,
          supplierId,
          categoryId: row.categoryId!,
          mediaIds: row.media.map((m) => m.mediaId),
        });
      else if (action === 'PUBLISH' && collection === 'listings')
        await this.events.record(tx, presenceEventNames.listingPublished, org, {
          listingId: id,
          supplierId,
          type: row.type!,
          title: row.title,
          coverMediaId: row.media.find((m) => m.role === 'COVER')!.mediaId,
        });
      else if (collection === 'listings' && row.status === 'PUBLISHED')
        await this.events.record(tx, presenceEventNames.listingUnpublished, org, {
          listingId: id,
          supplierId,
          reasonCode: action === 'ARCHIVE' ? 'ARCHIVED' : 'OWNER_WITHDRAWAL',
        });
      else
        await this.events.record(tx, 'presence.content.lifecycle.v1', org, {
          contentId: id,
          supplierId,
          kind: row.kind,
          status: result.status,
        });
      return this.management(result);
    });
  }
  async reorder(actor: string, org: string, supplierId: string, collection: Collection, data: ReorderDto) {
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, supplierId, data.version);
      const rows = await tx.presenceContent.findMany({
        where: { supplierId, kind: kinds[collection] },
        select: { id: true },
      });
      policy(() =>
        validateOrder(
          rows.map((r) => r.id),
          data.ids,
        ),
      );
      for (const [displayOrder, id] of data.ids.entries())
        await tx.presenceContent.update({ where: { id }, data: { displayOrder, version: { increment: 1 } } });
      await this.audit.record(tx, actor, `presence.${collection}.reordered`, supplierId);
      await this.events.record(tx, 'presence.content.reordered.v1', org, {
        supplierId,
        kind: kinds[collection],
      });
      return { version: data.version + 1 };
    });
  }
  async publicMedia(slug: string, id: string) {
    const profile = await this.publicProfile(slug);
    const attached =
      profile.logoMediaId === id ||
      profile.coverMediaId === id ||
      !!(await this.db.presenceContent.findFirst({
        where: {
          OR: (['portfolio', 'listings', 'gallery'] as Collection[])
            .filter((c) => profile.sections.includes(c))
            .map((c) => this.filter(profile.supplierId, c, true)),
          media: { some: { mediaId: id } },
        },
      }));
    if (!attached) throw new NotFoundException();
    return profile;
  }
}
