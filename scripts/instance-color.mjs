function hashString(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i)
  return h >>> 0
}

function hslToRgb(h, s, l) {
  const sn = s / 100
  const ln = l / 100
  const c = (1 - Math.abs(2 * ln - 1)) * sn
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = ln - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

export function instanceColor(instanceId) {
  const h = hashString(instanceId) % 360
  const s = 68 + (hashString(instanceId + ':s') % 18) // 68–85%
  const l = 54 + (hashString(instanceId + ':l') % 10) // 54–63%
  const [r, g, b] = hslToRgb(h, s, l)
  const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
  const ansi = (text) => `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`
  const ansiBold = (text) => `\x1b[1;38;2;${r};${g};${b}m${text}\x1b[0m`
  return { hex, rgb: [r, g, b], hsl: { h, s, l }, ansi, ansiBold }
}

const RESET = '\x1b[0m'
const DIM = '\x1b[2m'

export function buildInstanceLaunchBanner(instance, { emphasis = false, userDataPath, tintHex } = {}) {
  const { ansiBold, hex } = instanceColor(instance)
  const tag = `DEV · ${instance}`
  const lines = []

  lines.push('')
  if (emphasis) {
    const inner = `  INSTANCE: ${instance}  `
    const bar = '═'.repeat(inner.length)
    lines.push(ansiBold(`╔${bar}╗`))
    lines.push(ansiBold(`║${inner}║`))
    lines.push(ansiBold(`╚${bar}╝`))
    lines.push(ansiBold(`  Window badge: ${tag}`))
  } else {
    lines.push(ansiBold(`▶ Maestrly  ${tag}`))
  }
  if (userDataPath) lines.push(DIM + `  userData: ${userDataPath}` + RESET)
  lines.push(DIM + `  color ${hex} (sidebar badge)${tintHex ? ` · background ${tintHex}` : ''}` + RESET)
  lines.push('')

  return { lines, instance }
}

export function printInstanceLaunchBanner(instance, opts) {
  const banner = buildInstanceLaunchBanner(instance, opts)
  for (const line of banner.lines) console.log(line)
  return banner
}

export function setTerminalWindowTitle(instance) {
  if (!process.stdout.isTTY) return
  const title = `◆ DEV · ${instance}`
  process.stdout.write(`\x1b]0;${title}\x07\x1b]2;${title}\x07`)
}

export function instanceTintHex(instanceId) {
  const h = hashString(instanceId) % 360
  const [r, g, b] = hslToRgb(h, 38, 11)
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

export function setTerminalBackground(instanceId) {
  const hex = instanceTintHex(instanceId)
  if (process.stdout.isTTY) process.stdout.write(`\x1b]11;${hex}\x07`)
  return hex
}

/** Restore the terminal background (OSC 111) when the dev server exits. */
export function resetTerminalBackground() {
  if (process.stdout.isTTY) process.stdout.write('\x1b]111\x07')
}

export function printInstanceCollisionWarning(prev, pid, next) {
  const nextColor = instanceColor(next)
  console.warn(`\x1b[33m⚠ Instance "${prev}" already in use (PID ${pid}).\x1b[0m`)
  console.warn(`  Launching as ${nextColor.ansiBold(next)} — badge: ${nextColor.ansiBold(`DEV · ${next}`)}`)
  console.warn(`  To resume "${prev}", focus the existing window.\n`)
}
