# Gold Tracker – Apple App Store Submission Guide

## What's ready (in this folder)

| File | Purpose |
|------|---------|
| `icon-1024.svg` | 1024×1024 App Icon (convert to PNG for upload) |
| `screenshot-01-chart.html` | Screenshot 1 – Live Gold Prices |
| `screenshot-02-portfolio.html` | Screenshot 2 – Portfolio |
| `screenshot-03-analytics.html` | Screenshot 3 – Analytics |
| `screenshot-04-add.html` | Screenshot 4 – Add Holding |
| `screenshot-05-paywall.html` | Screenshot 5 – Go Pro |

## Step-by-step submission

### Prerequisites
- Apple Developer Program membership ($99/yr) → https://developer.apple.com/programs/
- Expo account (free) → https://expo.dev/signup
- Node.js installed locally

### 1. Convert the SVG icon to PNG
Open `icon-1024.svg` in a browser and save as PNG, or use:
```bash
# macOS (requires Inkscape or rsvg-convert)
rsvg-convert -w 1024 -h 1024 icon-1024.svg -o icon-1024.png
```

### 2. Capture screenshots at correct resolution
Open each `.html` file in Chrome, set Device toolbar to iPhone 15 Pro Max
(430×932 logical → 1290×2796 @3x), then use the browser's "Capture screenshot"
or a tool like https://screenshotone.com.

### 3. Install EAS CLI
```bash
npm install -g @expo/eas-cli
eas login
```

### 4. Configure credentials
Edit `eas.json` – fill in your:
- `appleId` – your Apple ID email
- `ascAppId` – App Store Connect App ID (create at https://appstoreconnect.apple.com)
- `appleTeamId` – your 10-character Apple Team ID

### 5. Build for production
```bash
cd artifacts/gold-tracker
eas build --platform ios --profile production
```
This uploads the code to Expo's build servers and produces a signed `.ipa` file.
Takes ~10-20 minutes.

### 6. Submit to App Store
```bash
eas submit --platform ios --profile production
```
EAS Submit uploads the `.ipa` directly to App Store Connect.

### 7. Complete in App Store Connect (https://appstoreconnect.apple.com)
- **App information**: Set category (Finance), age rating, content rights
- **Pricing**: Free (with in-app purchases for Pro tier)
- **App Review Information**: Add a test account or note that login is optional
- **Screenshots**: Upload all 5 screenshots (for 6.7" and/or 6.9" iPhone)
- **App icon**: Upload `icon-1024.png`
- **Description** (pre-written):

> Track live gold (XAU/USD) prices and manage your physical gold portfolio with  
> the precision of a professional trader. Gold Tracker brings real-time spot  
> prices, interactive scrubable charts, and complete portfolio management — all  
> in a beautiful dark interface inspired by Apple Stocks.
>
> KEY FEATURES  
> • Live XAU/USD price with interactive 1D / 1W / 1M / 3M / 1Y / 5Y charts  
> • Scrub the chart to see price at any historical point  
> • Add physical holdings: photograph your bar or coin, enter weight & price  
> • Live portfolio valuation updated with every gold price tick  
> • Gain/loss analytics: total return, best performer, allocation breakdown  
> • Watchlist for precious metals & commodity prices  
> • Freemium: 2 holdings free, unlimited with Gold Pro  
>
> GOLD PRO  
> • Unlimited holdings  
> • Advanced analytics & allocation charts  
> • Price alerts  
> • iCloud backup  
> Plans from $4.99/month · Annual $29.99 · Lifetime $79.99

- **Keywords**: gold price, XAU USD, gold tracker, precious metals, portfolio, spot price, bullion

### 8. Submit for review
Click "Add for Review" → Apple reviews in 1-3 business days.

## Bundle ID
`com.goldtracker.app`

## Version
`1.0.0` (build 1)
