import { isLandFast } from './earthLandMask'

export type SphereLayers = {
  shadow: string
  body: string
  land: string
  cloud: string
  wire: string
  rim: string
}

const SPHERE_COLS = 160
const SPHERE_ROWS = 80

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

function mapChar(scale: string, value: number): string {
  const clamped = Math.max(0, Math.min(0.999, value))
  const index = Math.floor(clamped * (scale.length - 1))
  return scale[index]
}

export function buildSphereLayers(phase: number, tick: number): SphereLayers {
  let shadowStr = ''
  let bodyStr = ''
  let landStr = ''
  let cloudStr = ''
  let wireStr = ''
  let rimStr = ''
  let pointIndex = 0

  for (let y = 0; y < SPHERE_ROWS; y += 1) {
    const scanline = 0.94 + 0.06 * Math.sin((y + tick * 0.8) * 0.8)
    const flicker = 0.97 + 0.03 * Math.sin(tick * 0.2 + y * 0.1)

    for (let x = 0; x < SPHERE_COLS; x += 1) {
      if (pInside[pointIndex] === 0) {
        shadowStr += ' '
        bodyStr += ' '
        landStr += ' '
        cloudStr += ' '
        wireStr += ' '
        rimStr += ' '
        pointIndex += 1
        continue
      }

      const lon = pLon[pointIndex] + phase
      const sinLon = Math.sin(lon)
      const cosLon = Math.cos(lon)

      const wx = sinLon * pCosLat[pointIndex]
      const wy = pSinLat[pointIndex]
      const wz = cosLon * pCosLat[pointIndex]
      const z = 1 - pEdge[pointIndex]

      const lightDot = wx * 0.7 + wy * -0.3 + wz * 0.64
      const diffuse = Math.max(0, lightDot)
      const night = Math.max(0, -lightDot)
      const fresnel = Math.pow(pEdge[pointIndex], 2.2)
      const rimLight = fresnel * 0.65
      const specular = Math.pow(Math.max(0, wx * 0.5 + wy * -0.2 + wz * 0.84), 28) * 0.5

      const bodyIntensity = (0.16 + diffuse * 0.34 + rimLight * 0.58 + specular) * scanline * flicker
      const bodyTone = Math.max(0, Math.min(1, bodyIntensity))
      bodyStr += mapChar(BODY_SCALE, bodyTone)

      const shadowMask = Math.max(0, night * 0.86 + pEdge[pointIndex] * 0.2 - diffuse * 0.42)
      shadowStr += shadowMask > 0.1 ? mapChar(SHADOW_SCALE, Math.min(1, shadowMask)) : ' '

      const isLand = isLandFast(lon, pLat[pointIndex])
      const landTone = Math.max(0, Math.min(1, 0.24 + bodyTone * 0.5 + diffuse * 0.5 + rimLight * 0.35))
      landStr += isLand ? mapChar(LAND_SCALE, landTone) : ' '

      const cloudLon = lon * 1.2 - tick * 0.02
      const cloudField =
        Math.sin(cloudLon * 3.8 + pSinLat[pointIndex] * 4.4 + tick * 0.08) +
        0.6 * Math.cos(cloudLon * 1.8 - pLat[pointIndex] * 5.2)
      const cloudThreshold = 1.1 - z * 0.2 + night * 0.2
      if (cloudField > cloudThreshold) {
        const cloudTone = Math.max(0, Math.min(1, 0.4 + diffuse * 0.5 + fresnel))
        cloudStr += mapChar(CLOUD_SCALE, cloudTone)
      } else {
        cloudStr += ' '
      }

      const meridian = Math.abs(Math.sin(lon * 8))
      const parallel = Math.abs(Math.sin(pLat[pointIndex] * 9))
      const grid = 1 - Math.min(meridian, parallel)
      const wireStrength = grid * (0.1 + diffuse * 0.38 + z * 0.12) * (1 - night * 0.3)
      wireStr += wireStrength > 0.68 ? mapChar(WIRE_SCALE, wireStrength) : ' '

      const rimStrength = Math.max(0, (pEdge[pointIndex] - 0.68) / 0.32) * (0.4 + diffuse * 0.6)
      rimStr += rimStrength > 0.15 ? mapChar(RIM_SCALE, Math.min(1, rimStrength)) : ' '

      pointIndex += 1
    }

    if (y < SPHERE_ROWS - 1) {
      shadowStr += '\n'
      bodyStr += '\n'
      landStr += '\n'
      cloudStr += '\n'
      wireStr += '\n'
      rimStr += '\n'
    }
  }

  return {
    shadow: shadowStr,
    body: bodyStr,
    land: landStr,
    cloud: cloudStr,
    wire: wireStr,
    rim: rimStr,
  }
}
