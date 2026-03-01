# Project Specification: Option Intel

> **Status:** IN REVIEW
> **Created:** 2026-02-27
> **Last Updated:** 2026-02-27

---

## Executive Summary

**Option Intel** is a mobile-first progressive web application that provides institutional-grade stock screening and intelligent options strategy identification. It screens stocks by configurable criteria (volume, market cap, IV rank), scans their full option chains via the Massive.com API, and recommends high-probability strategies with clear, novice-friendly explainers detailing *why* each strategy, strike, and maturity was chosen using Greeks and probability metrics. No naked short strategies are ever recommended.

**Target Users:** Both novice and experienced options traders seeking data-driven, high-probability strategy recommendations with educational context.

**Visual Identity:** "Obsidian Glass" — dark glassmorphism with gold/amber accents, inspired by Yahoo Finance's information density but with a premium, modern aesthetic.

---

## User Stories

| # | As a... | I want to... | So that... | Priority |
|---|---------|-------------|------------|----------|
| 1 | Novice trader | See a market overview with major indices and trending stocks | I can understand what's happening in the market today | MUST |
| 2 | Any trader | Search for any stock symbol and view detailed market info | I can research individual stocks before trading options | MUST |
| 3 | Any trader | View the complete options chain for any stock | I can see all available contracts with prices and Greeks | MUST |
| 4 | Any trader | Interact with payoff diagrams for strategies | I can visualize profit/loss scenarios before trading | MUST |
| 5 | Experienced trader | Set custom screening criteria (volume, market cap, IV rank) | I can filter for stocks that match my trading style | MUST |
| 6 | Any trader | Receive high-probability strategy recommendations with explainers | I can understand WHY a strategy is recommended, not just what it is | MUST |
| 7 | Novice trader | Read plain-English explanations of Greeks and probability metrics | I can learn options concepts while using the app | MUST |
| 8 | Any trader | Toggle between dark and light mode | I can use the app in any lighting environment | SHOULD |

---

## Visual Design System

### Color Palette

| Role | Light Mode | Dark Mode (Default) | Usage |
|------|-----------|-------------------|-------|
| **Primary / Accent** | `#D4A843` | `#D4A843` | CTAs, active states, highlights, badges |
| **Accent Hover** | `#C49932` | `#E8BC5A` | Hover states on accent elements |
| **Accent Glow** | `rgba(212,168,67,0.15)` | `rgba(212,168,67,0.2)` | Glow effects on active elements |
| **Background** | `#F5F5F7` | `#0A0A0F` | Page background |
| **Surface** | `#FFFFFF` | `rgba(255,255,255,0.05)` | Cards, panels (glass effect in dark) |
| **Surface Hover** | `#F0F0F2` | `rgba(255,255,255,0.08)` | Card hover states |
| **Surface Border** | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.08)` | Card borders (glass effect) |
| **Text Primary** | `#1A1A2E` | `#F0F0F5` | Headings, body text |
| **Text Secondary** | `#6B7280` | `rgba(240,240,245,0.6)` | Muted labels, descriptions |
| **Text Tertiary** | `#9CA3AF` | `rgba(240,240,245,0.35)` | Timestamps, metadata |
| **Positive / Bullish** | `#10B981` | `#10B981` | Green for gains, calls, bullish |
| **Negative / Bearish** | `#EF4444` | `#EF4444` | Red for losses, puts, bearish |
| **Warning** | `#F59E0B` | `#F59E0B` | Caution states |
| **Info** | `#3B82F6` | `#60A5FA` | Informational tooltips |
| **Navbar** | `#FFFFFF` | `#0D0D14` | Navigation bar background |
| **Backdrop Blur** | `blur(20px)` | `blur(20px)` | Glass morphism backdrop filter |

### Typography

