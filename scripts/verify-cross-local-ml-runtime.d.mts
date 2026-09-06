export interface CrossLocalMlRuntimeVerificationOptions {
  archive: string
  sidecar?: string
  target: string
}

export interface CrossLocalMlRuntimeVerificationResult {
  archive: string
  sidecar: string
  target: string
  files: number
  peFiles: number
  bytes: number
  unpackedBytes: number
  sha256: string
}

export function assertWindowsX64Pe(header: Buffer, archivePath: string): void
export function verifyCrossLocalMlRuntime(
  options: CrossLocalMlRuntimeVerificationOptions
): Promise<CrossLocalMlRuntimeVerificationResult>
