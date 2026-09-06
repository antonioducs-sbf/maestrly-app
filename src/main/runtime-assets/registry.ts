import type { RuntimeAssetId } from '../../shared/runtime-assets'
import localMlManifest from '../../../runtime-assets/local-ml/manifest.json'

export type RuntimeTargetId = 'mac-arm64' | 'mac-x64' | 'linux-arm64' | 'linux-x64' | 'win-arm64' | 'win-x64'
export type ArchiveFormat = 'tar.gz' | 'zip'

export interface RuntimeAssetTarget {
  readonly id: RuntimeTargetId
  readonly url: string
  readonly archive: ArchiveFormat
  readonly hash: Readonly<{ algorithm: 'sha256' | 'sha512'; digest: string; encoding: 'hex' | 'base64' }>
  /** Estimated compressed archive size, used for download progress when Content-Length is unavailable. */
  readonly downloadBytes: number
  /** Maximum compressed archive size accepted by the downloader and reserved by the disk preflight. */
  readonly maxDownloadBytes: number
  /** Expected size of the extracted installation tree. */
  readonly unpackedBytes: number
  readonly stripPrefix?: string
  readonly criticalPaths: readonly string[]
  /** Executable used by the release smoke after the service verifies the extracted layout. */
  readonly executablePath?: string
}

export interface RuntimeAssetDefinition {
  readonly id: RuntimeAssetId
  readonly version: string
  readonly targets: Readonly<Partial<Record<RuntimeTargetId, RuntimeAssetTarget>>>
}

const TARGET_IDS = ['mac-arm64', 'mac-x64', 'linux-arm64', 'linux-x64', 'win-arm64', 'win-x64'] as const
const codex = [
  [
    'mac-arm64',
    'darwin-arm64',
    'aarch64-apple-darwin',
    '8cEJWOIW5WnSn2+W1RUjc1sm2sN1H6NP+cCrOe73ImamUy2yOk3QKjZM2SfkA9jf3fqgwlBNUslhGMen2omc5g==',
  ],
  [
    'mac-x64',
    'darwin-x64',
    'x86_64-apple-darwin',
    'hY68UBhIUE3xIn40SdoujokNiCBeHn9Jp9bEtcIrYeYd2IUtu1oCFwxFnkGhw6+UjHn7piiMxohAomddRA4MCg==',
  ],
  [
    'linux-arm64',
    'linux-arm64',
    'aarch64-unknown-linux-musl',
    'QDkOdJzIdMGaOCViY2dqGqr8WhQv81WfmJkAghC3doFedsOfHt87RuAO4yFN7m0FSR3y5UsScSDUT4zOCcmEVA==',
  ],
  [
    'linux-x64',
    'linux-x64',
    'x86_64-unknown-linux-musl',
    'CPUPhFmykKRdIcgwiOfKvFKHBP62dPfaiP+pzQ2bVNAfLTW+i0Kasd7hQryoxZUmTPvw0h9HyM2NgsnQ9AJlTw==',
  ],
  [
    'win-arm64',
    'win32-arm64',
    'aarch64-pc-windows-msvc',
    '+49dim0F4FoxKLBDBLzMQL4C1m9FG2kx6twg98jo2USesKfmj8XG3HSCe2tW2zOfRArSgHCDyNDHFdts3AfaBg==',
  ],
  [
    'win-x64',
    'win32-x64',
    'x86_64-pc-windows-msvc',
    'x1PnFo9Uy81NEIlPx3qxkP3PQgkfmJOY/2LqKCKlvxArWIL+PrEV9xKcmKeo9Yw23PPU2TDH3AyqcdeblqtNNg==',
  ],
] as const
const copilot = [
  [
    'mac-arm64',
    'darwin-arm64',
    'mEWzyqbqRAWgyU7i2uuSRoVPx/TwaFQX0nZmw0bc30aJ0BnO7cy2kYQyCHw8ykmf/tfxT0xauZ6k0BOFmWizzQ==',
  ],
  ['mac-x64', 'darwin-x64', 'Md9yEg406OBVBx3w4PeEj62TubulVLBcHleqmCoOoUmPgUxPZotUbrqz3rtbzADbXfrrD7JWvVsbd2UiNL194w=='],
  [
    'linux-arm64',
    'linux-arm64',
    'ykLJYOqBj3jRB5IJCDugLClAqbr7DmtTbUjlNY7+Jdq/n6i+d7xUQGclf1IWL5gnxbGQVAf+zkToD+sRM389Kg==',
  ],
  [
    'linux-x64',
    'linux-x64',
    'pC0FNHG+BBwZd6yZlM85kkAGN+uJhM6o+THi76N2GnnSxmw7+remb1mvYxdgRVbdCm+LBUIbCKRWJLuMwrfb6A==',
  ],
  [
    'win-arm64',
    'win32-arm64',
    '+HI1DokixXhHUahj06Fw67ZAigBuXKC58BFma4UJOGrQsDgwOSbqeTQHCw6vuymzjKlg3sactfsCUTaefkjscQ==',
  ],
  ['win-x64', 'win32-x64', '02kXOBd9CwBbCaztuf71WYWn+uGapCuiaasomN4tcMH3HBVZ4gi3J0ZUoRcgcS80xh81uQyeBHbnUKzb/RE/9A=='],
] as const
const tunnel = [
  ['mac-arm64', 'darwin-arm64', '288accc7fd20cfee1d495adb933773af9e19ebc0cdef3173f7fb544afa5065b2'],
  ['mac-x64', 'darwin-amd64', '1a48616e584484f8bef4c1128d515ac96cf44d0d9609c1462abccc1793f4b847'],
  ['linux-arm64', 'linux-arm64', 'b842a9b2352eebd80514cf01a1fbb1c0d400a7d24a4015e85a7ea5f1aeaa5b30'],
  ['linux-x64', 'linux-amd64', 'b9e0388a343f2d7adeff3992f411a0bd3d916a64bc56534aac5fd15ac1b20cd5'],
  ['win-arm64', 'windows-arm64', '08954ccda078abfeac9382f9b19d178ce0656cfe1e84f5941f0f8a5c4e91ea78'],
  ['win-x64', 'windows-amd64', '5e64a056f1d96786da0a6f8db1da5f5f4a03fd19a90d951a25cf2ca8d9093d00'],
] as const