| Element | Font Family | Size | Weight | Line Height |
|---------|-------------|------|--------|-------------|
| H1 (Page Title) | Inter | 28px / 1.75rem | 700 | 1.2 |
| H2 (Section Title) | Inter | 22px / 1.375rem | 600 | 1.3 |
| H3 (Card Title) | Inter | 18px / 1.125rem | 600 | 1.3 |
| Body | Inter | 15px / 0.9375rem | 400 | 1.5 |
| Body Small | Inter | 13px / 0.8125rem | 400 | 1.4 |
| Caption | Inter | 11px / 0.6875rem | 500 | 1.3 |
| Button | Inter | 14px / 0.875rem | 600 | 1 |
| Monospace (Prices) | JetBrains Mono | 14px / 0.875rem | 500 | 1.2 |
| Monospace Large | JetBrains Mono | 20px / 1.25rem | 600 | 1.2 |

### Spacing & Layout

- **Base unit:** 4px
- **Component padding:** 16px (4 units)
- **Section gap:** 24px (6 units)
- **Card padding:** 20px (5 units)
- **Card border radius:** 16px
- **Button border radius:** 10px
- **Input border radius:** 10px
- **Max content width:** 1200px
- **Mobile padding:** 16px sides

### Glass Morphism Effect (Dark Mode)

```css
.glass-card {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.glass-card:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(212, 168, 67, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}
```

### Animations

| Animation | Duration | Easing | Trigger |
|-----------|----------|--------|---------|
| Card hover lift | 200ms | ease-out | Mouse enter |
| Page transition | 300ms | ease-in-out | Route change |
| Accordion expand | 250ms | ease-out | Click toggle |
| Skeleton shimmer | 1.5s | linear (infinite) | Data loading |
| Number counter | 400ms | ease-out | Value change |
| Toast notification | 300ms in, 200ms out | ease-out | Event |
| Tooltip appear | 150ms | ease-out | Hover/focus |
| Tab switch | 200ms | ease-in-out | Tab click |

### Visual Style Checklist
- [x] Glassmorphism (frosted glass cards)
- [x] Dark mode (default, obsidian theme)
- [x] Light mode (togglable)
- [x] Gold/amber accent palette
- [x] Smooth micro-animations
- [x] Collapsible cards (accordion)
- [x] Monospace font for financial data

---

## Architecture

### Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend Framework** | Vite + Vanilla JS | Lightweight SPA, fast dev server, no framework overhead |
| **Styling** | Vanilla CSS (custom properties) | Full control, theme switching via CSS variables |
| **Charts** | Lightweight Charts (TradingView) | Professional financial charts, lightweight |
| **Payoff Diagrams** | Canvas API / Chart.js | Interactive P&L visualization |
| **Icons** | Lucide Icons (SVG) | Clean, consistent, tree-shakeable |
| **Fonts** | Google Fonts (Inter, JetBrains Mono) | Professional, highly legible |
| **Backend** | Node.js + Express | API proxy for key security |
| **Deployment** | Google Cloud Run | Containerized, auto-scaling |

### Application Structure

```
option-intel/
├── server/
│   ├── server.js              # Express proxy server
│   ├── routes/
│   │   ├── market.js          # Yahoo Finance proxy routes
│   │   └── options.js         # Massive.com proxy routes
│   └── middleware/
│       ├── rateLimiter.js     # Client-side rate limiting
│       └── errorHandler.js    # Centralized error responses
├── public/
│   ├── index.html             # SPA entry point
│   ├── css/
│   │   ├── variables.css      # Design tokens (light + dark)
│   │   ├── base.css           # Reset, typography, globals
│   │   ├── components.css     # Reusable component styles
│   │   ├── pages.css          # Page-specific layouts
│   │   └── animations.css     # Keyframes, transitions
│   ├── js/
│   │   ├── app.js             # SPA router, init
│   │   ├── api.js             # API client (fetch wrapper)
│   │   ├── state.js           # Simple state management
│   │   ├── router.js          # Client-side routing
│   │   ├── theme.js           # Dark/light mode toggle
│   │   ├── pages/
│   │   │   ├── market.js      # Market Hub page
│   │   │   ├── symbol.js      # Individual stock page
│   │   │   ├── screener.js    # Screener page
│   │   │   └── results.js     # Strategy results page
│   │   ├── components/
│   │   │   ├── navbar.js      # Bottom navigation bar
│   │   │   ├── searchBar.js   # Symbol search
│   │   │   ├── stockCard.js   # Stock info card
│   │   │   ├── optionChain.js # Options chain table
│   │   │   ├── payoffDiagram.js # Interactive P&L chart
│   │   │   ├── strategyCard.js # Strategy recommendation card
│   │   │   ├── greekExplainer.js # Greek tooltip explainers
│   │   │   ├── filterPanel.js # Screening criteria panel
│   │   │   ├── skeleton.js    # Loading skeletons
│   │   │   └── toast.js       # Notification toasts
│   │   └── utils/
│   │       ├── formatters.js  # Number, currency, date formatting
│   │       ├── calculations.js # Greeks, probability, strategy calcs
│   │       └── validators.js  # Input validation
│   └── assets/
│       └── icons/             # SVG icons
├── Dockerfile
├── package.json
└── .env
```

