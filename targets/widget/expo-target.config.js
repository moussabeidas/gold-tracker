/** @type {(config: import("@bacons/apple-targets").ConfigFunction)} */
module.exports = (config) => ({
  type: "widget",
  name: "GoldWidget",
  // Appended to the main app id -> com.mbeidas.goldtracker.widget, matching
  // the widget provisioning profile.
  bundleIdentifier: ".widget",
  deploymentTarget: "16.1",
  appleTeamId: "P2TSL4VJ5H",
  entitlements: {
    "com.apple.security.application-groups": ["group.com.mbeidas.goldtracker"],
  },
  colors: {
    // Brand gold gradient, reused across every widget family.
    goldTop: { light: "#F6D66B", dark: "#F6D66B" },
    goldBottom: { light: "#C89B2C", dark: "#C89B2C" },
    widgetBg: { light: "#0B0B0F", dark: "#0B0B0F" },
    up: { light: "#2ECC71", dark: "#2ECC71" },
    down: { light: "#FF5A5A", dark: "#FF5A5A" },
  },
});
