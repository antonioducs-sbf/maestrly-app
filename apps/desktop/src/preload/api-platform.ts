import { ipcRenderer } from 'electron'
import type { DeviceAuthorizationView, EmbeddedRunnerView, PlatformConnectionView, PlatformProjectBinding, RemotePlatformProject } from '../shared/platform'

export const platformApi = {
  platformListConnections: (): Promise<PlatformConnectionView[]> => ipcRenderer.invoke('platform:list-connections'),
  platformAddConnection: (url: string): Promise<PlatformConnectionView> => ipcRenderer.invoke('platform:add-connection', url),
  platformBeginDeviceAuthorization: (connectionId: string, clientId: string): Promise<DeviceAuthorizationView> => ipcRenderer.invoke('platform:begin-device-auth', connectionId, clientId),
  platformPollDeviceAuthorization: (connectionId: string): Promise<PlatformConnectionView> => ipcRenderer.invoke('platform:poll-device-auth', connectionId),
  platformDisconnect: (connectionId: string): Promise<PlatformConnectionView> => ipcRenderer.invoke('platform:disconnect', connectionId),
  platformListRemoteProjects: (connectionId: string): Promise<RemotePlatformProject[]> => ipcRenderer.invoke('platform:list-remote-projects', connectionId),
  platformListProjectBindings: (): Promise<PlatformProjectBinding[]> => ipcRenderer.invoke('platform:list-project-bindings'),
  platformSetProjectBinding: (binding: PlatformProjectBinding): Promise<void> => ipcRenderer.invoke('platform:set-project-binding', binding),
  platformRemoveProjectBinding: (workspaceId: string): Promise<void> => ipcRenderer.invoke('platform:remove-project-binding', workspaceId),
  platformRunnerStatus: (): Promise<EmbeddedRunnerView> => ipcRenderer.invoke('platform:runner-status'),
  platformRunnerStart: (connectionId: string): Promise<EmbeddedRunnerView> => ipcRenderer.invoke('platform:runner-start', connectionId),
  platformRunnerStop: (): Promise<void> => ipcRenderer.invoke('platform:runner-stop'),
}

export type PlatformApi = typeof platformApi