---

## Page Specifications

### Page 1: Market Hub (`/` and `/symbol/:ticker`)

The home page serves as a market intelligence dashboard and stock research tool.

#### Section 1A: Navigation Bar (Bottom, Mobile-First)

- Fixed bottom navigation bar with 2 main tabs:
  - **Market** (chart icon) — Active gold accent when selected
  - **Screener** (filter icon) — Active gold accent when selected
- Top header bar with:
  - App logo/name "Option Intel" (left)
  - Theme toggle button (sun/moon icon, right)
  - Search icon (right, opens search overlay)

#### Section 1B: Market Overview (Home state)

- **Market Indices Ticker Strip** — Horizontal scroll strip showing:
  - S&P 500, NASDAQ, DOW, VIX with current value + % change
  - Color coded: green for positive, red for negative
  - Auto-refreshes on pull-to-refresh

- **Search Bar** — Prominent search input:
  - Placeholder: "Search stocks... (e.g., AAPL, TSLA)"
  - Autocomplete dropdown with symbol + company name
  - Debounced search (300ms)

- **Trending / Most Active Stocks** — Grid of stock cards:
  - **Dynamically fetched** from Yahoo Finance most-actives API (NOT a hardcoded list)
  - Categories: Most Active by Volume, Top Gainers, Top Losers (tabbed)
  - Each card shows: Symbol, Company Name, Price, % Change, mini sparkline chart
  - Refreshes on every page load and pull-to-refresh
  - Tap to navigate to symbol detail page

> **⚠️ CRITICAL RULE: No predefined stock lists exist anywhere in this app. Every stock shown is dynamically fetched from live APIs. The trending section, screener results, and search results all come from real-time API queries against the full US equity universe.**

#### Section 1C: Symbol Detail Page (`/symbol/:ticker`)

When a user taps a stock card or searches for a symbol:

- **Stock Header Card:**
  - Company name + ticker symbol
  - Current price (large, monospace)
  - Dollar change + Percentage change (color coded)
  - Market status indicator (Open / Closed / Pre-Market / After-Hours)
  - 52-week high/low range bar

- **Price Chart:**
  - TradingView Lightweight Chart (candlestick or line)
  - Time range tabs: 1D, 1W, 1M, 3M, 6M, 1Y
  - Chart fills card width, touch-interactive
  - Crosshair with price/date tooltip

- **Key Stats Card (Collapsible):**
  - Market Cap, Volume, Avg Volume, P/E Ratio
  - 52W High, 52W Low, Dividend Yield, Beta
  - All formatted with appropriate units (B, M, K)

- **Options Chain Card (Collapsible, Default Open):**
  - Expiration date selector (horizontal scroll of dates)
  - Call/Put toggle tabs
  - Table columns: Strike | Bid | Ask | Last | Volume | OI | IV | Delta
  - ITM strikes highlighted with subtle gold/amber tint
  - ATM strike row has a visual indicator (gold bar on left)
  - Tap any row to open strategy builder / payoff diagram

- **Interactive Payoff Diagram Card:**
  - Appears when user selects one or more contracts
  - Canvas-based line chart showing P&L at expiration
  - X-axis: Underlying price range
  - Y-axis: Profit / Loss ($)
  - Breakeven point(s) marked with vertical dotted line
  - Max profit / Max loss labeled
  - User can adjust position size
  - Strategy name displayed at top (e.g., "Bull Call Spread")
  - Clear labels: "Max Profit: $X", "Max Loss: $X", "Breakeven: $X"

