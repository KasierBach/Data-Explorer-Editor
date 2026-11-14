export interface BrowserBuildBinding {
  formatVersion: 1;
  releaseSha: string;
  treeSha: string;
  runId: string;
  runAttempt: string;
  lockSha256: string;
  nodeVersion: string;
  playwrightVersion: string;
  apiUrl: string;
  variant: string;
}

export function readBrowserBinding(clientRoot?: string, env?: NodeJS.ProcessEnv): Promise<BrowserBuildBinding>;
export function verifyBuild(directory: string, context: BrowserBuildBinding, installed?: boolean, clientRoot?: string): Promise<unknown>;
