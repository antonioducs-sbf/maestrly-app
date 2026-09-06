import zlib from 'node:zlib'

// ---------- CRC32 (cached table) ----------
let CRC
function crc32(buf) {
  if (!CRC) {
    CRC = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      CRC[n] = c >>> 0
    }
  }
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0)
  return Buffer.concat([len, t, data, crc])
}

export function encodePng(rgba, size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth 8
  ihdr[9] = 6 // color type 6 (RGBA)
  const stride = size * 4
  const raw = Buffer.alloc(size * (stride + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filtro None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

export function downsample(src, srcSize, dstSize) {
  if (dstSize === srcSize) return src
  const dst = Buffer.alloc(dstSize * dstSize * 4)
  const ratio = srcSize / dstSize
  for (let dy = 0; dy < dstSize; dy++) {
    const sy0 = Math.floor(dy * ratio),
      sy1 = Math.max(sy0 + 1, Math.min(srcSize, Math.floor((dy + 1) * ratio)))
    for (let dx = 0; dx < dstSize; dx++) {
      const sx0 = Math.floor(dx * ratio),
        sx1 = Math.max(sx0 + 1, Math.min(srcSize, Math.floor((dx + 1) * ratio)))
      let R = 0,
        G = 0,
        B = 0,
        A = 0,
        n = 0
      for (let sy = sy0; sy < sy1; sy++)
        for (let sx = sx0; sx < sx1; sx++) {
          const o = (sy * srcSize + sx) * 4
          const a = src[o + 3] / 255
          R += src[o] * a
          G += src[o + 1] * a
          B += src[o + 2] * a
          A += a
          n++
        }
      const o = (dy * dstSize + dx) * 4
      if (A > 0) {
        dst[o] = Math.round(R / A)
        dst[o + 1] = Math.round(G / A)
        dst[o + 2] = Math.round(B / A)
        dst[o + 3] = Math.round((A / n) * 255)
      }
    }
  }
  return dst
}

// ---------- container ICO (ICONDIR + ICONDIRENTRY[] + embedded PNGs) ----------

export function buildIco(images) {
  const count = images.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type 1 = icon
  header.writeUInt16LE(count, 4)
  const entries = Buffer.alloc(16 * count)
  const blobs = []
  let offset = 6 + 16 * count
  images.forEach((img, i) => {
    const e = entries.subarray(i * 16, i * 16 + 16)
    e.writeUInt8(img.size >= 256 ? 0 : img.size, 0) // width  (0 = 256)
    e.writeUInt8(img.size >= 256 ? 0 : img.size, 1) // height (0 = 256)
    e.writeUInt8(0, 2) // palette (0 = truecolor)
    e.writeUInt8(0, 3) // reserved
    e.writeUInt16LE(1, 4) // color planes
    e.writeUInt16LE(32, 6) // bits per pixel (RGBA)
    e.writeUInt32LE(img.png.length, 8) // tamanho do dado
    e.writeUInt32LE(offset, 12) // offset do dado
    offset += img.png.length
    blobs.push(img.png)
  })
  return Buffer.concat([header, entries, ...blobs])
}
