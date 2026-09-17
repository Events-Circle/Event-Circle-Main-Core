import type {
  ListingType,
  PresenceBlocker,
  PresenceMediaReference,
  PresenceReadiness,
  PresenceStatus,
  PricingMode,
} from '@events-circle/contracts';

export class PresenceRuleError extends Error {
  constructor(
    public readonly code: string,
    public readonly fields: readonly string[] = [],
  ) {
    super(code);
  }
}

const reservedSlugs = new Set([
  'admin',
  'api',
  'auth',
  'account',
  'dashboard',
  'help',
  'login',
  'logout',
  'presence',
  'public',
  'register',
  'settings',
  'support',
  'www',
]);
export function normalizeSlug(input: string): string {
  const slug = input.trim().toLowerCase();
  if (
    slug.length < 3 ||
    slug.length > 80 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
    reservedSlugs.has(slug)
  )
    throw new PresenceRuleError('PRESENCE_INVALID_SLUG', ['slug']);
  return slug;
}

export interface Price {
  pricingMode: PricingMode;
  amountMinor?: number | null;
  currency?: string | null;
}
/** V1 settlement/display currencies. Extend deliberately; a 3-letter regex is not ISO validation. */
export const supportedCurrencies = [
  'USD',
  'EUR',
  'GBP',
  'LBP',
  'AED',
  'SAR',
  'QAR',
  'KWD',
  'BHD',
  'OMR',
  'JOD',
  'EGP',
  'CAD',
  'AUD',
] as const;
export function validatePrice(price: Price): void {
  if (price.pricingMode === 'FIXED' || price.pricingMode === 'FROM') {
    if (
      !Number.isSafeInteger(price.amountMinor) ||
      price.amountMinor! <= 0 ||
      !supportedCurrencies.some((currency) => currency === price.currency)
    )
      throw new PresenceRuleError('PRESENCE_INVALID_PRICE', ['amountMinor', 'currency']);
  } else if (price.pricingMode === 'ON_REQUEST' || price.pricingMode === 'FREE') {
    if (price.amountMinor != null || price.currency != null)
      throw new PresenceRuleError('PRESENCE_INVALID_PRICE', ['amountMinor', 'currency']);
  } else throw new PresenceRuleError('PRESENCE_INVALID_PRICE', ['pricingMode']);
}

export interface OfferWindow {
  type: ListingType;
  validFrom?: Date | null;
  validUntil?: Date | null;
}
export function validateOfferWindow(window: OfferWindow, now: Date, publishing = false): void {
  const { type, validFrom, validUntil } = window;
  if (!['SERVICE', 'PRODUCT', 'PACKAGE', 'OFFER'].includes(type))
    throw new PresenceRuleError('PRESENCE_INVALID_LISTING_TYPE', ['type']);
  if (!Number.isFinite(now.getTime())) throw new PresenceRuleError('PRESENCE_INVALID_TIME');
  if (type !== 'OFFER' && (validFrom != null || validUntil != null))
    throw new PresenceRuleError('PRESENCE_INVALID_OFFER_DATES', ['validFrom', 'validUntil']);
  if (
    (validFrom && !Number.isFinite(validFrom.getTime())) ||
    (validUntil && !Number.isFinite(validUntil.getTime())) ||
    (validFrom && validUntil && validUntil <= validFrom) ||
    (publishing && validUntil && validUntil <= now)
  )
    throw new PresenceRuleError('PRESENCE_INVALID_OFFER_DATES', ['validFrom', 'validUntil']);
}

export function isPublicContent(
  parent: PresenceStatus,
  child: PresenceStatus,
  window: OfferWindow,
  now: Date,
): boolean {
  if (parent !== 'PUBLISHED' || child !== 'PUBLISHED') return false;
  try {
    validateOfferWindow(window, now);
  } catch {
    return false;
  }
  return (!window.validFrom || window.validFrom <= now) && (!window.validUntil || window.validUntil > now);
}

export type PresenceAction = 'PUBLISH' | 'UNPUBLISH' | 'ARCHIVE' | 'RESTORE';
/** Restore returns to a private draft; publish/archive repetition is idempotent. */
export function transition(
  status: PresenceStatus,
  action: PresenceAction,
): { status: PresenceStatus; changed: boolean } {
  const transitions: Record<PresenceStatus, Partial<Record<PresenceAction, PresenceStatus>>> = {
    DRAFT: { PUBLISH: 'PUBLISHED', ARCHIVE: 'ARCHIVED' },
    PUBLISHED: { PUBLISH: 'PUBLISHED', UNPUBLISH: 'UNPUBLISHED', ARCHIVE: 'ARCHIVED' },
    UNPUBLISHED: { PUBLISH: 'PUBLISHED', UNPUBLISH: 'UNPUBLISHED', ARCHIVE: 'ARCHIVED' },
    ARCHIVED: { ARCHIVE: 'ARCHIVED', RESTORE: 'DRAFT' },
  };
  const next = transitions[status]?.[action];
  if (!next) throw new PresenceRuleError('PRESENCE_INVALID_TRANSITION', ['status']);
  return { status: next, changed: next !== status };
}

