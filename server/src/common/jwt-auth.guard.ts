import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { JwtUser } from './current-user'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest()
    const header = String(request.headers.authorization || '')
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: '请先登录' })
    }
    try {
      request.user = this.jwt.verify<JwtUser>(token)
      return true
    } catch {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: '登录已过期，请重新登录' })
    }
  }
}
