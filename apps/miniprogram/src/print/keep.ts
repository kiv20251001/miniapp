import { drawSheetPage } from './frame'
import { saveSheetImages } from './save'
import { scrollToFirstSheet } from './scroll'

// 打印代码放在主包，是因为字帖、计算题、时钟、分数、单位换算和 3D 几何体分属两个分包，分包之间不能互相引用。
// 微信代码质量从主包 js 的 require 往下走：frame、save、scroll 只有分包在引用，就会被判成「主包未使用」。
// sheet、export、pdf、labels 已经由这三个文件再引用，不用单独挂。
// 返回值必须被主包用到，否则打包会把这次引用当成无副作用调用删掉。
export function keepPrintInMainPackage() {
  return { drawSheetPage, saveSheetImages, scrollToFirstSheet }
}
