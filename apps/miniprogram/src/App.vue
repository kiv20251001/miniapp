<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { CLOUD_ENV, WX_ENV_VERSION } from './config'
import { ensureSession, useFamilyStore } from './stores/family'
import { isMomentsPreview } from './utils/share'
import { useThemeStore } from './utils/wx-theme'

onLaunch(() => {
  try {
    useThemeStore().apply()
  } catch (error) {
    console.warn('[theme] apply skipped', error)
  }
  // #ifdef MP-WEIXIN
  if (wx.cloud) {
    if (!CLOUD_ENV) console.warn(`[cloud] ${WX_ENV_VERSION} 没有配置云环境 ID，将使用默认环境`)
    wx.cloud.init({
      traceUser: true,
      ...(CLOUD_ENV ? { env: CLOUD_ENV } : {}),
    })
  }
  // #endif
  // 朋友圈单页不能调云函数。其余冷启动在首屏绘制的同时就开始恢复会话。
  if (isMomentsPreview()) {
    useFamilyStore().bootDone = true
    return
  }
  ensureSession()
})
</script>

<style lang="scss">
@import './styles/app.scss';
</style>
