export type LeadInput = {
  name: string;
  email?: string;
  phone?: string;
  message: string;
  source: string;
  campaign?: string;
  contactConsent: boolean;
  contactConsentVersion: string;
};
export function hasContact(input: Pick<LeadInput, 'email' | 'phone'>) {
  return Boolean(input.email?.trim() || input.phone?.trim());
}
