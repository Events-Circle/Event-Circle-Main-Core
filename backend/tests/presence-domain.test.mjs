import { test, expect } from '@jest/globals';
import {
  normalizeSlug,
  validatePrice,
  validateOfferWindow,
  isPublicContent,
  transition,
  validateOrder,
  validateMediaReferences,
  validateSocialUrl,
  profileReadiness,
  contentReadiness,
} from '../dist/modules/presence/domain/rules.js';
import { eventNames, presenceEventNames } from '@events-circle/contracts';

const now = new Date('2026-09-17T12:00:00Z');
const future = new Date('2026-09-18T12:00:00Z');
const past = new Date('2026-09-16T12:00:00Z');
const media = [{ mediaId: 'media-a', role: 'COVER', altText: 'Reception at sunset' }];

test('slugs normalize case/space but reject reserved names, invalid lengths and URL-like input', () => {
  expect(normalizeSlug(' Studio-Beirut ')).toBe('studio-beirut');
  for (const slug of ['ab', 'a'.repeat(81), 'ADMIN', '../studio', 'studio--one', 'a_b', 'studio/', 'évents'])
    expect(() => normalizeSlug(slug)).toThrow('PRESENCE_INVALID_SLUG');
  expect(normalizeSlug('a'.repeat(80))).toHaveLength(80);
});

test('money requires positive safe integer minor units and a supported currency for priced modes', () => {
  for (const pricingMode of ['FIXED', 'FROM']) {
    expect(() => validatePrice({ pricingMode, amountMinor: 100, currency: 'USD' })).not.toThrow();
    for (const amountMinor of [undefined, null, 0, -1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])
      expect(() => validatePrice({ pricingMode, amountMinor, currency: 'USD' })).toThrow(
        'PRESENCE_INVALID_PRICE',
      );
    for (const currency of [undefined, 'usd', 'ZZZ', 'US'])
      expect(() => validatePrice({ pricingMode, amountMinor: 100, currency })).toThrow(
        'PRESENCE_INVALID_PRICE',
      );
  }
  for (const pricingMode of ['FREE', 'ON_REQUEST']) {
    expect(() => validatePrice({ pricingMode })).not.toThrow();
    expect(() => validatePrice({ pricingMode, amountMinor: 0 })).toThrow();
    expect(() => validatePrice({ pricingMode, currency: 'USD' })).toThrow();
  }
  expect(() => validatePrice({ pricingMode: 'UNKNOWN' })).toThrow();
});

test('offer windows validate ordering and enforce exact expiry without deleting history', () => {
  expect(() => validateOfferWindow({ type: 'UNKNOWN' }, now)).toThrow('PRESENCE_INVALID_LISTING_TYPE');
  expect(() => validateOfferWindow({ type: 'SERVICE' }, new Date('invalid'))).toThrow(
    'PRESENCE_INVALID_TIME',
  );
  expect(() =>
    validateOfferWindow({ type: 'OFFER', validFrom: past, validUntil: future }, now, true),
  ).not.toThrow();
  expect(() => validateOfferWindow({ type: 'OFFER', validUntil: past }, now)).not.toThrow();
  for (const window of [
    { type: 'OFFER', validFrom: future, validUntil: past },
    { type: 'OFFER', validFrom: now, validUntil: now },
    { type: 'OFFER', validUntil: now },
    { type: 'OFFER', validUntil: new Date('invalid') },
    { type: 'PRODUCT', validFrom: past },
  ])
    expect(() => validateOfferWindow(window, now, true)).toThrow('PRESENCE_INVALID_OFFER_DATES');
});

test('public status/validity matrix hides all private parents and children, future and expired offers', () => {
  for (const parent of ['DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED'])
    for (const child of ['DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED'])
      expect(isPublicContent(parent, child, { type: 'SERVICE' }, now)).toBe(
        parent === 'PUBLISHED' && child === 'PUBLISHED',
      );
  for (const window of [
    { type: 'OFFER', validUntil: now },
    { type: 'OFFER', validFrom: future },
    { type: 'OFFER', validUntil: new Date('invalid') },
  ])
    expect(isPublicContent('PUBLISHED', 'PUBLISHED', window, now)).toBe(false);
  expect(
    isPublicContent('PUBLISHED', 'PUBLISHED', { type: 'OFFER', validFrom: now, validUntil: future }, now),
  ).toBe(true);
});

