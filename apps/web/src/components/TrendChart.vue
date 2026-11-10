<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  title: string
  caption: string
  points: Array<{ label: string; value: number }>
  color: string
  valueFormatter: (value: number) => string
}>()

const maxValue = computed(() => Math.max(1, ...props.points.map((item) => item.value)))
const total = computed(() => props.points.reduce((sum, item) => sum + item.value, 0))
const coordinates = computed(() =>
  props.points.map((item, index) => {
    const x = props.points.length <= 1 ? 160 : 12 + (index / (props.points.length - 1)) * 296
    const y = 96 - (item.value / maxValue.value) * 72
    return { ...item, x, y }
  }),
)
const gradientId = `trend-${props.title.replace(/\W/g, '')}`
const areaGradientId = `${gradientId}-area`
const seriesLight = computed(() => `color-mix(in srgb, ${props.color} 52%, #ffcf8a)`)

function roundedPath(points: typeof coordinates.value) {
  if (!points.length) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`

  return points.reduce((path, point, index) => {
    if (!index) return `M ${point.x} ${point.y}`
    const previous = points[index - 1]
    const beforePrevious = points[index - 2] ?? previous
    const next = points[index + 1] ?? point
    const smoothing = .18
    const cp1x = previous.x + (point.x - beforePrevious.x) * smoothing
    const cp1y = previous.y + (point.y - beforePrevious.y) * smoothing
    const cp2x = point.x - (next.x - previous.x) * smoothing
    const cp2y = point.y - (next.y - previous.y) * smoothing
    return `${path} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${point.x} ${point.y}`
  }, '')
}

const linePath = computed(() => roundedPath(coordinates.value))
const areaPath = computed(() =>
  coordinates.value.length ? `${linePath.value} L 308 104 L 12 104 Z` : '',
)
const labelIndexes = computed(() => {
  if (!props.points.length) return []
  const step = Math.max(1, Math.ceil(props.points.length / 6))
  const indexes = props.points.map((_, index) => index).filter((index) => index % step === 0)
  if (indexes.at(-1) !== props.points.length - 1) indexes.push(props.points.length - 1)
  return indexes
})
</script>

<template>
  <section class="trend-card" :style="{ '--series-color': color }">
    <header>
      <div>
        <h2>{{ title }}</h2>
        <p>{{ caption }}</p>
      </div>
      <strong>{{ valueFormatter(total) }}</strong>
    </header>
    <div class="plot">
      <svg viewBox="0 0 320 128" role="img" :aria-label="`${title}走势图`">
        <defs>
          <linearGradient :id="gradientId" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" :stop-color="seriesLight" />
            <stop offset="55%" :stop-color="color" />
            <stop offset="100%" :stop-color="seriesLight" />
          </linearGradient>
          <linearGradient :id="areaGradientId" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" :stop-color="color" stop-opacity=".22" />
            <stop offset="100%" :stop-color="color" stop-opacity=".015" />
          </linearGradient>
        </defs>
        <line v-for="y in [32, 64, 96]" :key="y" x1="12" :y1="y" x2="308" :y2="y" class="grid-line" />
        <path v-if="areaPath" :d="areaPath" class="area" :fill="`url(#${areaGradientId})`" />
        <path v-if="linePath" pathLength="1" :d="linePath" class="line" :stroke="`url(#${gradientId})`" />
        <circle
          v-for="(point, index) in coordinates"
          v-show="point.value > 0"
          :key="index"
          :cx="point.x"
          :cy="point.y"
          r="3.2"
          class="point"
          :style="{ animationDelay: `${220 + index * 40}ms` }"
        />
        <text
          v-for="index in labelIndexes"
          :key="`label-${index}`"
          :x="coordinates[index]?.x"
          y="121"
          text-anchor="middle"
        >{{ coordinates[index]?.label }}</text>
      </svg>
    </div>
  </section>
</template>

<style scoped>
.trend-card {
  padding: 17px;
  border: 0;
  border-radius: 24px;
  background: var(--paper);
  box-shadow: var(--elev-md), var(--glow-top);
}

header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

h2 {
  font-size: 16px;
}

p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 10px;
}

header strong {
  color: var(--series-color, var(--ink));
  font-size: 17px;
  letter-spacing: -.03em;
}

.plot {
  margin: 10px -5px -4px;
}

svg {
  display: block;
  width: 100%;
  overflow: visible;
}

.grid-line {
  stroke: var(--line);
  stroke-width: 1;
}

.area {
  opacity: 0;
  animation: trend-area-in .55s .28s ease forwards;
}

.line {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 4;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  filter: drop-shadow(0 4px 5px color-mix(in srgb, var(--series-color) 26%, transparent));
  animation: trend-line-in .9s .08s cubic-bezier(.22,.8,.24,1) forwards;
}

.point {
  fill: var(--paper);
  stroke: var(--series-color);
  stroke-width: 2.4;
  transform-box: fill-box;
  transform-origin: center;
  filter: drop-shadow(0 2px 3px color-mix(in srgb, var(--series-color) 24%, transparent));
  animation: trend-point-in .38s cubic-bezier(.2,.8,.2,1) both;
}

@keyframes trend-line-in {
  to { stroke-dashoffset: 0; }
}

@keyframes trend-area-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes trend-point-in {
  from { opacity: 0; transform: scale(.2); }
  to { opacity: 1; transform: scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .area,
  .line,
  .point {
    animation: none;
    opacity: 1;
    stroke-dashoffset: 0;
    transform: none;
  }
}

text {
  fill: var(--muted);
  font-size: 8px;
}
</style>