---

### Page 2: Screener (`/screener`)

The screener page allows users to configure stock filters, scan for qualifying stocks, and receive strategy recommendations.

#### Section 2A: Filter Panel (Collapsible Accordion)

**Default Criteria (User-Adjustable):**

| Filter | Default | Input Type | Validation |
|--------|---------|------------|------------|
| Minimum Daily Volume | 1,000,000 shares | Number input with stepper | Min: 100,000, Max: 100,000,000 |
| Minimum Market Cap | $10B | Dropdown: $1B, $5B, $10B, $50B, $100B | Required |
| IV Rank Minimum | 10% | Range slider | 0-100 |
| IV Rank Maximum | 70% | Range slider | 0-100, must be > min |

- "Scan" button (gold accent, full width on mobile)
- "Reset to Defaults" text button
- Real-time validation (red border + error message on invalid)
- Filter values persist in localStorage across sessions

**Screening Data Source:**
- The screener queries the **entire US equity universe** via Yahoo Finance's screener API
- This is NOT a predefined list — it dynamically fetches ALL stocks matching the criteria
- Results are then enriched with IV data from Massive.com for options-eligible stocks
- No hardcoded tickers, no demo data, no mock responses

#### Section 2B: Screening Results

After scan:

- **Results Summary Bar:** "Found X stocks matching your criteria"
- **Stock Results List:** Each result is a card showing:
  - Symbol + Company Name
  - Current Price + % Change
  - Market Cap (formatted)
  - Avg Daily Volume (formatted)
  - IV Rank (with color indicator: cold blue < 30, neutral gray 30-50, warm amber 50+)
  - "Analyze Options →" button on each card

- **Empty State:** When no stocks match:
  - Magnifying glass icon
  - "No stocks match your criteria"
  - "Try relaxing your filters — lower the minimum market cap or widen the IV range."

#### Section 2C: Strategy Recommendations (After Selecting Stock)

When user taps "Analyze Options →" on a stock:

- **Loading State:** Skeleton cards with shimmer animation
- **Strategy Cards** — Each recommended strategy gets its own card:

**Strategy Card Layout:**

```
┌─────────────────────────────────────────────┐
│ ▸ BULL PUT SPREAD                    ★ 72% │
│   High Probability Credit Strategy          │
├─────────────────────────────────────────────┤
│                                             │
│  Sell: AAPL 180 Put  |  Buy: AAPL 175 Put  │
│  Exp: Mar 21, 2026   |  DTE: 23 days       │
│                                             │
│  Credit: $1.85       |  Max Risk: $3.15     │
│  Max Profit: $1.85   |  Breakeven: $178.15  │
│                                             │
│  ──── Probability Metrics ────              │
│  POP: 72%  |  P(Max): 58%  |  P(Touch): 31%│
│                                             │
│  ──── Greeks ────                           │
│  Δ: -0.22  |  Θ: +$3.40  |  Γ: 0.02       │
│  V: -0.08  |  IV: 34.2%  |  IVR: 45%       │
│                                             │
│  [▸ Why This Strategy?]  [📊 Payoff Diagram]│
└─────────────────────────────────────────────┘
```

**"Why This Strategy?" Expandable Section:**
Each strategy card has a collapsible explainer with plain-English rationale:

> **Why this maturity (23 DTE)?**
> Options lose the most value in the final 30-45 days before expiration. By selling a spread with 23 days left, you capture the steepest part of the time decay curve — your Theta of +$3.40/day means you earn $3.40 each day just from time passing.

> **Why these strikes (180/175)?**
> The short 180 strike has a delta of -0.22, meaning there's roughly a 78% chance AAPL stays above $180 at expiration. The 175 long put limits your maximum loss to $3.15 per share.

> **Why this strategy type?**
> With AAPL's IV Rank at 45% — in the "sweet spot" between 30-70% — there's enough premium to sell without the elevated risk of binary events. The Bull Put Spread benefits from time decay (positive Theta) and a slight decrease in IV (negative Vega).

