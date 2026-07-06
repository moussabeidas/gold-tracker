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
import {
  inviteCodeForUser,
  mintClaimToken,
  verifyClaimToken,
  isValidInviteCodeFormat,
  REFERRAL_TARGET,
  PRO_REWARD_MONTHS,
} from "@/lib/referral";

interface ReferralState {
  /** Claim-token nonces already credited (one per friend). */
  claimedNonces: string[];
  /** Invite code this user redeemed as an invitee (their side of the deal). */
  redeemedCode: string | null;
  /** Epoch ms until which the 10-referral Pro reward runs (0 = none). */
  proUntil: number;
}

interface ReferralContextValue {
  /** My shareable invite code. */
  inviteCode: string;
  /** Verified referrals so far. */
  referredCount: number;
  /** Extra portfolio slots earned (referrals made + code redeemed). */
  bonusSlots: number;
  /** True while the 6-month Pro reward is active. */
  hasReferralPro: boolean;
  proUntil: number;
  /** As the invitee: redeem a friend's code → returns my claim token. */
  redeemInviteCode: (code: string) => Promise<string | null>;
  redeemedCode: string | null;
  /** As the referrer: enter a friend's claim token → credit the referral. */
  claimReferral: (token: string) => Promise<"ok" | "invalid" | "duplicate">;
}

const EMPTY: ReferralState = { claimedNonces: [], redeemedCode: null, proUntil: 0 };

const ReferralContext = createContext<ReferralContextValue>({
  inviteCode: "",
  referredCount: 0,
  bonusSlots: 0,
  hasReferralPro: false,
  proUntil: 0,
  redeemInviteCode: async () => null,
  redeemedCode: null,
  claimReferral: async () => "invalid",
});

const STORAGE_KEY = "@gold_referrals_v1";

export function ReferralProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? "anonymous";
  const storageKey = `${STORAGE_KEY}_${userId}`;

  const [state, setState] = useState<ReferralState>(EMPTY);

  useEffect(() => {
    AsyncStorage.getItem(storageKey)
      .then((raw) => setState(raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY))
      .catch(() => setState(EMPTY));
  }, [storageKey]);

  const persist = useCallback(
    (next: ReferralState) => {
      setState(next);
      AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
    },
    [storageKey]
  );

  const inviteCode = useMemo(() => inviteCodeForUser(userId), [userId]);

  const redeemInviteCode = useCallback(
    async (code: string): Promise<string | null> => {
      if (!isValidInviteCodeFormat(code)) return null;
      const cleaned = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (cleaned === inviteCode) return null; // no self-referrals
      const token = mintClaimToken(cleaned, userId);
      persist({ ...state, redeemedCode: cleaned });
      return token;
    },
    [inviteCode, userId, state, persist]
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
      return "ok";
    },
    [inviteCode, state, persist]
  );

  const referredCount = state.claimedNonces.length;
  const hasReferralPro = state.proUntil > Date.now();

  const value = useMemo(
    () => ({
      inviteCode,
      referredCount,
      bonusSlots: referredCount + (state.redeemedCode ? 1 : 0),
      hasReferralPro,
      proUntil: state.proUntil,
      redeemInviteCode,
      redeemedCode: state.redeemedCode,
      claimReferral,
    }),
    [
      inviteCode,
      referredCount,
      state.redeemedCode,
      state.proUntil,
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
