import { isLandFast } from './earthLandMask'

export type SphereLayers = {
  shadow: string
  body: string
  land: string
  cloud: string
  wire: string
  rim: string
}

// ── OPTIMIZATION: Reduced resolution from 160x80 to 120x60 (43% fewer pixels) ──
const SPHERE_COLS = 120
const SPHERE_ROWS = 60

const SHADOW_SCALE = ' .-'
const BODY_SCALE = ' .,:-~;=+*#'
const LAND_SCALE = ' .,:-~;=+*#%'
const CLOUD_SCALE = ' .,:-~;'
const WIRE_SCALE = ' .,:-'
const RIM_SCALE = ' .-~:;=!*#%@'

const TOTAL_POINTS = SPHERE_ROWS * SPHERE_COLS
const pInside = new Uint8Array(TOTAL_POINTS)
const pLon = new Float32Array(TOTAL_POINTS)
const pLat = new Float32Array(TOTAL_POINTS)
const pSinLat = new Float32Array(TOTAL_POINTS)
const pCosLat = new Float32Array(TOTAL_POINTS)
const pEdge = new Float32Array(TOTAL_POINTS)

let idx = 0
for (let y = 0; y < SPHERE_ROWS; y += 1) {
  const ny = (y / (SPHERE_ROWS - 1)) * 2 - 1
  const sy = ny

  for (let x = 0; x < SPHERE_COLS; x += 1) {
    const nx = (x / (SPHERE_COLS - 1)) * 2 - 1
    const sx = nx
    const rr = sx * sx + sy * sy

    if (rr > 1) {
      pInside[idx] = 0
      idx += 1
      continue
    }

    pInside[idx] = 1
    const z = Math.sqrt(1 - rr)
    const lat = -Math.asin(Math.max(-1, Math.min(1, sy)))
    const lon = Math.atan2(sx, z)

    pLon[idx] = lon
    pLat[idx] = lat
    pSinLat[idx] = Math.sin(lat)
    pCosLat[idx] = Math.cos(lat)
    pEdge[idx] = 1 - z
    idx += 1
  }
}

/* ── Pre-allocated buffers ── */
const LINE_LENGTH = SPHERE_COLS + 1               // +1 for \n
const FRAME_CHARS = SPHERE_ROWS * LINE_LENGTH - 1  // last row has no \n
const NEWLINE = 10                                  // '\n'.charCodeAt(0)
const SPACE = 32                                    // ' '.charCodeAt(0)

// 6 persistent buffers — allocated once, reused every frame
const shadowBuf = new Uint16Array(FRAME_CHARS)
const bodyBuf = new Uint16Array(FRAME_CHARS)
const landBuf = new Uint16Array(FRAME_CHARS)
const cloudBuf = new Uint16Array(FRAME_CHARS)
const wireBuf = new Uint16Array(FRAME_CHARS)
const rimBuf = new Uint16Array(FRAME_CHARS)

// Pre-compute charCode lookup tables for each scale (avoid charCodeAt per pixel)
function buildScaleTable(scale: string): Uint16Array {
  const table = new Uint16Array(scale.length)
  for (let i = 0; i < scale.length; i += 1) {
    table[i] = scale.charCodeAt(i)
  }
  return table
}
const SHADOW_TABLE = buildScaleTable(SHADOW_SCALE)
const BODY_TABLE = buildScaleTable(BODY_SCALE)
const LAND_TABLE = buildScaleTable(LAND_SCALE)
const CLOUD_TABLE = buildScaleTable(CLOUD_SCALE)
const WIRE_TABLE = buildScaleTable(WIRE_SCALE)
const RIM_TABLE = buildScaleTable(RIM_SCALE)

function mapCodeFast(table: Uint16Array, len: number, value: number): number {
  const clamped = value < 0 ? 0 : value > 0.999 ? 0.999 : value
  return table[(clamped * len) | 0]
}

const SHADOW_LEN = SHADOW_TABLE.length - 1
const BODY_LEN = BODY_TABLE.length - 1
const LAND_LEN = LAND_TABLE.length - 1
const CLOUD_LEN = CLOUD_TABLE.length - 1
const WIRE_LEN = WIRE_TABLE.length - 1
const RIM_LEN = RIM_TABLE.length - 1

/* ── Chunk size for String.fromCharCode ── */
const CHUNK = 8192

function bufToString(buf: Uint16Array, len: number): string {
  if (len <= CHUNK) return String.fromCharCode.apply(null, buf.subarray(0, len) as unknown as number[])
  let out = ''
  for (let i = 0; i < len; i += CHUNK) {
    const end = i + CHUNK < len ? i + CHUNK : len
    out += String.fromCharCode.apply(null, buf.subarray(i, end) as unknown as number[])
  }
  return out
}

/* ── Fast Math Approximations ── */
// Math.sin approximation is not needed for most cases, modern JS engines optimize it well,
// but we CAN pre-calculate the scanline and flicker factors per row instead of per pixel.