**Greek Tooltips (Tap on mobile / Hover on desktop):**

| Greek | Tooltip |
|-------|---------|
| **Delta (Δ)** | "Delta measures directional exposure. A delta of -0.22 means for every $1 the stock moves up, this position gains ~$0.22. Short legs between 0.15-0.30 delta capture 1-2 standard deviation moves." |
| **Theta (Θ)** | "Theta represents daily time decay. +$3.40/day means this position gains $3.40 each day as expiration approaches. Positive theta is ideal for credit spreads." |
| **Gamma (Γ)** | "Gamma measures how fast delta changes. Low gamma (0.02) means stable risk. High gamma near expiration causes rapid P&L swings." |
| **Vega (V)** | "Vega measures IV sensitivity. -0.08 means this position benefits when implied volatility decreases — falling IV reduces the value of what you sold." |
| **IV** | "Implied Volatility reflects the market's expected move. 34.2% annualized means the market expects about ±2% weekly moves." |
| **IV Rank** | "IV Rank shows where current IV sits relative to its 52-week range. 45% means IV is near the middle — enough premium to sell without binary event risk." |

---

## Strategy Intelligence Engine

### Eligible Strategies

| # | Strategy | Type | Min POP | Delta Range (Short) | DTE Range |
|---|----------|------|---------|---------------------|-----------|
| 1 | Long Calls | Debit/Directional | 40% | ≥0.70 (deep ITM) OR gamma/theta>3 | 60-90 |
| 2 | Long Puts | Debit/Directional | 40% | ≥0.70 (deep ITM) OR gamma/theta>3 | 60-90 |
| 3 | Bull Call Spread | Debit Vertical | 40% | 0.40-0.55 (long leg) | 20-45 |
| 4 | Bear Put Spread | Debit Vertical | 40% | 0.40-0.55 (long leg) | 20-45 |
| 5 | Bull Put Spread | Credit Vertical | 60% | 0.15-0.30 | 20-45 |
| 6 | Bear Call Spread | Credit Vertical | 60% | 0.15-0.30 | 20-45 |
| 7 | Iron Condor | Credit Neutral | 60% | 0.15-0.20 (both sides) | 30-45 |
| 8 | Iron Butterfly | Credit Neutral | 50% | ATM (short), OTM (long) | 30-45 |
| 9 | Calendar Spread | Time Decay | 50% | ATM | Front: 20-30, Back: 45-60 |
| 10 | Diagonal Spread | Directional+Decay | 50% | Near: OTM, Far: ITM | Near: 20-30, Far: 45-60 |
| 11 | Ratio Backspread | Debit Directional | 40% | Backspreads only | 30-60 |

**Strict Exclusion:** Naked short calls, naked short puts, ratio spreads with net short exposure.

### Scoring Algorithm

Each qualifying strategy is scored 0-100 based on:

| Factor | Weight | Calculation |
|--------|--------|-------------|
| Probability of Profit | 30% | Higher POP = higher score |
| Risk/Reward Ratio | 25% | Better ratio = higher score |
| Theta Efficiency | 15% | Theta per dollar of risk |
| Liquidity | 15% | Bid-ask spread tightness + volume |
| IV Environment | 15% | How well IV rank matches strategy type |

Only strategies scoring ≥ 65/100 are shown, sorted by score descending.

### Strategy-Specific Criteria

**Vertical Spreads:**
- Strike width: 2.5-10 points (must be liquid strikes)
- Credit spreads: credit received ≥ 30% of max risk
- Debit spreads: max risk ≤ 3x max reward
- Both legs must have bid-ask spread ≤ $0.15 or 10% of mid price

**Iron Condors:**
- Short delta: 0.15-0.20 on both puts and calls
- Wing width: equal or 2:1 ratio (body:wings)
- Breakeven width: ≥ 10% of underlying price
- Net credit received: ≥ 30% of max risk

