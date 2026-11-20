/**
 * 写实人体：读 scripts/build-body-model.mjs 生成的 body-v1.bin（BodyParts3D + HuBMAP 肺，CC BY 4.0）。
 * 文件放云存储（cloud-storage/body），第一次打开下载后存在本地，之后直接读；读不到时页面退回代码生成的人体。
 *
 * 文件格式：'UBM1' + u32 文件头长度 + JSON 文件头 + 数据。
 * 位置 int16（按文件头的 offset、scale 还原）、法线 int8、索引 uint16，偏移量从数据开头算。
 */
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshLambertMaterial,
  MeshPhongMaterial,
  Vector3,
  type Material,
} from 'three'
import { cloudFile } from '@/config'
import { PARTS, type BodyRoutes, type PartId, type Vec3 } from './anatomy'
import { disposeTree, type BodyModel, type BodyPart } from './model'

type MeshInfo = { v: number; i: number; pos: number; nrm: number; idx: number; color?: string; keep?: 1; inner?: 1 }
type Header = {
  version: number
  offset: Vec3
  scale: Vec3
  parts: Array<{ id: PartId; pieces: Array<{ center: Vec3; meshes: MeshInfo[] }> }>
  routes: BodyRoutes
  credits: string
}

const FILE = 'body/body-v1.bin'

/** 小程序里没有 TextDecoder，文件头只有 ASCII，直接按字节拼 */
function ascii(bytes: Uint8Array) {
  let out = ''
  for (let i = 0; i < bytes.length; i += 8192) out += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return out
}

function readHeader(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  if (ascii(bytes.subarray(0, 4)) !== 'UBM1') throw new Error('不是人体模型文件')
  const length = new DataView(buffer).getUint32(4, true)
  const header = JSON.parse(ascii(bytes.subarray(8, 8 + length))) as Header
  return { header, data: 8 + length }
}

const SKIN_LIKE = new Set<PartId>(['skin', 'muscle'])

function makeMaterial(id: PartId, color: string) {
  if (PARTS[id].layer === 'bone') return new MeshLambertMaterial({ color })
  // 减面后皮肤上会有几道细缝，双面画才不会从缝里看到黑色的背面
  if (SKIN_LIKE.has(id)) return new MeshPhongMaterial({ color, shininess: id === 'skin' ? 12 : 22, specular: 0x1a1a1a, side: DoubleSide })
  return new MeshPhongMaterial({ color, shininess: 40, specular: 0x333333 })
}

export function parseBodyModel(buffer: ArrayBuffer): BodyModel {
  const { header, data } = readHeader(buffer)
  const [ox, oy, oz] = header.offset
  const [sx, sy, sz] = header.scale.map((v) => v / 65535)
  const root = new Group()
  const parts: Partial<Record<PartId, BodyPart>> = {}

  for (const part of header.parts) {
    if (!PARTS[part.id]) continue
    // 每个部位自己的材质，同色的网格共用
    const materials = new Map<string, Material>()
    const material = (color: string, flag: string) => {
      const key = `${color}|${flag}`
      let one = materials.get(key)
      if (!one) {
        one = makeMaterial(part.id, color)
        materials.set(key, one)
      }
      return one
    }
    const inner: Mesh[] = []
    const pieces = part.pieces.map((piece) => {
      const [cx, cy, cz] = piece.center
      const group = new Group()
      group.position.set(cx, cy, cz)
      for (const info of piece.meshes) {
        const q = new Int16Array(buffer, data + info.pos, info.v * 3)
        const pos = new Float32Array(info.v * 3)
        for (let i = 0; i < pos.length; i += 3) {
          pos[i] = ox + (q[i] + 32768) * sx - cx
          pos[i + 1] = oy + (q[i + 1] + 32768) * sy - cy
          pos[i + 2] = oz + (q[i + 2] + 32768) * sz - cz
        }
        const n = new Int8Array(buffer, data + info.nrm, info.v * 3)
        const nrm = new Float32Array(info.v * 3)
        for (let i = 0; i < nrm.length; i += 1) nrm[i] = n[i] / 127
        const geometry = new BufferGeometry()
        geometry.setAttribute('position', new BufferAttribute(pos, 3))
        geometry.setAttribute('normal', new BufferAttribute(nrm, 3))
        geometry.setIndex(new BufferAttribute(new Uint16Array(buffer.slice(data + info.idx, data + info.idx + info.i * 2)), 1))
        geometry.computeBoundingSphere()
        const flag = info.keep ? 'keep' : info.inner ? 'inner' : ''
        const mesh = new Mesh(geometry, material(info.color ?? PARTS[part.id].color, flag))
        if (info.keep) mesh.userData.keep = true
        if (info.inner) {
          mesh.visible = false
          inner.push(mesh)
        }
        group.add(mesh)
      }
      root.add(group)
      return { object: group, center: new Vector3(cx, cy, cz) }
    })
    parts[part.id] = { id: part.id, pieces, ...(inner.length ? { inner } : {}) }
  }

  return {
    parts,
    routes: header.routes,
    dispose() {
      for (const part of Object.values(parts)) for (const piece of part?.pieces ?? []) disposeTree(piece.object)
      root.clear()
    },
  }
}