function targetRecord(rows: readonly (readonly string[])[], make: (row: readonly string[]) => RuntimeAssetTarget) {
  return Object.freeze(Object.fromEntries(rows.map((row) => [row[0], Object.freeze(make(row))])))
}

/** Measured size of each pinned tarball; the archives are immutable, so these are exact. */
const codexArchiveBytes: Readonly<Record<RuntimeTargetId, number>> = {
  'mac-arm64': 115_669_249,
  'mac-x64': 123_497_670,
  'linux-arm64': 121_675_259,
  'linux-x64': 129_259_793,
  'win-arm64': 132_143_077,
  'win-x64': 141_510_231,
}
/** npm dist.unpackedSize; includes the tiny package envelope, so disk preflight remains conservative. */
const codexUnpackedBytes: Readonly<Record<RuntimeTargetId, number>> = {
  'mac-arm64': 288_125_331,
  'mac-x64': 308_503_598,
  'linux-arm64': 291_867_383,
  'linux-x64': 334_866_458,
  'win-arm64': 342_786_209,
  'win-x64': 395_759_772,
}
const copilotArchiveBytes: Readonly<Record<RuntimeTargetId, number>> = {
  'mac-arm64': 130_336_069,
  'mac-x64': 146_101_321,
  'linux-arm64': 147_266_596,
  'linux-x64': 142_982_140,
  'win-arm64': 131_060_040,
  'win-x64': 130_154_451,
}
/** Small headroom over the measured size so a byte-exact archive never trips the guard. */
function downloadCap(bytes: number): number {
  return Math.ceil((bytes * 1.05) / 1_000_000) * 1_000_000
}

