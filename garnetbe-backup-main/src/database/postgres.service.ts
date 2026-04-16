import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export interface UserFactUpsertInput {
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: string;
  city: string;
  province: string;
  streetAddress: string;
  termsAcceptedAt: string;
}

@Injectable()
export class PostgresService implements OnModuleDestroy {
  private readonly logger = new Logger(PostgresService.name);
  private pool: Pool | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getPool(): Pool {
    if (this.pool) {
      return this.pool;
    }

    const connectionString = this.configService.get<string>('DATABASE_URL');

    if (!connectionString) {
      throw new ServiceUnavailableException(
        'DATABASE_URL is not configured for direct profile writes.',
      );
    }

    this.pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
    });

    this.pool.on('error', (error: Error) => {
      this.logger.error(`Postgres pool error: ${error.message}`);
    });

    return this.pool;
  }

  async upsertUserFactTable(input: UserFactUpsertInput): Promise<void> {
    const pool = this.getPool();

    await pool.query(
      `
        INSERT INTO public."USER_FACT_TABLE" (
          user_id,
          full_name,
          email,
          phone_number,
          role,
          terms_accepted_at,
          city,
          province,
          street_address,
          is_verified,
          is_online,
          geofence_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, false, false)
        ON CONFLICT (user_id) DO UPDATE
        SET
          full_name = EXCLUDED.full_name,
          email = EXCLUDED.email,
          phone_number = EXCLUDED.phone_number,
          role = EXCLUDED.role,
          terms_accepted_at = EXCLUDED.terms_accepted_at,
          city = EXCLUDED.city,
          province = EXCLUDED.province,
          street_address = EXCLUDED.street_address
      `,
      [
        input.userId,
        input.fullName,
        input.email,
        input.phoneNumber,
        input.role,
        input.termsAcceptedAt,
        input.city,
        input.province,
        input.streetAddress,
      ],
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }
}
