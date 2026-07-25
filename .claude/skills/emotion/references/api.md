# Emotion API reference (advanced)

Contents: [Global styles](#global-styles) · [ClassNames / cx](#classnames--cx) · [Polymorphism with `as`](#polymorphism-with-as) · [TypeScript patterns](#typescript-patterns) · [Cache & SSR](#cache--ssr) · [Testing](#testing) · [Performance notes](#performance-notes)

## Global styles

Web/DOM only. Inject global CSS (resets, font-faces, CSS variables) with the `Global` component:

```tsx
import { Global, css } from "@emotion/react";

<Global
  styles={css`
    :root {
      --accent: #d4af37;
    }
    body {
      margin: 0;
      font-family: "Inter", sans-serif;
    }
  `}
/>
```

Mount it once near the app root. Unmounting removes the styles, which makes it useful for scoped global effects (e.g. `body { overflow: hidden }` while a modal is open).

## ClassNames / cx

For passing Emotion-generated class names to third-party components that expect a `className` string:

```tsx
import { ClassNames } from "@emotion/react";

<ClassNames>
  {({ css, cx }) => (
    <ThirdParty
      className={cx(
        css`color: hotpink;`,
        isActive && css`font-weight: 600;`,
      )}
    />
  )}
</ClassNames>
```

`cx` merges class names with correct Emotion specificity (later arguments win). Only reach for this when a `css` prop or `styled` wrapper can't work.

## Polymorphism with `as`

Every styled component (DOM and native) accepts an `as` prop to swap the rendered element while keeping the styles:

```tsx
const Label = styled.span`font-size: 12px;`;
<Label as="label" htmlFor="amount">Amount</Label>
```

TypeScript narrows the accepted props to the `as` target. Prefer `as` over creating a second styled component with identical styles.

## TypeScript patterns

**Prop generics** — declare style-only props inline:

```tsx
const Bar = styled.View<{ pct: number }>`
  width: ${({ pct }) => `${pct}%`};
`;
```

**Reusable style fragments** — type them as the framework expects:

```tsx
// DOM
import { css, type SerializedStyles } from "@emotion/react";
const truncate: SerializedStyles = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

// React Native — css from @emotion/native returns a ReactNative style object
import { css } from "@emotion/native";
const shadow = css`
  shadow-color: #000;
  shadow-opacity: 0.15;
  shadow-radius: 12px;
`;
```

**Theme typing** — one `emotion.d.ts` with `declare module "@emotion/react"` (see SKILL.md). Both `@emotion/styled` and `@emotion/native` pick it up automatically; never re-declare `Theme` per file.

**Typing `shouldForwardProp`** — use the `@emotion/is-prop-valid` package to forward only valid DOM attributes wholesale:

```tsx
import isPropValid from "@emotion/is-prop-valid";
const Styled = styled("div", { shouldForwardProp: isPropValid })`...`;
```

## Cache & SSR

Web only. Emotion inserts styles through a cache; the default cache is created automatically. Create a custom cache only when you need to:

- change the insertion point (e.g. inject before a CSP nonce'd tag or a legacy stylesheet you must override),
- add a `nonce` for Content-Security-Policy,
- change the class prefix, or
- enable/disable vendor-prefixing via `stylisPlugins`.

```tsx
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";

const cache = createCache({ key: "gt", nonce });
<CacheProvider value={cache}>{app}</CacheProvider>
```

For streaming SSR or extracting critical CSS, use `@emotion/server` (`extractCriticalToChunks` + `constructStyleTagsFromChunks`) against the same cache key. Expo web static rendering does not need this by default — zero-config Emotion works client-side; only add `@emotion/server` if a custom Node SSR pipeline is introduced.

## Testing

Add `@emotion/jest` for style-aware snapshots and matchers:

```ts
// jest setup
import { createSerializer, matchers } from "@emotion/jest";
expect.addSnapshotSerializer(createSerializer());
expect.extend(matchers);
```

```ts
expect(container.firstChild).toHaveStyleRule("color", "hotpink");
expect(container.firstChild).toHaveStyleRule("width", "100%", {
  media: "(max-width: 600px)",
});
```

Without the serializer, snapshots contain hashed class names (`css-1a2b3c`) that churn on every style edit — always install it before snapshotting styled output.

## Performance notes

- `styled` components hash their styles once per unique interpolation result; dynamic styles that interpolate rapidly-changing values (scroll position, gesture state) generate a new class per frame on web. For animation-rate values use CSS variables (`style={{ "--x": x }}` consumed by the styled rules) on DOM, or `react-native-reanimated` on native — never per-frame Emotion interpolations.
- Object styles skip the CSS string parser and are marginally faster than template literals; both are fine outside hot paths. Pick per file for readability and stay consistent.
- The `css` prop composes without wrapper components; prefer it over nesting multiple `styled` wrappers purely for composition on web.