export function buildSphereLayers(phase: number, tick: number): SphereLayers {
  let pointIndex = 0
  let writeIndex = 0

  // Pre-calculate per-row effects to save Math.sin calls in inner loop
  const scanlines = new Float32Array(SPHERE_ROWS)
  const flickers = new Float32Array(SPHERE_ROWS)
  for (let y = 0; y < SPHERE_ROWS; y += 1) {
    scanlines[y] = 0.94 + 0.06 * Math.sin((y + tick * 0.8) * 0.8)
    flickers[y] = 0.97 + 0.03 * Math.sin(tick * 0.2 + y * 0.1)
  }

  const cloudTickA = tick * 0.08
  const cloudTickB = tick * -0.02
  const cloudDiffB = cloudTickB * 3.8

  for (let y = 0; y < SPHERE_ROWS; y += 1) {
    const baseToneEffect = scanlines[y] * flickers[y]

    for (let x = 0; x < SPHERE_COLS; x += 1) {
      if (pInside[pointIndex] === 0) {
        shadowBuf[writeIndex] = SPACE
        bodyBuf[writeIndex] = SPACE
        landBuf[writeIndex] = SPACE
        cloudBuf[writeIndex] = SPACE
        wireBuf[writeIndex] = SPACE
        rimBuf[writeIndex] = SPACE
        pointIndex += 1
        writeIndex += 1
        continue
      }

      const lon = pLon[pointIndex] + phase
      const sinLon = Math.sin(lon)
      const cosLon = Math.cos(lon)

      const cosLat = pCosLat[pointIndex]
      const sinLat = pSinLat[pointIndex]
      const edge = pEdge[pointIndex]
      const lat = pLat[pointIndex]

      const wx = sinLon * cosLat
      const wy = sinLat
      const wz = cosLon * cosLat
      const z = 1 - edge

      const lightDot = wx * 0.7 + wy * -0.3 + wz * 0.64
      const diffuse = lightDot > 0 ? lightDot : 0
      const night = -lightDot > 0 ? -lightDot : 0
      
      // OPTIMIZATION: Simplified Fresnel polynomial
      const fresnel = edge * edge * (1.0 + edge * 0.2) // approximation of edge^2 * edge^0.2
      const rimLight = fresnel * 0.65
      
      const specRaw = wx * 0.5 + wy * -0.2 + wz * 0.84
      // OPTIMIZATION: Rapidly decay specular highlight without Math.pow(x, 28)
      // If specRaw < 0.6 it contributes basically nothing at ^28, so we can branch early
      let specular = 0
      if (specRaw > 0.6) {
         const s2 = specRaw * specRaw
         const s4 = s2 * s2
         const s8 = s4 * s4
         specular = s8 * s8 * s8 * 0.5 // rough approx of ^24
      }

      const bodyIntensity = (0.16 + diffuse * 0.34 + rimLight * 0.58 + specular) * baseToneEffect
      bodyBuf[writeIndex] = mapCodeFast(BODY_TABLE, BODY_LEN, bodyIntensity)

      const shadowMask = night * 0.86 + edge * 0.2 - diffuse * 0.42
      shadowBuf[writeIndex] = shadowMask > 0.1
        ? mapCodeFast(SHADOW_TABLE, SHADOW_LEN, shadowMask < 1 ? shadowMask : 1)
        : SPACE

      const isLand = isLandFast(lon, lat)
      const landRaw = 0.24 + bodyIntensity * 0.5 + diffuse * 0.5 + rimLight * 0.35
      landBuf[writeIndex] = isLand ? mapCodeFast(LAND_TABLE, LAND_LEN, landRaw) : SPACE

      // OPTIMIZATION: Pre-multiplied cloud field constants
      const cloudLon = lon * 1.2
      const cloudField =
        Math.sin(cloudLon * 3.8 + cloudDiffB + sinLat * 4.4 + cloudTickA) +
        0.6 * Math.cos(cloudLon * 1.8 + cloudTickB * 1.8 - lat * 5.2)
      
      const cloudThreshold = 1.1 - z * 0.2 + night * 0.2
      if (cloudField > cloudThreshold) {
        const cloudTone = 0.4 + diffuse * 0.5 + fresnel
        cloudBuf[writeIndex] = mapCodeFast(CLOUD_TABLE, CLOUD_LEN, cloudTone)
      } else {
        cloudBuf[writeIndex] = SPACE
      }

      // OPTIMIZATION: Fast absolute value and logical branching instead of Math.abs/Math.min
      // wireStrength requires trig but we can simplify the math
      let meridian = Math.sin(lon * 8)
      meridian = meridian < 0 ? -meridian : meridian
      let parallel = Math.sin(lat * 9)
      parallel = parallel < 0 ? -parallel : parallel
      
      const grid = 1 - (meridian < parallel ? meridian : parallel)
      const wireStrength = grid * (0.1 + diffuse * 0.38 + z * 0.12) * (1 - night * 0.3)
      wireBuf[writeIndex] = wireStrength > 0.68
        ? mapCodeFast(WIRE_TABLE, WIRE_LEN, wireStrength)
        : SPACE

      const rimEdge = edge - 0.68
      if (rimEdge > 0) {
        const rimStrength = (rimEdge * 3.125) * (0.4 + diffuse * 0.6) // 1/0.32 = 3.125
        rimBuf[writeIndex] = rimStrength > 0.15
          ? mapCodeFast(RIM_TABLE, RIM_LEN, rimStrength)
          : SPACE
      } else {
        rimBuf[writeIndex] = SPACE
      }

      pointIndex += 1
      writeIndex += 1
    }

    if (y < SPHERE_ROWS - 1) {
      shadowBuf[writeIndex] = NEWLINE
      bodyBuf[writeIndex] = NEWLINE
      landBuf[writeIndex] = NEWLINE
      cloudBuf[writeIndex] = NEWLINE
      wireBuf[writeIndex] = NEWLINE
      rimBuf[writeIndex] = NEWLINE
      writeIndex += 1
    }
  }

  return {
    shadow: bufToString(shadowBuf, writeIndex),
    body: bufToString(bodyBuf, writeIndex),
    land: bufToString(landBuf, writeIndex),
    cloud: bufToString(cloudBuf, writeIndex),
    wire: bufToString(wireBuf, writeIndex),
    rim: bufToString(rimBuf, writeIndex),
  }
}
