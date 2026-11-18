/**
 * 星球表面全部用着色器现场画到渲染目标上，不用任何外部贴图：没有版权问题，也不占包体积。
 * 地球的海陆轮廓来自 earth-mask.ts（Natural Earth 公有领域数据）。
 */
import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from 'three'
import { EARTH_MASK, EARTH_MASK_HEIGHT, EARTH_MASK_WIDTH } from './earth-mask'
import type { SurfaceKind } from './bodies'

const NOISE = /* glsl */ `
float hash3(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}
float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), f.x);
  float b = mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x);
  float c = mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x);
  float d = mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x);
  return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
}
float fbm(vec3 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    sum += amp * noise3(p);
    p = p * 2.07 + vec3(5.1, 1.3, 7.7);
    amp *= 0.5;
  }
  return sum;
}
// 坑：用低频噪声挖出圆形洼地，边缘稍亮
float craters(vec3 p, float scale) {
  float n = noise3(p * scale);
  float rim = smoothstep(0.62, 0.7, n) - smoothstep(0.72, 0.8, n);
  float pit = smoothstep(0.74, 0.86, n);
  return rim * 0.18 - pit * 0.22;
}
`

const SURFACES: Record<SurfaceKind, string> = {
  sun: `
    float n = fbm(p * 7.0);
    float g = fbm(p * 22.0 + n);
    vec3 col = mix(vec3(1.0, 0.42, 0.06), vec3(1.0, 0.86, 0.38), g);
    col += vec3(0.25, 0.12, 0.0) * smoothstep(0.55, 0.8, n);
    return col;`,
  mercury: `
    float n = fbm(p * 3.0);
    vec3 col = mix(vec3(0.42, 0.40, 0.38), vec3(0.70, 0.67, 0.63), n);
    col += craters(p, 9.0) + craters(p + 3.1, 21.0) * 0.6;
    return col;`,
  venus: `
    float warp = fbm(p * 2.5);
    float band = fbm(vec3(p.x * 1.5, p.y * 7.0 + warp * 2.2, p.z * 1.5));
    return mix(vec3(0.80, 0.62, 0.36), vec3(0.98, 0.90, 0.68), band);`,
  earth: `
    vec2 maskUv = vec2(uv.x, 1.0 - uv.y);
    float land = texture2D(uMask, maskUv).r;
    float n = fbm(p * 6.0);
    float lat = abs(asin(clamp(p.y, -1.0, 1.0))) * 57.2958;
    vec3 ocean = mix(vec3(0.03, 0.14, 0.38), vec3(0.06, 0.32, 0.62), n);
    float dry = smoothstep(14.0, 24.0, lat) * (1.0 - smoothstep(32.0, 40.0, lat));
    vec3 green = mix(vec3(0.13, 0.38, 0.14), vec3(0.32, 0.50, 0.20), n);
    vec3 desert = mix(vec3(0.72, 0.58, 0.36), vec3(0.85, 0.72, 0.48), n);
    vec3 ground = mix(green, desert, dry * smoothstep(0.35, 0.6, n + 0.15));
    ground = mix(ground, vec3(0.45, 0.42, 0.34), smoothstep(52.0, 66.0, lat));
    float shore = smoothstep(0.35, 0.65, land);
    vec3 col = mix(ocean, ground, shore);
    float ice = smoothstep(68.0, 74.0, lat + n * 8.0) * max(shore, smoothstep(76.0, 80.0, lat));
    col = mix(col, vec3(0.93, 0.96, 1.0), ice);
    float cloud = smoothstep(0.52, 0.72, fbm(p * 4.0 + vec3(0.0, n * 2.0, 0.0)));
    return mix(col, vec3(1.0), cloud * 0.7);`,
  moon: `
    float maria = smoothstep(0.48, 0.58, fbm(p * 1.6 + 2.0));
    float n = fbm(p * 8.0);
    vec3 col = mix(vec3(0.72, 0.71, 0.69), vec3(0.40, 0.40, 0.42), maria);
    col *= 0.85 + n * 0.3;
    col += craters(p, 11.0) + craters(p + 1.7, 25.0) * 0.5;
    return col;`,
  mars: `
    float n = fbm(p * 3.0);
    float dark = smoothstep(0.5, 0.62, fbm(p * 1.8 + 4.0));
    vec3 col = mix(vec3(0.78, 0.38, 0.18), vec3(0.88, 0.55, 0.30), n);
    col = mix(col, vec3(0.45, 0.22, 0.12), dark * 0.7);
    col += craters(p, 10.0) * 0.6;
    float lat = abs(p.y);
    col = mix(col, vec3(0.95, 0.94, 0.92), smoothstep(0.93, 0.96, lat + n * 0.03));
    return col;`,
  jupiter: `
    float warp = fbm(p * 3.0) * 0.35;
    float y = p.y + warp * 0.25;
    float band = sin(y * 22.0) * 0.5 + 0.5;
    float fine = fbm(vec3(p.x * 2.0, y * 40.0, p.z * 2.0));
    vec3 light = vec3(0.93, 0.87, 0.76);
    vec3 dark = vec3(0.72, 0.52, 0.36);
    vec3 col = mix(dark, light, smoothstep(0.25, 0.75, band * 0.8 + fine * 0.4));
    vec2 spot = vec2((uv.x - 0.62) * 2.2, (uv.y - 0.37) * 6.0);
    float d = length(spot);
    col = mix(col, vec3(0.80, 0.36, 0.22), (1.0 - smoothstep(0.05, 0.12, d)) * 0.9);
    return col;`,
  saturn: `
    float warp = fbm(p * 2.0) * 0.2;
    float band = sin((p.y + warp * 0.2) * 26.0) * 0.5 + 0.5;
    float fine = fbm(vec3(p.x, p.y * 30.0, p.z));
    return mix(vec3(0.80, 0.68, 0.48), vec3(0.95, 0.88, 0.70), band * 0.6 + fine * 0.4);`,
  uranus: `
    float band = fbm(vec3(p.x, p.y * 10.0, p.z));
    return mix(vec3(0.55, 0.82, 0.86), vec3(0.70, 0.92, 0.93), band);`,
  neptune: `
    float warp = fbm(p * 3.0);
    float band = fbm(vec3(p.x * 1.5, p.y * 12.0 + warp, p.z * 1.5));
    vec3 col = mix(vec3(0.12, 0.25, 0.70), vec3(0.30, 0.50, 0.92), band);
    vec2 spot = vec2((uv.x - 0.3) * 2.0, (uv.y - 0.4) * 5.0);
    col = mix(col, vec3(0.06, 0.12, 0.40), (1.0 - smoothstep(0.06, 0.12, length(spot))) * 0.8);
    return col;`,
}

