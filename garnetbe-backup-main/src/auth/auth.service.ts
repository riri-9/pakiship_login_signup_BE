import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { PostgresService } from '../database/postgres.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { SignupDto } from './dto/signup.dto.js';
import type { AuthResponse, SignupMetadata } from './auth.types.js';
import {
  assertSupportedRole,
  mapUserToAuthResponse,
  normalizeEmail,
  normalizeIdentifier,
  normalizeMobile,
} from './auth.utils.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    private readonly postgresService: PostgresService,
  ) {}

  async signup(dto: SignupDto): Promise<AuthResponse> {
    const authClient = this.requireAuthClient();
    const email = normalizeEmail(dto.email);
    const mobile = normalizeMobile(dto.mobile);
    const role = assertSupportedRole(dto.role);
    const fullName = dto.fullName.trim();
    const street = dto.street.trim();
    const city = dto.city.trim();
    const province = dto.province.trim();
    const termsAcceptedAt = new Date().toISOString();

    const metadata: SignupMetadata = {
      fullName,
      role,
      dob: dto.dob,
      mobile,
      street,
      city,
      province,
    };

    const { data, error } = await authClient.auth.signUp({
      email,
      password: dto.password,
      options: {
        data: {
          ...metadata,
          full_name: fullName,
          phone_number: mobile,
          street_address: street,
          terms_accepted_at: termsAcceptedAt,
          is_verified: false,
          is_online: false,
          geofence_active: false,
        },
      },
    });

    if (error) {
      if (this.isDuplicateSupabaseError(error.message)) {
        throw new ConflictException(
          'An account with that email or mobile number already exists.',
        );
      }

      throw new InternalServerErrorException(
        'Unable to create your account right now.',
      );
    }

    if (!data.user) {
      throw new InternalServerErrorException(
        'Unable to create your account right now.',
      );
    }

    try {
      await this.postgresService.upsertUserFactTable({
        userId: data.user.id,
        fullName,
        email,
        phoneNumber: mobile,
        role,
        city,
        province,
        streetAddress: street,
        termsAcceptedAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Profile upsert skipped for auth user ${data.user.id}: ${message}`,
      );
    }

    return {
      message: 'Account created successfully.',
      user: mapUserToAuthResponse(data.user),
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const authClient = this.requireAuthClient();
    const adminClient = this.requireAdminClient();
    const identifier = normalizeIdentifier(dto.emailOrMobile);

    const email =
      identifier.includes('@')
        ? identifier
        : await this.findEmailByMobile(adminClient, identifier);

    const { data, error } = await authClient.auth.signInWithPassword({
      email,
      password: dto.password,
    });

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid email/mobile number or password.');
    }

    await authClient.auth.signOut();

    return {
      message: 'Login successful.',
      user: mapUserToAuthResponse(data.user),
    };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const authClient = this.requireAuthClient();
    const email = normalizeEmail(dto.email);
    const redirectTo = this.configService.get<string>(
      'SUPABASE_PASSWORD_RESET_REDIRECT_URL',
    );
    const options = redirectTo ? { redirectTo } : undefined;

    const { error } = await authClient.auth.resetPasswordForEmail(
      email,
      options,
    );

    if (error) {
      throw new InternalServerErrorException(
        'Unable to send reset link right now.',
      );
    }

    return {
      message:
        'If an account exists for that email, a reset link has been sent.',
    };
  }

  private requireAdminClient(): SupabaseClient {
    const client = this.supabaseService.getAdminClient();

    if (!client) {
      throw new ServiceUnavailableException(
        'Supabase admin connection is not configured.',
      );
    }

    return client;
  }

  private requireAuthClient(): SupabaseClient {
    const client = this.supabaseService.getAuthClient();

    if (!client) {
      throw new ServiceUnavailableException(
        'Supabase auth connection is not configured.',
      );
    }

    return client;
  }

  private async assertUserDoesNotExist(
    adminClient: SupabaseClient,
    email: string,
    mobile: string,
  ): Promise<void> {
    const existingUser = await this.findUserByEmailOrMobile(
      adminClient,
      email,
      mobile,
    );

    if (existingUser) {
      throw new ConflictException(
        'An account with that email or mobile number already exists.',
      );
    }
  }

  private async findEmailByMobile(
    adminClient: SupabaseClient,
    mobile: string,
  ): Promise<string> {
    const user = await this.findUserByEmailOrMobile(adminClient, undefined, mobile);

    if (!user?.email) {
      throw new UnauthorizedException('Invalid email/mobile number or password.');
    }

    return normalizeEmail(user.email);
  }

  private async findUserByEmailOrMobile(
    adminClient: SupabaseClient,
    email?: string,
    mobile?: string,
  ): Promise<User | null> {
    let page = 1;

    while (page <= 20) {
      const { data, error } = await adminClient.auth.admin.listUsers({
        page,
        perPage: 200,
      });

      if (error) {
        throw new InternalServerErrorException(
          'Unable to validate your account details right now.',
        );
      }

      const users = data.users;

      if (users.length === 0) {
        return null;
      }

      const match =
        users.find((user) => {
          const metadata = user.user_metadata as Record<string, unknown> | null;
          const metadataMobile =
            typeof metadata?.['mobile'] === 'string'
              ? metadata['mobile']
              : typeof metadata?.['phone_number'] === 'string'
                ? metadata['phone_number']
                : '';
          const sameEmail =
            typeof email === 'string' &&
            typeof user.email === 'string' &&
            normalizeEmail(user.email) === email;
          const sameMobile =
            typeof mobile === 'string' && normalizeMobile(metadataMobile) === mobile;

          return sameEmail || sameMobile;
        }) ?? null;

      if (match) {
        return match;
      }

      if (users.length < 200) {
        return null;
      }

      page += 1;
    }

    return null;
  }

  private isDuplicateSupabaseError(message: string): boolean {
    const lowered = message.toLowerCase();
    return (
      lowered.includes('already') ||
      lowered.includes('duplicate') ||
      lowered.includes('unique') ||
      lowered.includes('violates unique constraint')
    );
  }
}
