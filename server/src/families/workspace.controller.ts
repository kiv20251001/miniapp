import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common'
import { CurrentUser, JwtUser } from '../common/current-user'
import { JwtAuthGuard } from '../common/jwt-auth.guard'
import type { Expense } from '../domain/types'
import { FamiliesService } from './families.service'
import {
  AddOccurrencesDto,
  AttendanceDto,
  CreateChildDto,
  ExpenseStatusDto,
  GenerateBillsDto,
  OccurrenceExpenseDto,
  QuickArrangementDto,
  RefundDto,
  RestoreOccurrenceDto,
  SelectChildDto,
  SyncUpfrontDto,
  UpdateChildDto,
  UpsertCourseDto,
  UpsertExceptionDto,
  UpsertExpenseDto,
} from './workspace.dto'

@Controller()
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(private readonly families: FamiliesService) {}

  @Post('children')
  addChild(@CurrentUser() user: JwtUser, @Body() dto: CreateChildDto) {
    return this.families.addChild(user, dto.name, dto.avatarKey)
  }

  @Patch('children/:id')
  updateChild(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateChildDto) {
    return this.families.updateChild(user, id, dto)
  }

  @Delete('children/:id')
  removeChild(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.families.removeChild(user, id)
  }

  @Post('me/current-child')
  selectChild(@CurrentUser() user: JwtUser, @Body() dto: SelectChildDto) {
    return this.families.selectChild(user, dto.childId)
  }

  @Post('courses')
  upsertCourse(@CurrentUser() user: JwtUser, @Body() dto: UpsertCourseDto) {
    return this.families.upsertCourse(user, dto as unknown as Parameters<FamiliesService['upsertCourse']>[1])
  }

  @Post('courses/:id/archive')
  archiveCourse(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.families.archiveCourse(user, id)
  }

  @Post('courses/:id/restore')
  restoreCourse(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.families.restoreCourse(user, id)
  }

  @Delete('courses/:id')
  removeCourse(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.families.removeCourse(user, id)
  }

  @Post('courses/:id/upfront')
  syncUpfront(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: SyncUpfrontDto) {
    return this.families.syncCourseUpfrontExpense(user, id, dto.status)
  }

  @Delete('courses/:id/exceptions')
  clearExceptions(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.families.clearScheduleExceptionsForCourse(user, id)
  }

  @Post('courses/:id/occurrences')
  addOccurrences(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: AddOccurrencesDto) {
    return this.families.addPresetOccurrence(user, id, dto.dates)
  }

  @Put('exceptions')
  upsertException(@CurrentUser() user: JwtUser, @Body() dto: UpsertExceptionDto) {
    return this.families.upsertScheduleException(user, dto)
  }

  @Post('occurrences/:courseId/restore')
  restoreOccurrence(
    @CurrentUser() user: JwtUser,
    @Param('courseId') courseId: string,
    @Body() dto: RestoreOccurrenceDto,
  ) {
    return this.families.restoreOccurrenceSlot(user, courseId, dto)
  }

  @Delete('occurrences/:courseId/:date')
  dropOccurrence(
    @CurrentUser() user: JwtUser,
    @Param('courseId') courseId: string,
    @Param('date') date: string,
  ) {
    return this.families.dropOccurrenceSlot(user, courseId, date)
  }

  @Patch('occurrences/:courseId/:date/attendance')
  attendance(
    @CurrentUser() user: JwtUser,
    @Param('courseId') courseId: string,
    @Param('date') date: string,
    @Body() dto: AttendanceDto,
  ) {
    return this.families.setOccurrenceAttendance(user, courseId, date, dto.status, {
      billable: dto.billable,
      actualMinutes: dto.actualMinutes,
    })
  }

  @Patch('occurrences/:courseId/:date/expense')
  occurrenceExpense(
    @CurrentUser() user: JwtUser,
    @Param('courseId') courseId: string,
    @Param('date') date: string,
    @Body() dto: OccurrenceExpenseDto,
  ) {
    return this.families.upsertOccurrenceExpense(user, courseId, date, dto)
  }

  @Post('quick-arrangements')
  quickArrangement(@CurrentUser() user: JwtUser, @Body() dto: QuickArrangementDto) {
    return this.families.createQuickArrangement(user, dto)
  }

  @Post('bills')
  upsertExpense(@CurrentUser() user: JwtUser, @Body() dto: UpsertExpenseDto) {
    return this.families.upsertExpense(user, dto as unknown as Omit<Expense, 'id' | 'childId'> & { id?: string })
  }

  @Post('bills/generate')
  generate(@CurrentUser() user: JwtUser, @Body() dto: GenerateBillsDto) {
    return this.families.generateBillingStatements(user, dto.period)
  }

  @Post('bills/:id/status')
  setStatus(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: ExpenseStatusDto) {
    return this.families.setExpenseStatus(user, id, dto.status)
  }

  @Post('bills/:id/refunds')
  refund(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: RefundDto) {
    return this.families.refundExpense(user, id, dto.amount, dto.note)
  }

  @Delete('bills/:id')
  removeExpense(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.families.removeExpense(user, id)
  }
}
