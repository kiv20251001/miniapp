import { t } from '@/i18n'
import { formTip } from '@/utils/form'
import { openSheetPdf, persistSheetImage } from './export'

/** hideLoading 紧接 showToast 会把提示一起关掉，所以提示稍后再弹。 */
function later(run: () => void) {
  setTimeout(run, 120)
}

function saveOne(filePath: string) {
  return new Promise<void>((resolve, reject) => {
    uni.saveImageToPhotosAlbum({
      filePath,
      success: () => resolve(),
      fail: (err) => reject(new Error(err?.errMsg || '保存图片失败')),
    })
  })
}

export async function saveSheetImages(files: string[]) {
  uni.showLoading({ title: '正在保存…', mask: true })
  try {
    for (let index = 0; index < files.length; index += 1) {
      await saveOne(await persistSheetImage(files[index], index))
    }
    uni.hideLoading()
    later(() => uni.showToast({ icon: 'none', title: t('已保存 {n} 张到相册', { n: files.length }) }))
  } catch (error) {
    uni.hideLoading()
    const message = error instanceof Error ? error.message : '保存图片失败'
    if (/auth deny|authorize|privacy|隐私/i.test(message)) {
      later(() =>
        uni.showModal({
          title: '需要相册权限',
          content: '保存字帖图片需要允许访问相册。',
          confirmText: '去设置',
          success: (result) => {
            if (result.confirm) uni.openSetting({})
          },
        }),
      )
      return
    }
    later(() => formTip(message))
  }
}

export async function saveSheetPdf(files: string[], name?: string) {
  uni.showLoading({ title: '正在生成 PDF…', mask: true })
  try {
    await openSheetPdf(files, name)
    uni.hideLoading()
    later(() => uni.showToast({ icon: 'none', title: '已打开 PDF，可以转发或打印' }))
  } catch (error) {
    uni.hideLoading()
    later(() => formTip(error instanceof Error ? error.message : '打开 PDF 失败'))
  }
}
