import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  emailOrMobile!: string;

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
