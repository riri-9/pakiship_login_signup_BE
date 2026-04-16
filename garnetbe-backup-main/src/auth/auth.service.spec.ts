import {
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { PostgresService } from '../database/postgres.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';

type MockUser = {
  id: string;
  email: string;
  user_metadata: {
    fullName: string;
    role: 'parcel_sender' | 'driver' | 'operator';
    mobile: string;
  };
};

const makeUser = (overrides?: Partial<MockUser>): MockUser => ({
  id: 'user-1',
  email: 'user@example.com',
  user_metadata: {
    fullName: 'Juan Dela Cruz',
    role: 'parcel_sender',
    mobile: '9123456789',
  },
  ...overrides,
});

describe('AuthService', () => {
  const adminListUsers = jest.fn();
  const signUp = jest.fn();
  const signInWithPassword = jest.fn();
  const signOut = jest.fn();
  const resetPasswordForEmail = jest.fn();
  const upsertUserFactTable = jest.fn();

  async function createService(): Promise<AuthService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: SupabaseService,
          useValue: {
            getAdminClient: jest.fn().mockReturnValue({
              auth: {
                admin: {
                  listUsers: adminListUsers,
                },
              },
            }),
            getAuthClient: jest.fn().mockReturnValue({
              auth: {
                signUp,
                signInWithPassword,
                signOut,
                resetPasswordForEmail,
              },
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) =>
              key === 'SUPABASE_PASSWORD_RESET_REDIRECT_URL'
                ? 'pakiship://reset-password'
                : undefined,
            ),
          },
        },
        {
          provide: PostgresService,
          useValue: {
            upsertUserFactTable,
          },
        },
      ],
    }).compile();

    return module.get<AuthService>(AuthService);
  }

  beforeEach(() => {
    adminListUsers.mockReset();
    signUp.mockReset();
    signInWithPassword.mockReset();
    signOut.mockReset();
    resetPasswordForEmail.mockReset();
    upsertUserFactTable.mockReset();
  });

  it('signs up a new user', async () => {
    const service = await createService();

    signUp.mockResolvedValue({
      data: { user: makeUser() },
      error: null,
    });
    upsertUserFactTable.mockResolvedValue(undefined);

    const result = await service.signup({
      role: 'parcel_sender',
      fullName: 'Juan Dela Cruz',
      dob: '01/01/2000',
      mobile: '9123456789',
      email: 'USER@EXAMPLE.COM',
      street: '123 Mabini St',
      city: 'Quezon City',
      province: 'Metro Manila',
      password: 'Password!1',
    });

    expect(result.message).toBe('Account created successfully.');
    expect(result.user.email).toBe('user@example.com');
    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        options: expect.objectContaining({
          data: expect.objectContaining({
            full_name: 'Juan Dela Cruz',
            phone_number: '9123456789',
            street_address: '123 Mabini St',
            terms_accepted_at: expect.any(String),
          }),
        }),
      }),
    );
    expect(upsertUserFactTable).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        role: 'parcel_sender',
        phoneNumber: '9123456789',
      }),
    );
  });

  it('rejects signup when email already exists', async () => {
    const service = await createService();

    signUp.mockResolvedValue({
      data: { user: null },
      error: { message: 'User already registered' },
    });

    await expect(
      service.signup({
        role: 'parcel_sender',
        fullName: 'Juan Dela Cruz',
        dob: '01/01/2000',
        mobile: '9123456789',
        email: 'user@example.com',
        street: '123 Mabini St',
        city: 'Quezon City',
        province: 'Metro Manila',
        password: 'Password!1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with a mobile number by resolving the account email first', async () => {
    const service = await createService();

    adminListUsers.mockResolvedValue({
      data: { users: [makeUser()] },
      error: null,
    });
    signInWithPassword.mockResolvedValue({
      data: { user: makeUser() },
      error: null,
    });
    signOut.mockResolvedValue({ error: null });

    const result = await service.login({
      emailOrMobile: '0912-345-6789',
      password: 'Password!1',
    });

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'Password!1',
    });
    expect(result.user.role).toBe('parcel_sender');
  });

  it('rejects invalid credentials', async () => {
    const service = await createService();

    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    });

    await expect(
      service.login({
        emailOrMobile: 'user@example.com',
        password: 'Password!1',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('requests a password reset email', async () => {
    const service = await createService();

    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    const result = await service.forgotPassword({
      email: 'USER@EXAMPLE.COM',
    });

    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      'user@example.com',
      expect.objectContaining({
        redirectTo: 'pakiship://reset-password',
      }),
    );
    expect(result.message).toContain('reset link');
  });

  it('still succeeds when profile upsert fails', async () => {
    const service = await createService();

    signUp.mockResolvedValue({
      data: { user: makeUser() },
      error: null,
    });
    upsertUserFactTable.mockRejectedValue(new Error('db write failed'));

    const result = await service.signup({
      role: 'operator',
      fullName: 'Juan Dela Cruz',
      dob: '01/01/2000',
      mobile: '9123456789',
      email: 'user@example.com',
      street: '123 Mabini St',
      city: 'Quezon City',
      province: 'Metro Manila',
      password: 'Password!1',
    });

    expect(result.message).toBe('Account created successfully.');
  });
});
