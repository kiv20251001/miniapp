import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator'

export class CreateChildDto {
  @IsString()
  name!: string

  @IsOptional()
  @IsString()
  avatarKey?: string
}

export class UpdateChildDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  avatarKey?: string
}

export class SelectChildDto {
  @IsString()
  childId!: string
}

export class UpsertCourseDto {
  @IsOptional()
  @IsString()
  id?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  childIds?: string[]

  @IsString()
  title!: string

  @IsString()
  type!: string

  @IsOptional()
  @IsString()
  teacher?: string

  @IsOptional()
  @IsString()
  location?: string

  @IsOptional()
  @IsString()
  icon?: string

  @IsOptional()
  @IsString()
  color?: string

  @IsOptional()
  billingPolicy?: Record<string, unknown>

  @IsOptional()
  @IsBoolean()
  needsBillingReview?: boolean

  @IsOptional()
  @IsString()
  billingMode?: string

  @IsOptional()
  @IsNumber()
  amount?: number

  recurrence!: Record<string, unknown>

  @IsOptional()
  @IsString()
  note?: string
}

export class SyncUpfrontDto {
  @IsIn(['unpaid', 'paid'])
  status!: 'unpaid' | 'paid'
}

export class AddOccurrencesDto {
  @IsArray()
  @IsString({ each: true })
  dates!: string[]
}

export class UpsertExceptionDto {
  @IsOptional()
  @IsString()
  id?: string

  @IsString()
  courseId!: string

  @IsString()
  date!: string

  @IsIn(['cancelled', 'rescheduled', 'added'])
  status!: 'cancelled' | 'rescheduled' | 'added'

  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  startTime?: string

  @IsOptional()
  @IsString()
  endTime?: string

  @IsOptional()
  @IsString()
  location?: string

  @IsOptional()
  @IsString()
  note?: string
}

export class RestoreOccurrenceDto {
  @IsString()
  date!: string

  @IsString()
  startTime!: string

  @IsString()
  endTime!: string
}

export class AttendanceDto {
  @IsIn(['scheduled', 'completed', 'cancelled', 'no_show', 'pending_confirmation'])
  status!: 'scheduled' | 'completed' | 'cancelled' | 'no_show' | 'pending_confirmation'

  @IsOptional()
  @IsBoolean()
  billable?: boolean

  @IsOptional()
  @IsNumber()
  actualMinutes?: number
}

export class OccurrenceExpenseDto {
  @IsNumber()
  @Min(0)
  amount!: number

  @IsBoolean()
  paid!: boolean
}

export class QuickArrangementDto {
  @IsOptional()
  @IsString()
  date?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dates?: string[]

  @IsString()
  title!: string

  @IsString()
  startTime!: string

  @IsString()
  endTime!: string

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number

  @IsIn(['pending', 'unpaid', 'paid', 'void'])
  expenseStatus!: 'pending' | 'unpaid' | 'paid' | 'void'

  @IsOptional()
  @IsString()
  note?: string
}

export class UpsertExpenseDto {
  @IsOptional()
  @IsString()
  id?: string

  @IsString()
  title!: string

  @IsString()
  category!: string

  @IsString()
  billingMode!: string

  @IsNumber()
  amount!: number

  @IsString()
  period!: string

  @IsString()
  dueDate!: string

  @IsString()
  status!: string

  @IsOptional()
  @IsString()
  paidAt?: string

  @IsOptional()
  @IsString()
  note?: string

  @IsOptional()
  @IsString()
  courseId?: string
}

export class GenerateBillsDto {
  @IsString()
  period!: string
}

export class ExpenseStatusDto {
  @IsIn(['pending', 'unpaid', 'paid', 'void'])
  status!: 'pending' | 'unpaid' | 'paid' | 'void'
}

export class RefundDto {
  @IsNumber()
  @Min(0)
  amount!: number

  @IsOptional()
  @IsString()
  note?: string
}