test('lifecycle supports idempotent requests and restoring an archive never republishes it', () => {
  expect(transition('DRAFT', 'PUBLISH')).toEqual({ status: 'PUBLISHED', changed: true });
  expect(transition('PUBLISHED', 'PUBLISH')).toEqual({ status: 'PUBLISHED', changed: false });
  expect(transition('PUBLISHED', 'UNPUBLISH')).toEqual({ status: 'UNPUBLISHED', changed: true });
  expect(transition('UNPUBLISHED', 'UNPUBLISH').changed).toBe(false);
  expect(transition('ARCHIVED', 'RESTORE')).toEqual({ status: 'DRAFT', changed: true });
  expect(transition('ARCHIVED', 'ARCHIVE').changed).toBe(false);
  expect(() => transition('ARCHIVED', 'PUBLISH')).toThrow('PRESENCE_INVALID_TRANSITION');
  expect(() => transition('PUBLISHED', 'RESTORE')).toThrow();
  expect(() => transition('DRAFT', 'UNPUBLISH')).toThrow();
});

test('reorder requires an exact tenant-scoped permutation, rejecting duplicate, missing and foreign IDs', () => {
  expect(() => validateOrder(['a', 'b'], ['b', 'a'])).not.toThrow();
  expect(() => validateOrder([], [])).not.toThrow();
  for (const order of [['a'], ['a', 'a'], ['a', 'foreign'], ['a', 'b', 'foreign']])
    expect(() => validateOrder(['a', 'b'], order)).toThrow('PRESENCE_INVALID_ORDER');
  expect(() => validateOrder(['a', 'a'], ['a', 'a'])).toThrow();
});

test('media presentation rejects duplicate IDs, multiple covers, missing alt text and oversized collections', () => {
  expect(() => validateMediaReferences(media)).not.toThrow();
  for (const refs of [
    [media[0], media[0]],
    [media[0], { ...media[0], mediaId: 'media-b' }],
    [{ ...media[0], altText: '  ' }],
    [{ ...media[0], altText: 'a'.repeat(301) }],
    [{ ...media[0], caption: 'a'.repeat(1001) }],
    [{ ...media[0], role: 'UNKNOWN' }],
    Array.from({ length: 51 }, (_, id) => ({ mediaId: String(id), role: 'GALLERY', altText: 'Photo' })),
  ])
    expect(() => validateMediaReferences(refs)).toThrow('PRESENCE_INVALID_MEDIA');
});

test('social links require HTTPS and exact known provider hosts without credentials', () => {
  expect(validateSocialUrl('INSTAGRAM', 'https://www.instagram.com/studio')).toBe(
    'https://www.instagram.com/studio',
  );
  expect(validateSocialUrl('WEBSITE', 'https://example.com')).toBe('https://example.com/');
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,hello',
    'http://instagram.com',
    'https://instagram.com.evil.test',
    'https://instagram.com@evil.test',
    'https://user:secret@instagram.com',
    'https://instagram.com:8080',
    '//instagram.com',
  ])
    expect(() => validateSocialUrl('INSTAGRAM', url)).toThrow('PRESENCE_INVALID_URL');
});

test('profile readiness returns deterministic blockers and requires independently verified Core facts', () => {
  const profile = {
    supplierExists: true,
    slug: 'studio-one',
    description: 'Professional events',
    categoryActive: true,
    logoReady: true,
  };
  expect(profileReadiness(profile)).toEqual({ ready: true, missing: [], score: 100 });
  expect(profileReadiness({ ...profile, logoReady: false, description: ' ' })).toEqual({
    ready: false,
    missing: ['description', 'logoMediaId'],
    score: 60,
  });
  expect(profileReadiness({ ...profile, supplierExists: false, categoryActive: false }).missing).toEqual([
    'supplier',
    'category',
  ]);
});

test('content readiness requires a processed cover and reports price/date failures separately', () => {
  const project = {
    title: 'Garden wedding',
    description: 'An outdoor ceremony',
    categoryActive: true,
    media,
    allMediaReady: true,
  };
  expect(contentReadiness(project, now).ready).toBe(true);
  expect(contentReadiness({ ...project, allMediaReady: false }, now).missing).toEqual(['media']);
  expect(contentReadiness({ ...project, media: [{ ...media[0], role: 'GALLERY' }] }, now).missing).toEqual([
    'media',
  ]);
  expect(
    contentReadiness(
      { ...project, listing: { type: 'OFFER', pricingMode: 'FIXED', amountMinor: -1, validUntil: now } },
      now,
    ).missing,
  ).toEqual(['pricing', 'offerDates']);
});

test('existing profile-updated event name stays compatible and new event names are unique and versioned', () => {
  expect(presenceEventNames.updated).toBe(eventNames.presenceUpdated);
  const names = Object.values(presenceEventNames);
  expect(new Set(names).size).toBe(names.length);
  for (const name of names) expect(name).toMatch(/^presence\.[a-z]+\.[a-z]+\.v1$/);
});
