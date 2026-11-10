import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export interface JwtUser {
  sub: string
  familyId: string
  role: 'parent' | 'child'
  username: string
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): JwtUser => {
  return ctx.switchToHttp().getRequest().user
})
