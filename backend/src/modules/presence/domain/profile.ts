/** Presentation data only. Supplier identity is owned by Core. */
export interface Profile {
  supplierId: string;
  slug: string;
  description: string;
  published: boolean;
}
export const validSlug = (value: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
