import type { PlatformProjectBinding } from '../../shared/platform'
import type { IpcRegistrar } from '../ipc-registrar'
import { platformConnections } from './connection-service'
import { platformProjectBindings } from './project-bindings'
import { embeddedRunnerHost } from './runner-host'

export function registerPlatformIpc(reg: IpcRegistrar): void {
  reg.handle('platform:list-connections', () => platformConnections.list())
  reg.mhandle('platform:add-connection', (_event, url: string) => platformConnections.add(url))
  reg.mhandle('platform:begin-device-auth', (_event, connectionId: string, clientId: string) => platformConnections.beginDeviceAuthorization(connectionId, clientId))
  reg.mhandle('platform:poll-device-auth', (_event, connectionId: string) => platformConnections.pollDeviceAuthorization(connectionId))
  reg.mhandle('platform:disconnect', async (_event, connectionId: string) => {await embeddedRunnerHost.stop();return platformConnections.disconnect(connectionId)})
  reg.handle('platform:list-remote-projects', (_event, connectionId: string) => platformConnections.listProjects(connectionId))
  reg.handle('platform:list-project-bindings', () => platformProjectBindings.list())
  reg.mhandle('platform:set-project-binding', async (_event, binding: PlatformProjectBinding) => {await embeddedRunnerHost.stop();return platformProjectBindings.set(binding)})
  reg.mhandle('platform:remove-project-binding', async (_event, workspaceId: string) => {await embeddedRunnerHost.stop();return platformProjectBindings.remove(workspaceId)})
  reg.handle('platform:runner-status', () => embeddedRunnerHost.status())
  reg.mhandle('platform:runner-start', (_event, connectionId: string) => embeddedRunnerHost.start(connectionId))
  reg.mhandle('platform:runner-stop', () => embeddedRunnerHost.stop())
}
