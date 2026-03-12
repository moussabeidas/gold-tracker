import React from "react";
import { router } from "expo-router";
import { PaywallScreen } from "@/components/PaywallScreen";

export default function PaywallRoute() {
  return <PaywallScreen onDismiss={() => router.back()} />;
}
