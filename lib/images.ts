// Persistent storage for purchase photos. Image-picker URIs point into a
// temporary cache that iOS clears, and the app container path changes
// between updates — so we copy each photo into the documents directory and
// store a RELATIVE path, resolving it at render time.

import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

const IMAGE_DIR = "gold-images";

/** Copy a freshly picked photo into permanent storage; returns the value
 *  to persist (relative path), or the original URI if copying fails. */
export async function persistImage(tempUri: string): Promise<string> {
  if (Platform.OS === "web" || !FileSystem.documentDirectory) return tempUri;
  try {
    const dir = `${FileSystem.documentDirectory}${IMAGE_DIR}`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(
      () => {}
    );
    const ext = tempUri.split(".").pop()?.split("?")[0] ?? "jpg";
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    await FileSystem.copyAsync({ from: tempUri, to: `${dir}/${name}` });
    return `${IMAGE_DIR}/${name}`;
  } catch {
    return tempUri;
  }
}

/** Turn a stored value (relative path, or a legacy absolute URI) into a
 *  URI the Image component can display right now. */
export function resolveImageUri(stored?: string): string | undefined {
  if (!stored) return undefined;
  if (stored.includes("://")) return stored; // legacy absolute URI
  if (!FileSystem.documentDirectory) return undefined;
  return `${FileSystem.documentDirectory}${stored}`;
}
