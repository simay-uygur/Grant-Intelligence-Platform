export interface BackendInfo {
  appName: string;
  apiPrefix: string;
  version: string;
}

export interface BackendService {
  getInfo(): Promise<BackendInfo>;
}
