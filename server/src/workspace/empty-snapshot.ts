import { BILLING_SCHEMA_VERSION, childAvatarOption, createId } from '../domain/constants'
import type { AppSnapshot, ChildAvatarKey } from '../domain/types'

export function createEmptyFamilySnapshot(name = 'Uday', avatarKey?: ChildAvatarKey): AppSnapshot {
  const option = childAvatarOption(avatarKey)
  const childId = createId('child')
  const trimmed = name.trim() || 'Uday'
  return {
    version: 1,
    billingSchemaVersion: BILLING_SCHEMA_VERSION,
    session: { role: 'parent', childId },
    children: [
      {
        id: childId,
        name: trimmed,
        grade: '',
        avatarLabel: trimmed.slice(0, 2),
        avatarColor: option.color,
        avatarKey: option.key,
      },
    ],
    courses: [],
    expenses: [],
    goals: [],
    scheduleExceptions: [],
    occurrenceRecords: [],
    charges: [],
    payments: [],
    billingMigrationAudits: [],
  }
}
