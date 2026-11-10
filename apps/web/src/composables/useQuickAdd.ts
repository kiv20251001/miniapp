import { computed, reactive } from 'vue'

const state = reactive({
  open: false,
  // 待处理的「新增日期安排」请求：可能在今日页挂载之前就发出，由今日页挂载或监听时消费
  pendingPreset: false,
})

export function useQuickAdd() {
  function toggle() {
    state.open = !state.open
  }

  function close() {
    state.open = false
  }

  function requestPresetPicker() {
    state.open = false
    state.pendingPreset = true
  }

  function consumePresetRequest() {
    if (!state.pendingPreset) return false
    state.pendingPreset = false
    return true
  }

  return {
    isOpen: computed(() => state.open),
    pendingPreset: computed(() => state.pendingPreset),
    toggle,
    close,
    requestPresetPicker,
    consumePresetRequest,
  }
}
