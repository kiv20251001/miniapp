import { watch } from 'vue'
import { useUiStore } from '@/stores/ui'

/**
 * tab 视图是组件，拿不到页面的 onShow。
 * 视图切到前台、或主页面从后台回来且这个视图正在显示时，各触发一次。
 */
export function onViewShow(active: () => boolean, handler: () => void) {
  const ui = useUiStore()
  watch(
    [active, () => ui.homeShown],
    ([isActive]) => {
      if (isActive) handler()
    },
    { immediate: true },
  )
}