// ---- 下载和缓存 ----

type Fail = (err: { errMsg?: string }) => void
type FileApi = {
  getFileSystemManager: () => {
    access: (options: { path: string; success?: () => void; fail?: Fail }) => void
    copyFile: (options: { srcPath: string; destPath: string; success?: () => void; fail?: Fail }) => void
    readFile: (options: { filePath: string; success?: (res: { data: ArrayBuffer }) => void; fail?: Fail }) => void
    unlink: (options: { filePath: string; success?: () => void; fail?: Fail }) => void
  }
  env: { USER_DATA_PATH: string }
  cloud?: { downloadFile: (options: { fileID: string; success?: (res: { tempFilePath: string }) => void; fail?: Fail }) => void }
}

const api = () => wx as unknown as FileApi
const SOURCE = cloudFile(FILE)

function hash(value: string) {
  let h = 0
  for (let index = 0; index < value.length; index += 1) h = (h * 31 + value.charCodeAt(index)) | 0
  return (h >>> 0).toString(36)
}

const cachePath = () => `${api().env.USER_DATA_PATH}/body-v1-${hash(SOURCE)}.bin`

function exists(path: string) {
  return new Promise<boolean>((resolve) => api().getFileSystemManager().access({ path, success: () => resolve(true), fail: () => resolve(false) }))
}

function download() {
  return new Promise<string>((resolve, reject) => {
    const cloud = api().cloud
    if (!cloud) return reject(new Error('wx.cloud 不可用'))
    cloud.downloadFile({
      fileID: SOURCE,
      success: (res) => resolve(res.tempFilePath),
      fail: (err) => reject(new Error(`下载 ${SOURCE} 失败：${err?.errMsg || ''}`)),
    })
  })
}

function read(filePath: string) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    api().getFileSystemManager().readFile({ filePath, success: (res) => resolve(res.data), fail: (err) => reject(new Error(err?.errMsg || '读取失败')) })
  })
}

async function fetchBuffer() {
  const cached = cachePath()
  if (await exists(cached)) {
    try {
      const buffer = await read(cached)
      readHeader(buffer)
      return buffer
    } catch {
      // 缓存坏了就删掉重新下载
      api().getFileSystemManager().unlink({ filePath: cached })
    }
  }
  const temp = await download()
  const buffer = await read(temp)
  api().getFileSystemManager().copyFile({ srcPath: temp, destPath: cached })
  return buffer
}

/** 本地已经有缓存，打开就能直接用写实人体，不用等下载 */
export function bodyModelCached() {
  return SOURCE ? exists(cachePath()) : Promise.resolve(false)
}

/**
 * 读写实人体。没配置云存储、下载失败、超时都返回 null，页面用代码生成的人体。
 * 超时后下载还在后台继续，存好后下次打开就是写实的。
 */
export async function loadBodyModel(timeout = 20000): Promise<BodyModel | null> {
  if (!SOURCE) return null
  const job = fetchBuffer().catch((error) => {
    console.warn('[body] realistic model unavailable', error)
    return null
  })
  const buffer = await Promise.race([job, new Promise<null>((resolve) => setTimeout(() => resolve(null), timeout))])
  if (!buffer) return null
  try {
    return parseBodyModel(buffer)
  } catch (error) {
    console.warn('[body] realistic model broken', error)
    return null
  }
}
