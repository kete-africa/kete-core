/**
 * A person provisioned by phone (spec 013) has no e-mail: her `email` holds a placeholder under
 * `.invalid` (RFC 2606), which never resolves and is never shown — her number is.
 */
const PLACEHOLDER_DOMAIN = '@phone.kete.invalid';

export function placeholderEmail(phoneNumber: string): string {
  return `p${phoneNumber.slice(1)}${PLACEHOLDER_DOMAIN}`;
}

export function isPlaceholderEmail(email: string): boolean {
  return email.endsWith(PLACEHOLDER_DOMAIN);
}

/** How to show a person's contact: her e-mail, or her number when she has no e-mail. */
export function contactOf(person: { email: string; phoneNumber?: string | null }): string {
  return isPlaceholderEmail(person.email) ? (person.phoneNumber ?? '') : person.email;
}