**Long Options:**
- Deep ITM (delta ≥ 0.70) for high probability directional
- OR high gamma/theta ratio (>3) for explosive move potential
- Must have sufficient volume (>100 contracts)
- Bid-ask spread ≤ $0.20

---

## API / Data Contract

### Backend Proxy Endpoints

| Route | Method | Target API | Purpose |
|-------|--------|-----------|---------|
| `/api/market/indices` | GET | Yahoo Finance | Major indices (S&P, NASDAQ, DOW, VIX) |
| `/api/market/search?q=` | GET | Yahoo Finance | Symbol search autocomplete |
| `/api/market/quote/:ticker` | GET | Yahoo Finance | Individual stock quote + stats |
| `/api/market/chart/:ticker?range=` | GET | Yahoo Finance | Price chart data |
| `/api/options/chain/:ticker` | GET | Massive.com | Full option chain with Greeks |
| `/api/options/contracts/:ticker` | GET | Massive.com | Available contracts reference |
| `/api/screener/scan` | POST | Yahoo Finance + Massive.com | Run stock screen + fetch IV data |

### Massive.com API Integration

**Base URL:** `https://api.massive.com`
**Auth:** `Authorization: Bearer <API_KEY>` (server-side only)

**Primary Endpoint — Option Chain Snapshot:**
```
GET /v3/snapshot/options/{ticker}
```

Query Parameters: `strike_price`, `expiration_date`, `contract_type`, `order`, `limit` (max 1000), `sort`

Response fields used:
```json
{
  "results": [{
    "ticker": "O:AAPL250321C00180000",
    "contract_type": "call",
    "strike_price": 180.0,
    "expiration_date": "2025-03-21",
    "shares_per_contract": 100,
    "greeks": { "delta": 0.65, "gamma": 0.03, "theta": -0.12, "vega": 0.18 },
    "implied_volatility": 0.342,
    "open_interest": 5432,
    "last_quote": { "bid": 5.20, "ask": 5.40, "midpoint": 5.30 },
    "fmv": 5.28,
    "underlying_asset": { "ticker": "AAPL", "price": 182.50, "change_to_break_even": -2.50 }
  }]
}
```

**Tier Constraints (Options Starter - $29/month):**
- Unlimited API calls ✅
- 15-minute delayed data (not real-time)
- Greeks, Snapshots, Reference data ✅
- No real-time quotes/trades (would need Advanced $199/month)

---

## Component Inventory

### Global Components

| # | Component | States |
|---|-----------|--------|
| 1 | **Navbar** | Default, Active tab |
| 2 | **TopBar** | Default, Search open |
| 3 | **SearchOverlay** | Hidden, Open, Typing, Results, Empty, Error |
| 4 | **ThemeToggle** | Light active, Dark active |
| 5 | **Toast** | Success, Error, Info, Dismissing |
| 6 | **Skeleton** | Animating |
| 7 | **Tooltip** | Hidden, Visible |

### Market Hub Components

| # | Component | States |
|---|-----------|--------|
| 8 | **IndexStrip** | Loading, Loaded, Error |
| 9 | **StockCard** | Default, Hover, Loading |
| 10 | **StockGrid** | Loading, Loaded, Empty |
| 11 | **StockHeader** | Loading, Loaded |
| 12 | **PriceChart** | Loading, 1D/1W/1M/3M/6M/1Y |
| 13 | **KeyStatsCard** | Collapsed, Expanded, Loading |
| 14 | **OptionsChainTable** | Loading, Loaded, Empty, Error |
| 15 | **ExpirationSelector** | Default, Selected |
| 16 | **PayoffDiagram** | Empty, Single Leg, Multi-Leg |

### Screener Components

| # | Component | States |
|---|-----------|--------|
| 17 | **FilterPanel** | Expanded, Collapsed, Validating, Error |
| 18 | **RangeSlider** | Default, Dragging, Error |
| 19 | **NumberInput** | Default, Focus, Error, Disabled |
| 20 | **ScanButton** | Default, Hover, Loading, Disabled |
| 21 | **ResultsCard** | Default, Hover, Analyzing |
| 22 | **ResultsList** | Loading, Loaded, Empty |
| 23 | **StrategyCard** | Collapsed, Expanded, Loading |
| 24 | **GreekBadge** | Default, Tooltip visible |
| 25 | **ProbabilityBar** | Low, Medium, High |
| 26 | **ExplainerSection** | Collapsed, Expanded |

