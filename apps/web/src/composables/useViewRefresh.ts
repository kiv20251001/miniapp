import { watch, type WatchSource } from 'vue'
import { useAppStore } from '@/stores/app'

export function useViewRefresh(range: WatchSource<{ from: string; to: string }>) {
  const store = useAppStore()
  watch(
    range,
    ({ from, to }) => {
      if (!from || !to) return
      void store.refreshRange(from, to)
    },
    { immediate: true },
  )
}
