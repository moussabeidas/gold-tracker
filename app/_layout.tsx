import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SplashAnimation } from "@/components/SplashAnimation";
import { StatusBarBlur } from "@/components/StatusBarBlur";
import Colors from "@/constants/colors";
import { AuthProvider } from "@/lib/auth";
import { PortfolioProvider } from "@/context/PortfolioContext";
import { SubscriptionProvider } from "@/context/SubscriptionContext";
import { useAuth } from "@/lib/auth";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function PortfolioWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <PortfolioProvider userId={user?.id}>{children}</PortfolioProvider>
  );
}

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.dark.background },
        animation: "fade",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen
        name="add-purchase"
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: Colors.dark.background },
        }}
      />
      <Stack.Screen
        name="paywall"
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: Colors.dark.background },
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [showCustomSplash, setShowCustomSplash] = useState(true);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      // Hide native splash immediately; our custom one takes over
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView
            style={{ flex: 1, backgroundColor: Colors.dark.background }}
          >
            <KeyboardProvider>
              <AuthProvider>
                <SubscriptionProvider>
                  <PortfolioWrapper>
                    <StatusBar style="light" />
                    <RootLayoutNav />
                    <StatusBarBlur />
                    {showCustomSplash && (
                      <SplashAnimation onFinish={() => setShowCustomSplash(false)} />
                    )}
                  </PortfolioWrapper>
                </SubscriptionProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
