#!/bin/bash
# Gold Tracker — EAS Build & App Store Submit Script
# Run this from your Mac inside the artifacts/gold-tracker directory
# Usage: bash build-and-submit.sh

set -e

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Gold Tracker — App Store Build Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check EAS CLI
if ! command -v eas &> /dev/null; then
  echo "Installing EAS CLI..."
  npm install -g eas-cli
fi

echo "EAS CLI version: $(eas --version)"
echo ""

# Require EXPO_TOKEN
if [ -z "$EXPO_TOKEN" ]; then
  echo "Enter your Expo access token (from expo.dev → Account Settings → Access Tokens):"
  read -s EXPO_TOKEN
  export EXPO_TOKEN
fi

echo "Verifying Expo credentials..."
eas whoami
echo ""

# Step 1 — Build
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Step 1: Building iOS app (15–20 min)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  • Follow prompts to confirm Apple Team & credentials"
echo "  • EAS will auto-generate your signing certificate"
echo ""
eas build --platform ios --profile production

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Step 2: Submitting to App Store Connect"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  • Use your App-Specific Password when prompted"
echo "  • Get one at: appleid.apple.com → Sign-In & Security"
echo ""
eas submit --platform ios --profile production --latest

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Done! Your build is submitted."
echo "  Check App Store Connect at:"
echo "  https://appstoreconnect.apple.com"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
