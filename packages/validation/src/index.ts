export const supplierSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const validTimeZone = (value: string) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};
