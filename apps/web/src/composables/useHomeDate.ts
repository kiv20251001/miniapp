import { computed, reactive } from 'vue'
import dayjs from 'dayjs'

const view = reactive({
  selectedDate: dayjs().format('YYYY-MM-DD'),
  weekOffset: 0,
})

export function useHomeDate() {
  const isViewingToday = computed(() => view.selectedDate === dayjs().format('YYYY-MM-DD'))

  function goToToday() {
    view.selectedDate = dayjs().format('YYYY-MM-DD')
    view.weekOffset = 0
  }

  return { view, isViewingToday, goToToday }
}
