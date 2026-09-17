import { Transform } from 'class-transformer';
/** Preserve non-string values so validators can reject them instead of coercing input. */
export const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
