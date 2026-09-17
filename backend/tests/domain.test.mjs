import { test, expect } from '@jest/globals';
import { hasContact } from '../dist/modules/leads/domain/lead.js';
import { validSlug } from '../dist/modules/presence/domain/profile.js';
import { runtime } from '../dist/config/runtime.js';
test('domain rules reject empty contact and unsafe slugs', () => {
  expect(hasContact({ phone: '  ' })).toBe(false);
  expect(hasContact({ email: 'a@example.com' })).toBe(true);
  expect(validSlug('../bad')).toBe(false);
  expect(validSlug('studio-beirut')).toBe(true);
});
test('configuration fails closed for unavailable modules and broad proxy trust', () => {
  expect(() => runtime({ ENABLED_MODULES: 'promotions' })).toThrow();
  expect(() => runtime({ TRUST_PROXY_CIDRS: 'true' })).toThrow();
});
