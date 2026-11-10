import { IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator'

export class RegisterDto {
  @IsString()
  @Length(3, 32)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: '账号只能使用字母、数字和下划线' })
  username!: string

  @IsString()
  @MinLength(6)
  @MaxLength(64)
  password!: string

  @IsOptional()
  @IsString()
  @MaxLength(32)
  name?: string
}

export class LoginDto {
  @IsString()
  username!: string

  @IsString()
  password!: string
}
