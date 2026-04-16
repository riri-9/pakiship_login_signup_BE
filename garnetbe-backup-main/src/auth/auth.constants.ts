export const SUPPORTED_AUTH_ROLES = [
  'parcel_sender',
  'driver',
  'operator',
] as const;

export type SupportedAuthRole = (typeof SUPPORTED_AUTH_ROLES)[number];
