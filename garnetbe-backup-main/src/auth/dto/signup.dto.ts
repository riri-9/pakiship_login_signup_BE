import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SUPPORTED_AUTH_ROLES } from '../auth.constants.js';

export class SignupDto {
  @IsString()
  @IsIn(SUPPORTED_AUTH_ROLES)
  role!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName!: string;

  @IsString()
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: 'dob must use dd/mm/yyyy format.',
  })
  dob!: string;

  @IsString()
  @Matches(/^\d{10,15}$/, {
    message: 'mobile must contain 10 to 15 digits.',
  })
  mobile!: string;

  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  street!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  province!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/\d/, {
    message: 'password must contain at least one number.',
  })
  @Matches(/[^\w\s]/, {
    message: 'password must contain at least one special character.',
  })
  password!: string;
}
