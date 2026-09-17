export function formatMoney(minorUnits: number, currency: string, locale = 'en') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minorUnits / 100);
}
