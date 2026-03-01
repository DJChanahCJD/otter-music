import { API_URL, unwrap } from "./config";

const UPDATE_API_URL = `${API_URL}/update`;

export interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  changelog: string;
  downloadUrl: string;
  directUrl: string;
  publishDate: string;
  size: number;
}

/**
 * 检查更新
 */
export async function checkUpdate(currentVersion: string): Promise<UpdateInfo> {
  return unwrap<UpdateInfo>(
    fetch(`${UPDATE_API_URL}/check?version=${currentVersion}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })
  );
}