const codexTargets = targetRecord(codex, ([id, suffix, triple, digest]) => ({
  id: id as RuntimeTargetId,
  url: `https://registry.npmjs.org/@openai/codex/-/codex-0.153.2-${suffix}.tgz`,
  archive: 'tar.gz',
  hash: { algorithm: 'sha512', digest, encoding: 'base64' },
  downloadBytes: codexArchiveBytes[id as RuntimeTargetId],
  maxDownloadBytes: downloadCap(codexArchiveBytes[id as RuntimeTargetId]),
  unpackedBytes: codexUnpackedBytes[id as RuntimeTargetId],
  stripPrefix: `package/vendor/${triple}`,
  criticalPaths: [`bin/${id.startsWith('win-') ? 'codex.exe' : 'codex'}`, 'codex-package.json'],
  executablePath: `bin/${id.startsWith('win-') ? 'codex.exe' : 'codex'}`,
}))
const copilotTargets = targetRecord(copilot, ([id, suffix, digest]) => ({
  id: id as RuntimeTargetId,
  url: `https://registry.npmjs.org/@github/copilot-${suffix}/-/copilot-${suffix}-1.0.71.tgz`,
  archive: 'tar.gz',
  hash: { algorithm: 'sha512', digest, encoding: 'base64' },
  downloadBytes: copilotArchiveBytes[id as RuntimeTargetId],
  maxDownloadBytes: downloadCap(copilotArchiveBytes[id as RuntimeTargetId]),
  // Measured on mac-arm64: 130.3 MB archive -> 277.5 MB extracted (~2.15x).
  unpackedBytes: Math.round(copilotArchiveBytes[id as RuntimeTargetId] * 2.15),
  stripPrefix: 'package',
  criticalPaths: [id.startsWith('win-') ? 'copilot.exe' : 'copilot', 'package.json', 'LICENSE.md'],
  executablePath: id.startsWith('win-') ? 'copilot.exe' : 'copilot',
}))
const tunnelTargets = targetRecord(tunnel, ([id, asset, digest]) => ({
  id: id as RuntimeTargetId,
  url: `https://persistent.oaistatic.com/tunnel-client/v0.0.10/tunnel-client-v0.0.10-${asset}.zip`,
  archive: 'zip',
  hash: { algorithm: 'sha256', digest, encoding: 'hex' },
  downloadBytes: 20_000_000,
  maxDownloadBytes: 20_000_000,
  unpackedBytes: 20_000_000,
  criticalPaths: [id.startsWith('win-') ? 'tunnel-client.exe' : 'tunnel-client'],
  executablePath: id.startsWith('win-') ? 'tunnel-client.exe' : 'tunnel-client',
}))
const localMlTargets = Object.freeze(
  Object.fromEntries(
    Object.entries(localMlManifest.targets).map(([id, target]) => [
      id,
      Object.freeze({
        id: id as RuntimeTargetId,
        url: `bundled:local-ml-runtime-${localMlManifest.version}-${id}.tar.gz`,
        archive: 'tar.gz' as const,
        hash: { algorithm: 'sha256' as const, digest: target.sha256, encoding: 'hex' as const },
        downloadBytes: target.archiveBytes,
        maxDownloadBytes: target.archiveBytes,
        unpackedBytes: target.unpackedBytes,
        criticalPaths: Object.freeze(target.criticalPaths),
      }),
    ])
  ) as Partial<Record<RuntimeTargetId, RuntimeAssetTarget>>
)

export const RUNTIME_ASSET_REGISTRY: Readonly<Record<RuntimeAssetId, RuntimeAssetDefinition>> = Object.freeze({
  'codex-runtime': Object.freeze({ id: 'codex-runtime', version: '0.153.2', targets: codexTargets }),
  'github-copilot-runtime': Object.freeze({ id: 'github-copilot-runtime', version: '1.0.71', targets: copilotTargets }),
  'tunnel-client': Object.freeze({ id: 'tunnel-client', version: '0.0.10', targets: tunnelTargets }),
  'local-ml-runtime': Object.freeze({
    id: 'local-ml-runtime',
    version: localMlManifest.version,
    targets: localMlTargets,
  }),
})

export function hostRuntimeTarget(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch
): RuntimeTargetId {
  const os = platform === 'darwin' ? 'mac' : platform === 'win32' ? 'win' : platform === 'linux' ? 'linux' : null
  if (!os || (arch !== 'arm64' && arch !== 'x64')) throw new Error(`Unsupported runtime target: ${platform}-${arch}`)
  return `${os}-${arch}` as RuntimeTargetId
}

export { TARGET_IDS as RUNTIME_TARGET_IDS }