---

## Interaction Map

| Element | Trigger | Result | Error Case |
|---------|---------|--------|------------|
| Bottom Nav Tab | Tap | Route to Market or Screener | N/A |
| Search Icon | Tap | Full-screen search overlay | N/A |
| Search Input | Type (300ms) | Autocomplete dropdown | "No results" |
| Search Result | Tap | Navigate to `/symbol/:ticker` | N/A |
| Stock Card | Tap | Navigate to `/symbol/:ticker` | N/A |
| Theme Toggle | Tap | CSS variables update | N/A |
| Chart Time Tab | Tap | Chart reloads for range | "Failed to load" toast |
| Stats Card Header | Tap | Accordion expand/collapse | N/A |
| Expiration Date | Tap | Chain reloads for date | "No contracts" message |
| Call/Put Toggle | Tap | Chain filters | N/A |
| Option Row | Tap | Added to payoff diagram | N/A |
| Filter Input | Change | Validate in real-time | Red border + error |
| IV Slider | Drag | Update value | Max < Min prevented |
| Scan Button | Tap | Loading → Results | "Scan failed" toast |
| "Analyze Options" | Tap | Loading → Strategy cards | "Failed" toast |
| Strategy Card | Tap | Expand details | N/A |
| "Why This Strategy?" | Tap | Explainer expands | N/A |
| Greek Badge | Tap/Hover | Tooltip appears | N/A |
| Pull down (mobile) | Pull | Refresh data | "Refresh failed" toast |

---

## Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | 320-767px | Single column, bottom nav, full-width cards |
| Tablet | 768-1023px | Two columns for grids, side-by-side sections |
| Desktop | 1024-1439px | Three-column grids, wide tables |
| Wide | 1440px+ | Max-width container, generous whitespace |

---

## Acceptance Criteria

### Core Functionality
- [ ] Market Hub shows live index data (S&P 500, NASDAQ, DOW, VIX)
- [ ] Symbol search autocompletes within 300ms
- [ ] Stock detail pages show price, chart, key stats, and options chain
- [ ] Options chain shows all contracts with bid, ask, volume, OI, IV, delta
- [ ] Users can select contracts and view interactive payoff diagrams
- [ ] Payoff diagrams correctly calculate max profit, max loss, breakeven
- [ ] Screener filters validate in real-time and persist across sessions
- [ ] Stock screening returns qualifying stocks by volume, market cap, IV rank
- [ ] Strategy recommendations include probability metrics and Greeks
- [ ] Each strategy has a plain-English "Why This Strategy?" explainer
- [ ] Only strategies scoring ≥65 are shown, sorted by score
- [ ] No naked short strategies are ever recommended

### Visual & UX
- [ ] Dark mode (obsidian glass) is the default
- [ ] Light mode is togglable and visually complete
- [ ] Cards use glassmorphism in dark mode
- [ ] Collapsible cards animate smoothly (250ms)
- [ ] Financial numbers use monospace font
- [ ] Positive = green, Negative = red
- [ ] Gold/amber accent used consistently
- [ ] Skeleton loading states for all async operations
- [ ] Error states show clear messages with retry
- [ ] Responsive at 320px, 768px, 1024px, 1440px

### Technical
- [ ] API key is never exposed to the client
- [ ] All API calls have error handling
- [ ] No mock data — all data from live APIs
- [ ] Loads in under 3 seconds on 4G
- [ ] No console errors in production
- [ ] All inputs validated
- [ ] Theme preference saved to localStorage

---

## Out of Scope (Phase 2)

- Watchlist / Save functionality
- User authentication / accounts
- Real-time streaming (WebSocket) — needs Advanced tier
- Push notifications
- Trade execution
- Historical backtesting
- PWA offline mode
- Social sharing

---

> **Approval:** ☐ Awaiting user approval
>
> Once approved, development begins using the builder skill.
