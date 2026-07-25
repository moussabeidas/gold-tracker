---
name: emotion
description: Write and review styles with the Emotion CSS-in-JS library (@emotion/react, @emotion/styled, @emotion/native). Use this skill whenever the user asks to style components with Emotion, add or refactor styled components, use the css prop, set up theming with ThemeProvider/useTheme, animate with keyframes, or migrate StyleSheet/inline styles to CSS-in-JS — even if they just say "styled components" or "css-in-js" without naming Emotion. Also use it when installing or configuring Emotion in this Expo/React Native project.
---

# Emotion (CSS-in-JS)

Emotion is a performant CSS-in-JS library. This project is an **Expo / React Native app** (with react-native-web for web builds), which changes which Emotion package to reach for:

| Target | Package | What you get |
|---|---|---|
| React Native components (`View`, `Text`, …) | `@emotion/native` | `styled.View`, string or object styles compiled to RN style objects |
| Web-only React DOM code | `@emotion/react` + `@emotion/styled` | `css` prop, `styled.div`, real CSS (media queries, pseudo-classes) |

For anything rendered through React Native (which is nearly all of this app, including web via react-native-web), use `@emotion/native`. Only use `@emotion/react`'s `css` prop for genuinely DOM-only code.

## Installation

```bash
pnpm add @emotion/react @emotion/styled @emotion/native
```

All three depend on `@emotion/react` under the hood, so keep their versions aligned (same major, currently v11).

### css prop setup (web/DOM code only)

The `css` prop needs a JSX transform hook. In this project the cleanest option is the automatic-runtime import source, set per-file:

```tsx
/** @jsxImportSource @emotion/react */
```

or globally for DOM code via `babel.config.js`:

```js
presets: [
  ["babel-preset-expo", {
    unstable_transformImportMeta: true,
    jsxImportSource: "@emotion/react",
  }],
],
```

Note the project's existing `babel.config.js` already passes options to `babel-preset-expo` — add `jsxImportSource` to that options object rather than duplicating the preset. Setting it globally makes `@emotion/react` the import source for *all* JSX; that is safe (it falls back to normal React rendering when no `css` prop is present) but adds Emotion to every bundle path, so prefer the per-file pragma unless the css prop is used widely. Also add `"jsxImportSource": "@emotion/react"` to `tsconfig.json` `compilerOptions` if TypeScript complains about the `css` prop's types.

`styled` from either package needs **no** babel or tsconfig changes — if you only use `styled`, skip all of the above.

## Core patterns

### Styled components (React Native)

```tsx
import styled, { css } from "@emotion/native";

const Card = styled.View`
  background-color: ${(props) => props.theme.colors.surface};
  border-radius: 16px;
  padding: 16px;
`;

// Wrapping an existing component: it must accept a `style` prop.
const GoldValue = styled(CountUp)`
  color: #d4af37;
  font-variant: tabular-nums;
`;

// Object styles work too and are fully type-checked against RN styles:
const Row = styled.View((props) => ({
  flexDirection: "row",
  gap: 8,
  opacity: props.disabled ? 0.5 : 1,
}));
```

RN styles are not real CSS: no pseudo-classes, no descendant selectors, and media queries are unsupported — branch on `useWindowDimensions()` or `Platform.select` instead. String styles accept CSS-ish syntax (`background-color`, px units) and compile to RN style objects, so only RN-supported properties work.

### Styled components (web/DOM)

```tsx
import styled from "@emotion/styled";

const Button = styled.button<{ variant?: "primary" | "ghost" }>`
  border-radius: 8px;
  padding: 8px 16px;
  background: ${({ variant }) => (variant === "ghost" ? "transparent" : "#d4af37")};

  &:hover {
    filter: brightness(1.05);
  }

  @media (max-width: 600px) {
    width: 100%;
  }
`;
```

### The css prop (web/DOM)

```tsx
/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";

const panel = css`
  display: flex;
  gap: 12px;
`;

<div css={panel} />
<div css={{ color: "hotpink" }} />          // object styles
<div css={[panel, isActive && activeCss]} /> // arrays compose; later wins
```

Composition via arrays (or interpolating one `css` block inside another) is the idiomatic way to build variants — don't concatenate class name strings.

### Theming

Theming comes from `@emotion/react` and works for both DOM and native styled components:

```tsx
import { ThemeProvider } from "@emotion/react";

<ThemeProvider theme={theme}>{children}</ThemeProvider>
```

Consume it via `props.theme` in any styled component, or `useTheme()` in components. Type it once with declaration merging in `emotion.d.ts`:

```ts
import "@emotion/react";
declare module "@emotion/react" {
  export interface Theme {
    colors: { surface: string; text: string; accent: string };
  }
}
```

This project already has its palette in `constants/colors.ts` — build the `Theme` object from those values rather than inventing a parallel palette.

### Keyframes (web/DOM only)

```tsx
import { keyframes } from "@emotion/react";

const shimmer = keyframes`
  from { background-position: -200px 0; }
  to   { background-position: 200px 0; }
`;
```

`keyframes` does not exist in React Native — this project animates native components with `react-native-reanimated`, so keep using that for RN animation and reserve `keyframes` for DOM code.

## Rules that prevent real bugs

- **Define styled components at module scope, never inside render.** A styled component created during render is a new component type every render, so React unmounts/remounts its whole subtree (state loss, focus loss, jank). This also matters because the project uses the React Compiler.
- **Filter custom props on DOM elements.** Props consumed only by styles leak onto the DOM (`<button variant="ghost">` warnings). Either prefix them and use `shouldForwardProp`, or destructure them out in a wrapper:
  ```tsx
  const Button = styled("button", {
    shouldForwardProp: (prop) => prop !== "variant",
  })<{ variant?: string }>`...`;
  ```
- **Don't mix `@emotion/native` and `@emotion/styled` in one file.** They have identical APIs but target different renderers; importing the wrong one produces confusing runtime errors ("Cannot read property 'style' of undefined" or DOM tags rendered in native).
- **Interpolate values, not user input, into template literals.** Style strings are parsed, not sanitized.
- **Existing code uses `StyleSheet.create` / inline style objects.** When touching an existing component, don't half-migrate it — either convert the whole component to Emotion or stay with the existing pattern. Mixed styling in one component is harder to read than either style alone.

## When you need more depth

Read `references/api.md` for: the full `css`/`cx`/`ClassNames` APIs, `Global` styles, cache and SSR configuration, `as`-prop polymorphism, TypeScript generics for styled components, and testing with `@emotion/jest`.
