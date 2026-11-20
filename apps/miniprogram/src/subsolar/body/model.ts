/**
 * 场景只认这个接口，不关心人体是代码画的还是从模型文件读的。
 * 写实人体由 realistic.ts 从云存储的模型文件读出来，读不到时用 procedural.ts 代码生成的人体。
 * 以后换成别的模型文件，写一个 loader 返回同样的结构即可，页面和 scene.ts 不用改。约定：
 *
 * 1. 坐标系和 anatomy.ts 一致（y 朝上、z 朝前、x 朝身体左边，身高约 1.9）。模型文件导入后先缩放、平移对齐。
 * 2. 每个部位（PartId）由一块或几块 piece 组成，左右成对的器官（肺、肾）各算一块。
 *    piece.object 的原点放在这一块的中心：心跳、呼吸这些动画按原点缩放，展开时按原点移动。
 *    模型文件里的网格先把几何体平移到中心，再把 object.position 设成中心，见 recenter()。
 * 3. 每个部位的材质只属于它自己（不和其他部位共用），场景会改透明度、发光和剖切。
 * 4. muscle 可以不提供：场景会用皮肤的网格往里缩一点自动生成肌肉层。
 * 5. inner 是切开后才看得到的内部结构（心脏四个腔、肺里的支气管树），没有就不切开看里面。
 * 6. 网格的 userData.keep = true 表示一直显示（例如眼睛），不跟着皮肤变透明。
 */
import { Box3, Mesh, Vector3, type BufferGeometry, type Material, type Object3D } from 'three'
import type { BodyRoutes, PartId } from './anatomy'

export type BodyPiece = {
  object: Object3D
  /** 这一块的中心，等于 object 的初始位置 */
  center: Vector3
}

export type BodyPart = {
  id: PartId
  pieces: BodyPiece[]
  inner?: Object3D[]
}

export type BodyModel = {
  parts: Partial<Record<PartId, BodyPart>>
  /** 演示路线；不提供时用 anatomy.ts 的 DEFAULT_ROUTES（按代码生成的人体摆的） */
  routes?: BodyRoutes
  dispose(): void
}

/** 把网格的几何体平移到包围盒中心，返回中心；模型文件里的网格接入时用。 */
export function recenter(mesh: Mesh) {
  const box = new Box3().setFromBufferAttribute(mesh.geometry.getAttribute('position') as never)
  const center = box.getCenter(new Vector3())
  mesh.geometry.translate(-center.x, -center.y, -center.z)
  mesh.position.add(center)
  return center
}

/** 释放一个模型里所有的几何体和材质。 */
export function disposeTree(root: Object3D) {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  root.traverse((object) => {
    const mesh = object as Mesh
    if (mesh.geometry) geometries.add(mesh.geometry)
    const material = (mesh as { material?: Material | Material[] }).material
    for (const one of Array.isArray(material) ? material : material ? [material] : []) materials.add(one)
  })
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
}
