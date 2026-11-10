import { useFamilyStore } from '@/stores/family'
import { openTab } from '@/utils/nav'

export function useFamilyRole() {
  return useFamilyStore()
}

function leave() {
  if (getCurrentPages().length > 1) uni.navigateBack()
  else openTab('today')
}

export function denyViewerWrite(message = '家人只能查看课表和地点') {
  const store = useFamilyStore()
  if (store.ready && !store.canWrite) {
    uni.showToast({ icon: 'none', title: message })
    leave()
    return true
  }
  return false
}

export function denyViewerBills(message = '家人不能查看账单') {
  const store = useFamilyStore()
  if (store.ready && !store.canViewBills) {
    uni.showToast({ icon: 'none', title: message })
    leave()
    return true
  }
  return false
}
