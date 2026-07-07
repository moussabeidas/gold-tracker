import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as SecureStore from "expo-secure-store";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { loginWithApple, setSessionToken, deleteBackendAccount } from "@/lib/api";

const USER_KEY = "auth_user_v2";

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  /** Erase the backend account record and all app data on this device. */
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  logout: async () => {},
  deleteAccount: async () => {},
});

async function readStoredUser(): Promise<User | null> {
  try {
    const raw =
      Platform.OS === "web"
        ? globalThis.localStorage?.getItem(USER_KEY)
        : await SecureStore.getItemAsync(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

async function writeStoredUser(user: User | null): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (user) globalThis.localStorage?.setItem(USER_KEY, JSON.stringify(user));
      else globalThis.localStorage?.removeItem(USER_KEY);
      return;
    }
    if (user) await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    else await SecureStore.deleteItemAsync(USER_KEY);
  } catch {
    // Storage unavailable — session simply won't persist.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore the session, and verify the Apple credential is still valid.
  useEffect(() => {
    (async () => {
      const stored = await readStoredUser();
      if (
        stored &&
        Platform.OS === "ios" &&
        !stored.id.startsWith("local:") &&
        (await AppleAuthentication.isAvailableAsync().catch(() => false))
      ) {
        try {
          const state = await AppleAuthentication.getCredentialStateAsync(stored.id);
          if (state === AppleAuthentication.AppleAuthenticationCredentialState.REVOKED) {
            await writeStoredUser(null);
            setUser(null);
            setIsLoading(false);
            return;
          }
        } catch {
          // Can't verify right now (offline, etc.) — keep the session.
        }
      }
      setUser(stored);
      setIsLoading(false);
    })();
  }, []);

  const login = useCallback(async () => {
    const useApple =
      Platform.OS === "ios" &&
      (await AppleAuthentication.isAvailableAsync().catch(() => false));

    if (useApple) {
      try {
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
        // Apple only shares name/email on the FIRST authorization for an
        // account. On re-auth they come back null — keep what we stored.
        const previous = await readStoredUser();
        const samePerson = previous?.id === credential.user;
        const next: User = {
          id: credential.user,
          email:
            credential.email ?? (samePerson ? previous?.email ?? null : null),
          firstName:
            credential.fullName?.givenName ??
            (samePerson ? previous?.firstName ?? null : null),
          lastName:
            credential.fullName?.familyName ??
            (samePerson ? previous?.lastName ?? null : null),
          profileImageUrl: null,
        };
        await writeStoredUser(next);
        setUser(next);
        // Establish a backend session too (fire-and-forget; the app is
        // fully functional without the server).
        if (credential.identityToken) {
          loginWithApple({
            identityToken: credential.identityToken,
            firstName: next.firstName,
            lastName: next.lastName,
          }).catch(() => {});
        }
      } catch (err: any) {
        // ERR_REQUEST_CANCELED = user dismissed the sheet; not an error.
        if (err?.code !== "ERR_REQUEST_CANCELED") {
          console.error("Apple sign-in error:", err);
        }
      }
      return;
    }

    // Android / web / simulators without Apple auth: local on-device profile.
    const next: User = {
      id: "local:default",
      email: null,
      firstName: "My",
      lastName: "Portfolio",
      profileImageUrl: null,
    };
    await writeStoredUser(next);
    setUser(next);
  }, []);

  const logout = useCallback(async () => {
    await writeStoredUser(null);
    await setSessionToken(null).catch(() => {});
    setUser(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    // Server record first (needs the still-valid session), then the device.
    await deleteBackendAccount().catch(() => {});
    try {
      const keys = await AsyncStorage.getAllKeys();
      const appKeys = keys.filter((k) => k.startsWith("@gold_"));
      if (appKeys.length) await AsyncStorage.multiRemove(appKeys);
    } catch {}
    await setSessionToken(null).catch(() => {});
    await writeStoredUser(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
