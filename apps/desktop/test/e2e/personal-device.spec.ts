import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  PlatformConnectionView,
  DeviceAuthorizationView,
  EmbeddedRunnerView,
  PlatformProjectBinding,
} from '../../src/shared/platform'

declare const window: {
  api: {
    addWorkspace(dir: string): Promise<{ id: string }>
    platformAddConnection(url: string): Promise<PlatformConnectionView>
    platformBeginDeviceAuthorization(id: string, clientId: string): Promise<DeviceAuthorizationView>
    platformPollDeviceAuthorization(id: string): Promise<PlatformConnectionView>
    platformSetProjectBinding(binding: PlatformProjectBinding): Promise<void>
    platformRunnerStart(id: string): Promise<EmbeddedRunnerView>
    platformRunnerStop(): Promise<void>
    platformDisconnect(id: string): Promise<PlatformConnectionView>
    setLocale(locale: string): Promise<void>
  }
}
const desktop = fileURLToPath(new URL('../..', import.meta.url))
test('pairs the real desktop, exposes only an owner device and disables it on disconnect', async ({
  request,
}, info) => {
  test.skip(!process.env.MAESTRLY_LIVE_E2E, 'Requires scripts/test-kanban-e2e.mjs with MAESTRLY_DESKTOP_E2E=1.')
  const root = await mkdtemp(path.join(os.tmpdir(), 'maestrly-personal-desktop-')),
    server = process.env.MAESTRLY_SERVER_URL!
  let app: Awaited<ReturnType<typeof electron.launch>> | undefined
  try {
    const signedIn = await request.post(server + '/api/auth/sign-in/email', {
      data: { email: process.env.MAESTRLY_E2E_EMAIL, password: process.env.MAESTRLY_E2E_PASSWORD },
    })
    expect(signedIn.status()).toBe(200)
    const headers = { 'x-maestrly-protocol-version': '1.0', 'idempotency-key': crypto.randomUUID() }
    const orgs = await (await request.get(server + '/api/v1/organizations', { headers })).json()
    const organizationId = orgs[0].id
    const created = await (
      await request.post(server + '/api/v1/organizations/' + organizationId + '/projects', {
        headers,
        data: { name: 'Desktop personal fixture' },
      })
    ).json()
    execFileSync('git', ['init', '-q', root])
    execFileSync('git', [
      '-C',
      root,
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.test',
      'commit',
      '--allow-empty',
      '-qm',
      'Fixture',
    ])
    app = await electron.launch({
      args: [path.join(desktop, 'out/main/index.js')],
      env: {
        ...process.env,
        AGENTS_E2E: '1',
        AGENTS_CHANNEL: 'dev',
        AGENTS_INSTANCE: 'personal-test',
        AGENTS_USERDATA: path.join(root, 'profile'),
        AGENTS_LOCALE: 'en',
        ELECTRON_RENDERER_URL: '',
        OPENAI_API_KEY: '',
        ANTHROPIC_API_KEY: '',
      },
    })
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'Skip', exact: true }).click()
    const connection = await page.evaluate((url) => window.api.platformAddConnection(url), server)
    expect(connection.desktopClientId).toBe('maestrly-desktop-personal-v1')
    const pending = await page.evaluate((id) => window.api.platformBeginDeviceAuthorization(id, ''), connection.id)
    const reviewed=await request.get(server+'/api/auth/device?user_code='+encodeURIComponent(pending.userCode))
    expect(reviewed.status(),reviewed.status()===200?'':await reviewed.text()).toBe(200)
    const approved = await request.post(server + '/api/auth/device/approve', { data: { userCode: pending.userCode } })
    expect(approved.status(),approved.status()===200?'':await approved.text()).toBe(200)
    await expect
      .poll(
        async () => {
          const result = await page.evaluate((id) => window.api.platformPollDeviceAuthorization(id), connection.id)
          return result.state
        },
        { timeout: 20000, intervals: [1100] }
      )
      .toBe('connected')
    const workspace = await page.evaluate((dir) => window.api.addWorkspace(dir), root)
    await page.evaluate((binding) => window.api.platformSetProjectBinding(binding), {
      workspaceId: workspace.id,
      connectionId: connection.id,
      organizationId,
      projectId: created.project.id,
      boardId: created.boardId,
    })
    const state = await page.evaluate((id) => window.api.platformRunnerStart(id), connection.id)
    expect(state.state, state.error).toBe('running')
    expect(state.deviceId).toBeTruthy()
    const devicesUrl =
      server + '/api/v1/organizations/' + organizationId + '/projects/' + created.project.id + '/personal-devices'
    await expect
      .poll(
        async () => {
          const devices = await (await request.get(devicesUrl, { headers })).json()
          return devices[0]?.online
        },
        { timeout: 15000 }
      )
      .toBe(true)
    const shared = await (
      await request.get(
        server + '/api/v1/organizations/' + organizationId + '/projects/' + created.project.id + '/runners',
        { headers }
      )
    ).json()
    expect(shared).toEqual([])
    await page.getByTitle('Settings').click()
    // The platform tab already exists; new controls clearly describe personal ownership.
    await page.getByRole('button', { name: /Platform/ }).click()
    await expect(page.getByText('Enable personal execution on this computer', { exact: true })).toBeVisible()
    await page.screenshot({ path: info.outputPath('personal-desktop-en.png') })
    await page.evaluate(() => window.api.setLocale('pt-BR'))
    await expect(page.getByText('Habilitar execução pessoal neste computador', { exact: true })).toBeVisible()
    await page.screenshot({ path: info.outputPath('personal-desktop-pt.png') })
    await page.evaluate((id) => window.api.platformDisconnect(id), connection.id)
    const stopped = await (await request.get(devicesUrl, { headers })).json()
    expect(stopped[0]).toMatchObject({ online: false, enabled: false })
  } finally {
    await app?.close()
    await rm(root, { recursive: true, force: true })
  }
})
