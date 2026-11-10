import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { CurrentUser, JwtUser } from '../common/current-user'
import { JwtAuthGuard } from '../common/jwt-auth.guard'
import { FamiliesService } from './families.service'

@Controller('families')
@UseGuards(JwtAuthGuard)
export class FamiliesController {
  constructor(private readonly families: FamiliesService) {}

  @Get('current')
  current(@CurrentUser() user: JwtUser) {
    return this.families.getCurrent(user)
  }

  @Get('current/snapshot')
  snapshot(
    @CurrentUser() user: JwtUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.families.getSnapshot(user, from, to)
  }
}
