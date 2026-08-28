import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAuth } from "@/lib/auth";
import { api, apiEnabled } from "@/lib/api";
import { track } from "@/lib/analytics";
import {
  inviteCodeForUser,
  mintClaimToken,
  verifyClaimToken,
  isValidInviteCodeFormat,
  REFERRAL_TARGET,
  PRO_REWARD_MONTHS,
} from "@/lib/referral";

interface ServerReferralStatus {
  inviteCode: string;
  referredCount: number;
  redeemedCode: boolean;
  proEarned: boolean;
}

interface ReferralState {
  /** Claim-token nonces already credited (one per friend). */
  claimedNonces: string[];
  /** Invite code this user redeemed as an invitee (their side of the deal). */
  redeemedCode: string | null;
  /** Epoch ms until which the 10-referral Pro reward runs (0 = none). */
  proUntil: number;
  /**
   * Offline-handshake claim token minted when this user redeemed a code
   * without the server — shared back to the referrer as a thanks link.
   */
  thanksToken: string | null;
}

interface ReferralContextValue {
  /** My shareable invite code (server-issued when available). */
  inviteCode: string;
  /** Verified referrals so far. */
  referredCount: number;
  /** Extra portfolio slots earned (referrals made + code redeemed). */
  bonusSlots: number;
  /** True while the 6-month Pro reward is active. */
  hasReferralPro: boolean;
  proUntil: number;
  /**
   * As the invitee: redeem a friend's code. Returns "server" when the
   * backend verified it (friend credited automatically), a claim token
   * for the offline handshake, or null if invalid.
   */
  redeemInviteCode: (code: string) => Promise<string | null>;
  redeemedCode: string | null;
  /** As the referrer: enter a friend's claim token → credit the referral. */
  claimReferral: (token: string) => Promise<"ok" | "invalid" | "duplicate">;
  /** Offline-path claim token still owed to the referrer (null when none). */
  thanksToken: string | null;
}

const EMPTY: ReferralState = {
  claimedNonces: [],
  redeemedCode: null,
  proUntil: 0,
  thanksToken: null,
};

const ReferralContext = createContext<ReferralContextValue>({
  inviteCode: "",
  referredCount: 0,
  bonusSlots: 0,
  hasReferralPro: false,
  proUntil: 0,
  redeemInviteCode: async () => null,
  redeemedCode: null,
  claimReferral: async () => "invalid",
  thanksToken: null,
});

/** Invite code captured from a tapped link before the user signed in. */
const PENDING_INVITE_KEY = "@gold_pending_invite_v1";

export async function storePendingInvite(code: string): Promise<void> {
  await AsyncStorage.setItem(PENDING_INVITE_KEY, code).catch(() => {});
}

const STORAGE_KEY = "@gold_referrals_v1";

export function ReferralProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? "anonymous";
  const storageKey = `${STORAGE_KEY}_${userId}`;

  const [state, setState] = useState<ReferralState>(EMPTY);
  const [server, setServer] = useState<ServerReferralStatus | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(storageKey)
      .then((raw) => setState(raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY))
      .catch(() => setState(EMPTY));
  }, [storageKey]);

  // When a backend is configured, it is the source of truth for verified
  // referrals — refresh on sign-in and keep the local ledger as fallback.
  useEffect(() => {
    if (!apiEnabled()) return;
    let cancelled = false;
    api<ServerReferralStatus>("/v1/referrals/status").then((status) => {
      if (!cancelled && status) setServer(status);
    });
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const persist = useCallback(
    (next: ReferralState) => {
      setState(next);
      AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
    },
    [storageKey]
  );

  const inviteCode = useMemo(() => inviteCodeForUser(userId), [userId]);

  // A link tapped before sign-in parks its code; redeem it once a real
  // user exists so the invitee never has to re-tap anything.
  useEffect(() => {
    if (userId === "anonymous" || state.redeemedCode) return;
    let cancelled = false;
    AsyncStorage.getItem(PENDING_INVITE_KEY)
      .then(async (code) => {
        if (cancelled || !code) return;
        await AsyncStorage.removeItem(PENDING_INVITE_KEY).catch(() => {});
        await redeemInviteCode(code);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, state.redeemedCode]);

  const redeemInviteCode = useCallback(
    async (code: string): Promise<string | null> => {
      if (!isValidInviteCodeFormat(code)) return null;
      const cleaned = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (cleaned === inviteCode || cleaned === server?.inviteCode) {
        return null; // no self-referrals
      }

      // Server-verified path: the friend is credited automatically.
      if (apiEnabled()) {
        const result = await api<{ ok: boolean }>("/v1/referrals/redeem", {
          method: "POST",
          body: { code: cleaned },
        });
        if (result?.ok) {
          persist({ ...state, redeemedCode: cleaned });
          track("referral_redeemed", { code: cleaned, mode: "server" });
          const status = await api<ServerReferralStatus>("/v1/referrals/status");
          if (status) setServer(status);
          return "server";
        }
      }

      // Offline handshake fallback.
      const token = mintClaimToken(cleaned, userId);
      persist({ ...state, redeemedCode: cleaned, thanksToken: token });
      track("referral_redeemed", { code: cleaned, mode: "offline" });
      return token;
    },
    [inviteCode, server?.inviteCode, userId, state, persist]
  );

  const claimReferral = useCallback(
    async (token: string): Promise<"ok" | "invalid" | "duplicate"> => {
      const nonce = verifyClaimToken(inviteCode, token);
      if (!nonce) return "invalid";
      if (state.claimedNonces.includes(nonce)) return "duplicate";
      const claimedNonces = [...state.claimedNonces, nonce];
      let proUntil = state.proUntil;
      if (claimedNonces.length >= REFERRAL_TARGET && proUntil === 0) {
        const d = new Date();
        d.setMonth(d.getMonth() + PRO_REWARD_MONTHS);
        proUntil = d.getTime();
      }
      persist({ ...state, claimedNonces, proUntil });
      track("referral_credited", { count: claimedNonces.length });
      return "ok";
    },
    [inviteCode, state, persist]
  );

  // Server counts win when present; the local ledger covers offline use.
  const referredCount = Math.max(
    state.claimedNonces.length,
    server?.referredCount ?? 0
  );
  const redeemed = state.redeemedCode ?? (server?.redeemedCode ? "server" : null);

  // The 10-friend Pro reward: grant locally the moment either ledger
  // crosses the target.
  useEffect(() => {
    if (referredCount >= REFERRAL_TARGET && state.proUntil === 0) {
      const d = new Date();
      d.setMonth(d.getMonth() + PRO_REWARD_MONTHS);
      persist({ ...state, proUntil: d.getTime() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referredCount, state.proUntil]);

  const hasReferralPro = state.proUntil > Date.now();

  const value = useMemo(
    () => ({
      inviteCode: server?.inviteCode ?? inviteCode,
      referredCount,
      bonusSlots: referredCount + (redeemed ? 1 : 0),
      hasReferralPro,
      proUntil: state.proUntil,
      redeemInviteCode,
      redeemedCode: redeemed,
      claimReferral,
      thanksToken: state.thanksToken,
    }),
    [
      server?.inviteCode,
      inviteCode,
      referredCount,
      redeemed,
      state.proUntil,
      state.thanksToken,
      hasReferralPro,
      redeemInviteCode,
      claimReferral,
    ]
  );

  return (
    <ReferralContext.Provider value={value}>{children}</ReferralContext.Provider>
  );
}

export function useReferral(): ReferralContextValue {
  return useContext(ReferralContext);
}
