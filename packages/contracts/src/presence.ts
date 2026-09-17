/** Presence V1 expansion contracts. Types are not evidence of deployed endpoints. */
export const presenceStatuses = ['DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED'] as const;
export type PresenceStatus = (typeof presenceStatuses)[number];
export const listingTypes = ['SERVICE', 'PRODUCT', 'PACKAGE', 'OFFER'] as const;
export type ListingType = (typeof listingTypes)[number];
export const pricingModes = ['FIXED', 'FROM', 'ON_REQUEST', 'FREE'] as const;
export type PricingMode = (typeof pricingModes)[number];
export type MediaRole = 'COVER' | 'GALLERY';
export interface PresenceMediaReference {
  mediaId: string;
  role: MediaRole;
  altText: string;
  caption?: string;
}
export type PresenceBlocker =
  | 'supplier'
  | 'slug'
  | 'description'
  | 'category'
  | 'logoMediaId'
  | 'title'
  | 'media'
  | 'pricing'
  | 'offerDates';
export interface PresenceReadiness {
  ready: boolean;
  missing: PresenceBlocker[];
  score: number;
}
export const presenceEventNames = {
  updated: 'presence.profile.updated.v1',
  published: 'presence.profile.published.v1',
  unpublished: 'presence.profile.unpublished.v1',
  slugChanged: 'presence.slug.changed.v1',
  portfolioPublished: 'presence.portfolio.published.v1',
  listingPublished: 'presence.listing.published.v1',
  listingUnpublished: 'presence.listing.unpublished.v1',
} as const;
/** Existing updated event stays byte-shape compatible; expansion events are additive. */
export interface PresenceEventPayloads {
  'presence.profile.updated.v1': { profileId: string; supplierId: string; published: boolean };
  'presence.profile.published.v1': {
    profileId: string;
    supplierId: string;
    slug: string;
    publishedAt: string;
  };
  'presence.profile.unpublished.v1': {
    profileId: string;
    supplierId: string;
    reasonCode: 'OWNER_WITHDRAWAL';
  };
  'presence.slug.changed.v1': { profileId: string; supplierId: string; oldSlug: string; newSlug: string };
  'presence.portfolio.published.v1': {
    projectId: string;
    supplierId: string;
    categoryId: string;
    mediaIds: string[];
  };
  'presence.listing.published.v1': {
    listingId: string;
    supplierId: string;
    type: ListingType;
    title: string;
    coverMediaId: string;
  };
  'presence.listing.unpublished.v1': {
    listingId: string;
    supplierId: string;
    reasonCode: 'OWNER_WITHDRAWAL' | 'EXPIRED' | 'ARCHIVED';
  };
}
/** Public summaries deliberately exclude organization IDs and private contacts. */
export interface PublishedListingSummary {
  id: string;
  supplierId: string;
  type: ListingType;
  title: string;
  coverMediaId: string;
}
/** Contracts for future adapters. Not registered as a runtime provider in this increment. */
export interface PresenceQueries {
  getPublishedListingSummary(id: string): Promise<PublishedListingSummary | null>;
  getPresenceReadiness(actorId: string, organizationId: string): Promise<PresenceReadiness>;
  assertListingBelongsToSupplier(actorId: string, organizationId: string, listingId: string): Promise<void>;
}