export function validateOrder(currentIds: readonly string[], orderedIds: readonly string[]): void {
  const current = new Set(currentIds);
  if (
    current.size !== currentIds.length ||
    orderedIds.length !== current.size ||
    new Set(orderedIds).size !== orderedIds.length ||
    orderedIds.some((id) => !current.has(id))
  )
    throw new PresenceRuleError('PRESENCE_INVALID_ORDER', ['ids']);
}

/** Ownership/READY checks remain in the Core port; this checks presentation only. */
export function validateMediaReferences(media: readonly PresenceMediaReference[]): void {
  if (
    media.length > 50 ||
    new Set(media.map((m) => m.mediaId)).size !== media.length ||
    media.filter((m) => m.role === 'COVER').length > 1 ||
    media.some(
      (m) =>
        !m.mediaId ||
        !['COVER', 'GALLERY'].includes(m.role) ||
        !m.altText.trim() ||
        m.altText.length > 300 ||
        (m.caption?.length ?? 0) > 1000,
    )
  )
    throw new PresenceRuleError('PRESENCE_INVALID_MEDIA', ['media']);
}

export type SocialProvider = 'WEBSITE' | 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK' | 'YOUTUBE' | 'LINKEDIN';
export function validateSocialUrl(provider: SocialProvider, input: string): string {
  const hosts: Record<SocialProvider, readonly string[]> = {
    WEBSITE: [],
    INSTAGRAM: ['instagram.com'],
    FACEBOOK: ['facebook.com'],
    TIKTOK: ['tiktok.com'],
    YOUTUBE: ['youtube.com', 'youtu.be'],
    LINKEDIN: ['linkedin.com'],
  };
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new PresenceRuleError('PRESENCE_INVALID_URL', ['url']);
  }
  const allowed = hosts[provider];
  if (
    !allowed ||
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    (provider !== 'WEBSITE' &&
      !allowed.some((host) => url.hostname === host || url.hostname === `www.${host}`))
  )
    throw new PresenceRuleError('PRESENCE_INVALID_URL', ['url']);
  // Links are returned to clients, never fetched by the backend (no URL preview/SSRF surface).
  return url.href;
}

function readiness(checks: readonly [PresenceBlocker, boolean][]): PresenceReadiness {
  const missing = checks.filter(([, valid]) => !valid).map(([field]) => field);
  return {
    ready: missing.length === 0,
    missing,
    score: Math.round((100 * (checks.length - missing.length)) / checks.length),
  };
}
function succeeds(check: () => void): boolean {
  try {
    check();
    return true;
  } catch (error) {
    if (error instanceof PresenceRuleError) return false;
    throw error;
  }
}
export function profileReadiness(profile: {
  supplierExists: boolean;
  slug: string;
  description: string;
  categoryActive: boolean;
  logoReady: boolean;
}): PresenceReadiness {
  return readiness([
    ['supplier', profile.supplierExists],
    [
      'slug',
      succeeds(() => {
        normalizeSlug(profile.slug);
      }),
    ],
    ['description', !!profile.description.trim() && profile.description.length <= 4000],
    ['category', profile.categoryActive],
    ['logoMediaId', profile.logoReady],
  ]);
}
export function contentReadiness(
  content: {
    title: string;
    description: string;
    categoryActive: boolean;
    media: readonly PresenceMediaReference[];
    allMediaReady: boolean;
    listing?: Price & OfferWindow;
  },
  now: Date,
): PresenceReadiness {
  const checks: [PresenceBlocker, boolean][] = [
    ['title', !!content.title.trim() && content.title.length <= 160],
    ['description', !!content.description.trim() && content.description.length <= 4000],
    ['category', content.categoryActive],
    [
      'media',
      content.allMediaReady &&
        content.media.some((m) => m.role === 'COVER') &&
        succeeds(() => validateMediaReferences(content.media)),
    ],
  ];
  if (content.listing) {
    const listing = content.listing;
    checks.push(
      ['pricing', succeeds(() => validatePrice(listing))],
      ['offerDates', succeeds(() => validateOfferWindow(listing, now, true))],
    );
  }
  return readiness(checks);
}
