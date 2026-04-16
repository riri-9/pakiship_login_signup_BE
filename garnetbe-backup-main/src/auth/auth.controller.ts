import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { SignupDto } from './dto/signup.dto.js';
import type { AuthResponse } from './auth.types.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  signup(@Body() dto: SignupDto): Promise<AuthResponse> {
    return this.authService.signup(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @Post('forgot-password')
  forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.forgotPassword(dto);
  }
}
