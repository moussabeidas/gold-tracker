#!/usr/bin/env python3
"""Force manual code signing per target in the prebuilt Xcode project.

Both provisioning profiles are named "Gold Tracker Production", so a single
global PROVISIONING_PROFILE_SPECIFIER on the xcodebuild command line can't
disambiguate app vs. widget. Instead we bake the correct profile UUID into
each target's build settings after `expo prebuild`. Run from the repo root:

    python3 store-assets/fix-signing.py ios/GoldPricer.xcodeproj/project.pbxproj
"""
import glob
import os
import re
import sys

TEAM = "P2TSL4VJ5H"
PROFILES = {
    "com.mbeidas.goldtracker": "d8bf8019-3253-49ab-a5ad-a6206826569b",
    "com.mbeidas.goldtracker.widget": "7506be31-7892-4275-a341-89ba8a06237b",
}

DESIRED = {
    "CODE_SIGN_STYLE": "Manual",
    "DEVELOPMENT_TEAM": TEAM,
    "CODE_SIGN_IDENTITY": '"Apple Distribution"',
}


def patch_block(body: str, bundle_id: str) -> str:
    settings = dict(DESIRED)
    settings["PROVISIONING_PROFILE_SPECIFIER"] = f'"{PROFILES[bundle_id]}"'

    # Match the indentation used by the surrounding keys.
    indent_match = re.search(r"\n(\t+)[A-Za-z_]", body)
    indent = indent_match.group(1) if indent_match else "\t\t\t\t"

    # Drop the automatic-signing UUID key so it can't override the specifier.
    body = re.sub(r"[ \t]*PROVISIONING_PROFILE = [^;]+;\n?", "", body)

    for key, value in settings.items():
        pattern = re.compile(rf"([ \t]*{re.escape(key)} = )[^;]+;")
        if pattern.search(body):
            body = pattern.sub(lambda m: f"{m.group(1)}{value};", body, count=1)
        else:
            # Insert right after the opening brace of the buildSettings dict.
            body = body.replace("{", f"{{\n{indent}{key} = {value};", 1)
    return body


def strip_push_entitlement(pbxproj_path: str) -> None:
    """Remove aps-environment from the app's entitlements.

    expo-notifications' autolinked config plugin injects it, but we only use
    LOCAL notifications — no push — and the distribution profile doesn't
    carry the Push Notifications capability, so archiving fails with it in.
    """
    ios_dir = os.path.dirname(os.path.dirname(pbxproj_path))
    root = os.path.dirname(ios_dir)
    for ent in glob.glob(os.path.join(root, "ios", "*", "*.entitlements")):
        text = open(ent).read()
        cleaned = re.sub(
            r"[ \t]*<key>aps-environment</key>\s*<string>[^<]*</string>\n?",
            "",
            text,
        )
        if cleaned != text:
            open(ent, "w").write(cleaned)
            print(f"Stripped aps-environment from {ent}")


def main(path: str) -> None:
    text = open(path).read()
    patched = 0

    def repl(match: "re.Match") -> str:
        nonlocal patched
        whole = match.group(0)
        bundle = re.search(r"PRODUCT_BUNDLE_IDENTIFIER = \"?([^\";]+)\"?;", whole)
        if not bundle or bundle.group(1) not in PROFILES:
            return whole
        patched += 1
        return "buildSettings = " + patch_block(match.group(1), bundle.group(1)) + ";"

    text = re.sub(r"buildSettings = (\{.*?\});", repl, text, flags=re.S)

    if patched == 0:
        print("ERROR: no matching targets found — signing not applied", file=sys.stderr)
        sys.exit(1)

    open(path, "w").write(text)
    print(f"Patched manual signing on {patched} build configuration(s).")
    strip_push_entitlement(path)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "ios/GoldPricer.xcodeproj/project.pbxproj")