let earthMask: DataTexture | undefined

function decodeEarthMask() {
  if (earthMask) return earthMask
  const data = new Uint8Array(EARTH_MASK_WIDTH * EARTH_MASK_HEIGHT * 4)
  const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let offset = 0
  let land = false
  let value = 0
  let shift = 0
  for (const char of EARTH_MASK) {
    const digit = ALPHA.indexOf(char)
    value |= (digit & 31) << shift
    if (digit & 32) {
      shift += 5
      continue
    }
    if (land) {
      for (let i = 0; i < value; i += 1) data.fill(255, (offset + i) * 4, (offset + i) * 4 + 4)
    }
    offset += value
    land = !land
    value = 0
    shift = 0
  }
  earthMask = new DataTexture(data, EARTH_MASK_WIDTH, EARTH_MASK_HEIGHT, RGBAFormat)
  earthMask.magFilter = LinearFilter
  earthMask.minFilter = LinearFilter
  earthMask.needsUpdate = true
  return earthMask
}

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

function fragment(kind: SurfaceKind) {
  return /* glsl */ `
uniform sampler2D uMask;
varying vec2 vUv;
${NOISE}
vec3 surface(vec3 p, vec2 uv) {
  ${SURFACES[kind]}
}
void main() {
  float phi = vUv.x * 6.2831853;
  float theta = (1.0 - vUv.y) * 3.1415927;
  vec3 p = vec3(-cos(phi) * sin(theta), cos(theta), sin(phi) * sin(theta));
  gl_FragColor = vec4(clamp(surface(p, vUv), 0.0, 1.0), 1.0);
}
`
}

/** 把每种星球表面各画一次，返回可以直接当 map 用的纹理。 */
export function bakeSurfaces(renderer: WebGLRenderer, kinds: SurfaceKind[]) {
  const scene = new Scene()
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const quad = new Mesh(new PlaneGeometry(2, 2))
  scene.add(quad)
  const out = new Map<SurfaceKind, { texture: Texture; target: WebGLRenderTarget }>()
  for (const kind of kinds) {
    const big = kind === 'earth' || kind === 'jupiter'
    const target = new WebGLRenderTarget(big ? 1024 : 512, big ? 512 : 256, {
      depthBuffer: false,
      generateMipmaps: true,
      minFilter: LinearMipmapLinearFilter,
      magFilter: LinearFilter,
    })
    const material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: fragment(kind),
      uniforms: { uMask: { value: kind === 'earth' ? decodeEarthMask() : null } },
      depthTest: false,
      depthWrite: false,
    })
    quad.material = material
    renderer.setRenderTarget(target)
    renderer.render(scene, camera)
    material.dispose()
    out.set(kind, { texture: target.texture, target })
  }
  renderer.setRenderTarget(null)
  quad.geometry.dispose()
  earthMask?.dispose()
  earthMask = undefined
  return out
}

/** 中心亮、向外渐隐的圆点，给太阳光晕和星星用。 */
export function radialTexture(size: number, stops: Array<[number, number, number, number, number]>) {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const d = Math.min(1, Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2))
      let i = 0
      while (i < stops.length - 2 && d > stops[i + 1][0]) i += 1
      const [d0, r0, g0, b0, a0] = stops[i]
      const [d1, r1, g1, b1, a1] = stops[i + 1]
      const k = Math.min(1, Math.max(0, (d - d0) / (d1 - d0 || 1)))
      const o = (y * size + x) * 4
      data[o] = r0 + (r1 - r0) * k
      data[o + 1] = g0 + (g1 - g0) * k
      data[o + 2] = b0 + (b1 - b0) * k
      data[o + 3] = a0 + (a1 - a0) * k
    }
  }
  const texture = new DataTexture(data, size, size, RGBAFormat)
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.needsUpdate = true
  return texture
}
