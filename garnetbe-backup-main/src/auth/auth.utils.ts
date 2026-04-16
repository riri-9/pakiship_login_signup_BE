import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import {
  SUPPORTED_AUTH_ROLES,
  type SupportedAuthRole,
} from './auth.constants.js';
import type { AuthUserResponse, AuthUserMetadata } from './auth.types.js';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');

  if (digits.startsWith('63') && digits.length === 12) {
    return digits.slice(2);
  }

  if (digits.startsWith('0') && digits.length === 11) {
    return digits.slice(1);
  }

  return digits;
}

export function normalizeIdentifier(identifier: string): string {
  const trimmed = identifier.trim();
  return trimmed.includes('@') ? normalizeEmail(trimmed) : normalizeMobile(trimmed);
}

export function assertSupportedRole(role: string): SupportedAuthRole {
  if (
    (SUPPORTED_AUTH_ROLES as readonly string[]).includes(role) === false
  ) {
    throw new BadRequestException('Unsupported user role.');
  }

  return role as SupportedAuthRole;
}

export function getUserMetadata(user: User): AuthUserMetadata {
  return (user.user_metadata ?? {}) as AuthUserMetadata;
}

export function mapUserToAuthResponse(user: User): AuthUserResponse {
  const metadata = getUserMetadata(user);
  const fullName = metadata.fullName ?? metadata.full_name;
  const role = metadata.role;

  if (!user.email || !fullName || !role) {
    throw new UnauthorizedException(
      'Your account is missing required profile details.',
    );
  }

  return {
    id: user.id,
    email: normalizeEmail(user.email),
    fullName,
    role: assertSupportedRole(role),
  };
}
