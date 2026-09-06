interface NpmInstallResult {
  status: number | null
  error?: Error
}

interface NpmCliOptions {
  platform?: NodeJS.Platform
  execPath?: string
  npmExecPath?: string
  exists?: (candidate: string) => boolean
}

interface LocalMlInstallOptions {
  cwd: string
  sourcePackage: string
  targetPlatform?: NodeJS.Platform
  targetArch?: string
  resolveNpm?: () => string
  exists?: (candidate: string) => boolean
  spawn?: (
    file: string,
    args: string[],
    options: { cwd: string; env: NodeJS.ProcessEnv; stdio: 'inherit'; shell: false }
  ) => NpmInstallResult
}

interface LocalMlDependencyStamp {
  schema: 2
  installTarget: string
  lockfileSha256: string
}

interface EnsureLocalMlOptions extends LocalMlInstallOptions {
  installTarget: string
  lockfilePath?: string
  stampPath?: string
  readFile?: (file: string, encoding?: BufferEncoding) => string | Uint8Array
  remove?: (path: string, options: { recursive: true; force: true }) => void
  writeFile?: (file: string, data: string) => void
}

export function npmCliCandidates(options?: NpmCliOptions): string[]
export function resolveNpmCli(options?: NpmCliOptions): string
export function installLocalMlDependencies(options: LocalMlInstallOptions): NpmInstallResult
export const LOCAL_ML_INSTALL_STAMP: string
export function ensureLocalMlDependencies(
  options: EnsureLocalMlOptions
): LocalMlDependencyStamp & { installed: boolean }
