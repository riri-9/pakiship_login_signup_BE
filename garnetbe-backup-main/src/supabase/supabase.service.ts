import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const PING_TIMEOUT_MS = 3_000;

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private adminClient: SupabaseClient | null = null;
  private authClient: SupabaseClient | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const url = this.configService.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    const anonKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!url || !serviceRoleKey) {
      this.logger.warn(
        'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. ' +
          'Admin Supabase client will not be available.',
      );
    } else {
      this.adminClient = createClient(url, serviceRoleKey, {
        auth: {
          // Service-role key must not persist sessions
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }

    if (!url || !anonKey) {
      this.logger.warn(
        'SUPABASE_URL or SUPABASE_ANON_KEY is not set. ' +
          'User auth flows will not be available.',
      );
    } else {
      this.authClient = createClient(url, anonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
  }

  getClient(): SupabaseClient | null {
    return this.adminClient;
  }

  getAdminClient(): SupabaseClient | null {
    return this.adminClient;
  }

  getAuthClient(): SupabaseClient | null {
    return this.authClient;
  }

  async ping(): Promise<boolean> {
    if (this.adminClient === null) {
      return false;
    }

    const attempt = async (): Promise<boolean> => {
      try {
        // Lightweight existence check — list zero users from the auth admin API.
        // This round-trips to the Supabase project without touching any
        // application table and works on any freshly created project.
        const { error } = await (
          this.adminClient as SupabaseClient
        ).auth.admin.listUsers({
          page: 1,
          perPage: 1,
        });
        return error === null;
      } catch {
        return false;
      }
    };

    let timerId: ReturnType<typeof setTimeout>;
    const timeout = new Promise<boolean>((resolve) => {
      timerId = setTimeout(() => resolve(false), PING_TIMEOUT_MS);
    });

    return Promise.race([attempt(), timeout]).finally(() => {
      // Clear the timer regardless of which promise won so the handle is
      // released and Node / Jest can exit cleanly without open-handle warnings.
      clearTimeout(timerId);
    });
  }
}
