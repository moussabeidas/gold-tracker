import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Pro status mirrored to storage by SubscriptionProvider, for code that runs
 * outside React (background alert checks). Missing means not Pro.
 */
export const PRO_FLAG_KEY = "@gold_pro_entitled";

export async function isProEntitled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PRO_FLAG_KEY)) === "1";
  } catch {
    return false;
  }
}
