<script setup lang="ts">
import type { DayOccurrence } from '@/domain/types'
import TodayCourseCard from '@/components/TodayCourseCard.vue'
import ChildAvatar from '@/components/ChildAvatar.vue'
import { useAppStore } from '@/stores/app'

type CourseProgress = { completed: number; total: number; percent: number }

const store = useAppStore()

withDefaults(defineProps<{
  title: string
  items: DayOccurrence[]
  progressFor: (item: DayOccurrence) => CourseProgress
  emptyTitle?: string
  emptyDescription?: string
  actionLabel?: string
}>(), {
  emptyTitle: '这一天没有课程',
  emptyDescription: '计划有变化也没关系，好好享受空闲时间。',
  actionLabel: '新增',
})

defineEmits<{
  add: []
  edit: [item: DayOccurrence]
}>()

function participantsFor(item: DayOccurrence) {
  if (store.snapshot.children.length <= 1) return []
  const assigned = item.course.childIds?.length
    ? item.course.childIds
    : [item.course.childId]
  return store.snapshot.children.filter((child) => assigned.includes(child.id))
}
</script>

<template>
  <section class="course-schedule">
    <div class="schedule-head">
      <h2>{{ title }}</h2>
      <button type="button" @click="$emit('add')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        {{ actionLabel }}
      </button>
    </div>

    <TransitionGroup v-if="items.length" name="lesson-list" tag="div" class="lesson-list">
      <div v-for="(item, index) in items" :key="item.id" class="timeline-entry">
        <div
          class="timeline-marker"
          :class="{ last: index === items.length - 1 }"
          :style="{ '--timeline-color': item.course.color }"
        >
          <time>{{ item.exception?.startTime ?? item.course.recurrence.startTime }}</time>
          <i class="timeline-dot" />
          <div
            v-if="participantsFor(item).length"
            class="timeline-participants"
            aria-label="参与孩子"
          >
            <ChildAvatar
              v-for="child in participantsFor(item)"
              :key="child.id"
              :avatar-key="child.avatarKey"
              :size="26"
              :label="child.name"
            />
          </div>
        </div>
        <TodayCourseCard
          :item="item"
          :index="index"
          :progress="progressFor(item)"
          @edit="$emit('edit', $event)"
        />
      </div>
    </TransitionGroup>

    <div v-else class="empty-state">
      <button class="empty-add" type="button" :aria-label="actionLabel" @click="$emit('add')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
      <h3>{{ emptyTitle }}</h3>
      <p>{{ emptyDescription }}</p>
    </div>
  </section>
</template>

<style scoped>
.course-schedule {
  margin-bottom: 28px;
}

.schedule-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 13px;
}

.schedule-head h2 {
  color: var(--ink);
  font-size: 19px;
  letter-spacing: -.025em;
}

.schedule-head > button {
  display: flex;
  min-height: 32px;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  color: var(--accent-text);
  border: 0;
  border-radius: 11px;
  background: var(--accent-soft);
  font-size: 10px;
  font-weight: 750;
}

.schedule-head svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.8;
}

.lesson-list {
  position: relative;
  display: grid;
  gap: 12px;
}

.timeline-entry {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 10px;
  align-items: stretch;
}

.timeline-marker {
  position: relative;
  min-height: 100%;
  padding-top: 16px;
  color: var(--timeline-color);
}

.timeline-marker::after {
  position: absolute;
  z-index: 0;
  top: 35px;
  right: 3px;
  bottom: -18px;
  width: 2px;
  border-radius: 999px;
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--timeline-color) 55%, transparent),
    color-mix(in srgb, var(--timeline-color) 12%, transparent)
  );
  content: "";
}

.timeline-marker.last::after {
  bottom: 20px;
}

.timeline-marker time {
  display: block;
  padding-right: 10px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: -.02em;
}

.timeline-dot {
  position: absolute;
  z-index: 1;
  top: 30px;
  right: 0;
  width: 7px;
  height: 7px;
  border: 2px solid var(--bg);
  border-radius: 50%;
  background: color-mix(in srgb, var(--timeline-color) 65%, #687087);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--timeline-color) 35%, transparent);
}

.timeline-participants {
  position: absolute;
  z-index: 2;
  top: 46px;
  right: -9px;
  display: grid;
  gap: 5px;
}

.timeline-participants :deep(.child-face) {
  border: 2px solid var(--bg);
  box-shadow: 0 5px 12px -5px color-mix(in srgb, var(--avatar-color) 72%, transparent);
}

.lesson-list-leave-active {
  position: absolute;
  width: 100%;
}

.lesson-list-leave-to {
  opacity: 0;
  transform: translateX(-28px) scale(.96);
}

.lesson-list-move,
.lesson-list-leave-active {
  transition: all .35s cubic-bezier(.2,.8,.2,1);
}

.empty-state {
  padding: 28px 20px 24px;
  text-align: center;
  border: 0;
  border-radius: 24px;
  background: var(--paper);
  box-shadow: var(--elev-md), var(--glow-top);
}

.empty-state h3 { font-size: 17px; }
.empty-state p { margin: 8px 0 0; color: var(--muted); font-size: 12px; }

.empty-add {
  display: grid;
  width: 56px;
  height: 56px;
  margin: 0 auto 12px;
  padding: 0;
  place-items: center;
  color: var(--accent-text);
  border: 1.5px dashed color-mix(in srgb, var(--accent) 42%, var(--line));
  border-radius: 14px;
  background: color-mix(in srgb, var(--accent-soft) 70%, transparent);
}

.empty-add:active {
  transform: scale(.96);
}

.empty-add svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 2;
}
</style>
