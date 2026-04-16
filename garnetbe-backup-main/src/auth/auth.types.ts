import type { SupportedAuthRole } from './auth.constants.js';

export interface AuthUserResponse {
  id: string;
  email: string;
  fullName: string;
  role: SupportedAuthRole;
}

export interface AuthResponse {
  message: string;
  user: AuthUserResponse;
}

export interface SignupMetadata {
  fullName: string;
  role: SupportedAuthRole;
  dob: string;
  mobile: string;
  street: string;
  city: string;
  province: string;
}

export interface AuthUserMetadata extends Partial<SignupMetadata> {
  full_name?: string;
}
