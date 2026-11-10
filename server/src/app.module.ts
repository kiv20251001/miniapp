import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { AuthController } from './auth/auth.controller'
import { AuthService } from './auth/auth.service'
import { FamiliesController } from './families/families.controller'
import { FamiliesService } from './families/families.service'
import { WorkspaceController } from './families/workspace.controller'
import { HealthController } from './health.controller'
import { PrismaService } from './prisma.service'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'dev-myhome-local-secret',
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [HealthController, AuthController, FamiliesController, WorkspaceController],
  providers: [PrismaService, AuthService, FamiliesService],
})
export class AppModule {}
