# Testing Mobile Responsiveness Locally for a Next.js App — Without Deploying

## TL;DR

- **The single most accurate method is remote debugging on a real phone using the device's own browser engine** — Safari Web Inspector for a real iPhone (needs a Mac + USB/Wi-Fi), or Chrome `chrome://inspect` for a real Android over USB. Everything else (Chrome DevTools device mode, Responsively, Sizzy, Polypane) is a Blink-based approximation that cannot reproduce iOS Safari's WebKit engine.
- **For fast iteration without pushing to git/Vercel:** expose your `next dev` server to your phone. On the same Wi-Fi, run `next dev -H 0.0.0.0` and add your machine's LAN IP to `allowedDevOrigins`. Because your app uses better-auth passkeys (WebAuthn), which require a secure context, a plain `http://192.168.x.x` LAN URL will fail — so route through an HTTPS tunnel (Cloudflare Tunnel or Tailscale Funnel preferred over ngrok) to get a trusted certificate.
- **Chrome DevTools diverges from real devices because it only spoofs the viewport, user agent, DPR and touch on top of desktop Blink** — it never runs WebKit, real touch digitizers, device fonts, notch/safe-area insets, or true device pixel ratios, which is exactly why your site looks different on a real phone.

## Key Findings

1. **DevTools device mode is a viewport spoof on Blink, not a rendering engine swap.** It changes dimensions, DPR, user-agent string, and simulates touch, but the page is still rendered by your desktop Chrome's Blink engine. On iOS every browser is required to use Apple's WebKit, so DevTools can never reproduce iOS Safari behavior. Google's own documentation is blunt about this: "There are some aspects of mobile devices that DevTools will never be able to simulate. For example, the architecture of mobile CPUs is very different than the architecture of laptop or desktop CPUs. When in doubt, your best bet is to actually run your page on a mobile device."
2. **Same-network access is free and instant but not secure-context.** `next dev -H 0.0.0.0` plus your LAN IP works for pure CSS/layout checks, but WebAuthn/passkeys, service workers, and geolocation need HTTPS (localhost is the only HTTP exception).
3. **Tunnels give a public HTTPS URL without deploying.** Cloudflare Tunnel (free, unlimited bandwidth, stable custom subdomains via a named tunnel) and Tailscale Funnel (free, stable `ts.net` subdomain) are better than ngrok for passkey testing because a stable hostname = stable WebAuthn rpID = no re-registering passkeys each session. ngrok's free tier is capped and shows an interstitial page.
4. **Multi-viewport apps (Responsively free; Sizzy/Polypane paid) are convenience tools, not accuracy tools** — all are Electron/Chromium/Blink and explicitly cannot simulate other rendering engines.
5. **The most accurate results come from the real device's own engine:** Safari Web Inspector (real iPhone via Mac), Chrome remote debugging (real Android via USB), or a real-device cloud like BrowserStack Live. On a Mac without a physical iPhone, the Xcode iOS Simulator runs a real WebKit build and is the free "gold standard."

## Details

### 1. Why Chrome DevTools device mode diverges from real devices

Chrome DevTools device mode ("responsive mode") emulates a mobile device by overriding the **viewport dimensions, device pixel ratio (DPR), user-agent string, and touch-event simulation**, and can throttle CPU/network. Critically, **the rendering engine remains desktop Blink running on your desktop hardware** — as one detailed write-up put it, "The rendering engine is still Blink running on your desktop hardware. There is no GPU difference, no real memory constraint, no OEM skin, and no actual touch digitizer." Google's own docs concede that some aspects "DevTools will never be able to simulate… When in doubt, your best bet is to actually run your page on a mobile device."

Specific sources of divergence relevant to a responsive-design workflow:

- **Engine: Blink vs WebKit.** This is the biggest one for your app. On iOS, *every* browser — Safari, Chrome, Firefox, Edge — is required by Apple to use the WebKit engine. Chrome DevTools renders with Blink, so WebKit-specific CSS/layout bugs (flexbox/grid quirks, `100vh` behavior, sticky positioning, form control rendering, date inputs, scroll behavior) simply don't appear. Switching the DevTools UA to "Safari" only spoofs the string; the page still uses Blink. As one testing vendor noted, Chrome DevTools "Safari mode" only spoofs the user agent string — "the page still renders with Chromium's engine, so WebKit-specific bugs go undetected," and roughly 15–20% of browser bugs commonly show up only in Safari.
- **Touch vs real digitizers.** DevTools simulates tap/swipe events, but real phones use physical touch digitizers handling pressure, velocity, and multi-touch; hover/pointer media queries (`@media (hover: hover)` / `(pointer: coarse)`) resolve differently on true touch devices.
- **Fonts and text rendering.** Samsung, Xiaomi, OnePlus and other OEMs apply custom system fonts and rendering; text that looks clean in emulation can clip, blur, or misalign on a physical device. iOS uses its own font stack and text-size-adjust behavior.
- **Safe-area / notch insets.** `env(safe-area-inset-*)` values are supplied by the real user agent and require `viewport-fit=cover` in your viewport meta tag. On desktop DevTools these effectively resolve to zero, so notch/Dynamic-Island and home-indicator handling can only be truly verified on a real device or the iOS Simulator. (Note a known iOS Safari quirk: insets can report `0px` in portrait and only populate in landscape or with certain toolbar states — several developers recommend hardcoding a fallback for the bottom inset.)
- **Device pixel ratio, scrollbars, and viewport chrome.** Desktop overlay scrollbars differ from mobile; the dynamic URL bar show/hide that changes viewport height on scroll (the classic `100vh` problem) is not reproduced; real DPR and sub-pixel rendering differ.
- **Hardware/perf.** CPU throttling is a software approximation; real mid-range phones have different CPU architecture, thermals, memory pressure, and GPU drivers.

### 2. Test the local dev server directly on a real phone over the same Wi-Fi (free, fast)

This is the lowest-friction loop for pure layout/CSS work:

1. Find your dev machine's LAN IP (`ipconfig` on Windows → IPv4 Address like `192.168.1.105`; `ipconfig getifaddr en0` / `ifconfig` on macOS).
2. Bind Next.js to all interfaces: `next dev -H 0.0.0.0` (or `next dev -H 0.0.0.0 -p 3000`). This makes the server reachable at `http://192.168.1.105:3000` from any device on the same network.
3. **Add the LAN origin to `allowedDevOrigins` in `next.config.js`.** Per Next.js's official docs, Next.js "blocks cross-origin requests to dev-only assets and endpoints during development by default to prevent unauthorized access." Set e.g. `allowedDevOrigins: ['192.168.1.105']` so HMR/`/_next/*` assets load correctly on the phone. This changed from warn-only to a hard block: PR #91507 ("block disallowed dev origins by default," merged 2026-03-17, shipping in Next.js 16.x) "removes the warn-only default behavior and enforces the dev-origin guard by default. Cross-origin requests to internal dev resources now block unless they match the built-in local allowlist or an explicit allowedDevOrigins entry" (returning a 403).
4. Ensure your OS firewall allows inbound connections on the port (Windows Defender Firewall inbound rule for TCP 3000; on WSL2 you also need `netsh interface portproxy` forwarding).
5. Optional: generate a QR code of the URL in your dev script for quick phone access.

**Critical limitation for your app:** a plain `http://192.168.x.x` URL is **not a secure context**. WebAuthn/passkeys (better-auth), service workers, and geolocation will fail. Per MDN's "Secure contexts" documentation, only "<http://127.0.0.1>, <http://localhost>, and http://*.localhost URLs… can be considered to have been delivered securely because they are on the same device as the browser." A LAN IP over HTTP does *not* qualify and is blocked by all major browsers. So for anything touching passkeys/PWA/service workers you must use HTTPS — either a locally-trusted cert (mkcert) or, more simply, a tunnel (below).

### 3. Tunneling tools (public HTTPS URL, no deploy)

All of these terminate TLS with a publicly-trusted certificate, satisfying WebAuthn's secure-context requirement. Comparison for a solo dev:

| Tool | Cost | HTTPS | Setup | Stable URL / rpID | Notes for this app |
|---|---|---|---|---|---|
| **Cloudflare Tunnel** (`cloudflared`) | Free, unlimited bandwidth | Yes (Cloudflare cert) | Moderate (named tunnel needs a domain + DNS) | **Stable** with a named tunnel on your own domain; *quick* `trycloudflare.com` tunnels get a **random** URL each run | Best free option for stable rpID; no interstitial |
| **Tailscale Funnel** | Free | Yes (valid cert) | Easy once Tailscale installed; must enable Funnel node attr | **Stable** `<machine>.<tailnet>.ts.net` | Great for solo/private testing; stable rpID; Funnel is publicly reachable (Serve is tailnet-only) |
| **ngrok** | Free tier (limited); Hobbyist "$8 monthly, billed annually ($10 billed monthly)" | Yes | Easiest (`ngrok http 3000`) | Free now includes one persistent assigned domain; classic random URLs otherwise | Free-tier "Interstitial page on HTTP/S endpoints," "Up to 1GB data transfer," "Up to 20k HTTP/S requests"; paid removes interstitial |
| **localtunnel** | Free, open-source | Yes | Easy (`npx localtunnel --port 3000`) | Random `loca.lt` subdomain | No account; minimal features; less reliable |
| **VS Code Port Forwarding** (dev tunnels) | Free (GitHub login) | Yes | Built into VS Code "Ports" tab | Reasonably stable per session | Private by default (GitHub auth); switch to Public for phone access; no extra install |
| **Pinggy / localhost.run** | Free tier | Yes | SSH one-liner, no install | Random subdomain (free) | Good for quick throwaway demos |

On ngrok's interstitial specifically, ngrok's own free-plan docs state: "ngrok injects an interstitial page in front of all HTML browser traffic on the free tier… Once the visitor selects the 'Visit' button… a cookie is set which prevents the interstitial from appearing for that domain for 7 days," and you can bypass it by adding "a header value of ngrok-skip-browser-warning and set it to any value." ngrok's own free-plan-limits documentation does *not* list a "2-hour session" cap — that figure appears only in third-party blogs.

**Passkey-specific guidance (from better-auth + WebAuthn research):** WebAuthn passkeys are **origin/rpID-bound**. A passkey registered against `localhost` will *not* authenticate against `abc123.ngrok-free.app` — different rpID. better-auth's passkey plugin is "powered by SimpleWebAuthn behind the scenes," and its documented options are **`rpID`** ("A unique identifier for your website based on your auth server origin. `'localhost'` is okay for local dev"), **`rpName`** ("Human-readable title for your website"), and **`origin`** ("The origin URL at which your better-auth server is hosted… Do NOT include any trailing /") — note `origin` is a single string, not `expectedOrigins`. A minimal config looks like:

```ts
import { betterAuth } from 'better-auth';
import { passkey } from '@better-auth/passkey';

export const auth = betterAuth({
  plugins: [
    passkey({
      rpID: 'example.com',   // set to your stable tunnel hostname
      rpName: 'My App',
      origin: 'https://example.com', // full URL, no trailing slash
    }),
  ],
});
```

You must also add the tunnel URL to better-auth's top-level **`trustedOrigins`** (e.g. `trustedOrigins: ['http://localhost:3000', 'https://your-tunnel.ts.net']`). Because passkeys are rpID-bound, **a stable tunnel domain lets you register a passkey once and reuse it every session** — the concrete reason to prefer Cloudflare Tunnel (named tunnel/custom domain) or Tailscale Funnel over a random-URL tunnel. Watch for the common `Invalid origin` error on assertion, which occurs when the backend's allowed-origins list doesn't contain the *verbatim* tunnel URL (the check is case-sensitive and includes the scheme). ngrok's free interstitial is a once-per-session top-level click-through; it is not proven to corrupt the WebAuthn ceremony itself, but it adds friction and can break iframe/sub-resource requests.

### 4. VS Code extensions for responsive/mobile testing

- **Microsoft "Live Preview"** — embedded (webview) or external browser preview with live reload. Good for static sites/simple pages; Microsoft's own guidance notes it works best with static content, and for frameworks with their own dev server (React/Next.js) you should use the framework tooling. The embedded preview is a VS Code webview (Electron/Chromium), so it's Blink — same accuracy caveat as DevTools, and *worse* for a Next.js SSR app.
- **"Live Server" (Ritwick Dey)** — launches a lightweight server + external browser with auto-refresh; can be reached on other devices via LAN IP. Again aimed at static HTML/CSS, not a Next.js dev server.
- **Browser Preview (auchenberg)** — headless Chromium inside the editor; the author now recommends the Live Preview extension instead, and this one is largely unmaintained.
- **VS Code "Ports" / Port Forwarding** — not an extension but a built-in feature (Microsoft dev tunnels); the most useful VS Code capability here because it gives an HTTPS URL for your running Next.js dev server (see table above).

**Verdict:** For a Next.js app, the live-preview extensions add little accuracy — they're Blink webviews and often don't play well with the Next dev server. Use VS Code's built-in Port Forwarding instead, and inspect on the real device.

### 5. Dedicated multi-device preview tools

| Tool | Cost | Engine | Real device? | Notes |
|---|---|---|---|---|
| **Responsively App** | Free, open-source | Chromium/Blink | No | Multiple synced viewports, mirrored interactions; great free convenience tool |
| **Sizzy** | Paid (~$15/mo or ~$120/yr; one-time license reported ~$499) | Electron/Chromium/Blink | No | Polished UI, device frames; per its own site, "cannot simulate different browser rendering engines, so there's a chance that there might be some minor differences when testing on a real device" |
| **Polypane** | Paid ($9/user/month billed monthly, with "3 months free with yearly plan"; free 14-day trial, no credit card) | Chromium/Blink (Chromium 146 as of v28, Feb 2026) | No | Best-in-class feature set: synced panes, 80+ accessibility tests, media-query/DPR emulation; reviewers note "it's all Chromium based. So if there are issues with WebKit, you may not see them" |
| **Firefox Responsive Design Mode** | Free (in Firefox) | Gecko | No | Emulation on Gecko; useful cross-engine sanity check but still not iOS WebKit |
| **BrowserStack Live** | Paid (Live–Desktop $29/mo billed annually; Live–Desktop & Mobile $39/mo; free trial) | **Real device engines** | **Yes** | Streams real iPhones/Androids in the cloud; "Local testing" tunnels your dev server; most accurate paid option, includes on-device Safari/Chrome inspection |
| **LambdaTest / LT Browser** | Freemium | LT Browser = Blink; cloud = real devices | Mixed | LT Browser is a free Blink multi-viewport browser; the paid cloud offers real devices |

**Verdict:** Responsively (free) or Polypane (paid) speed up breakpoint work, but none reproduce iOS Safari. For accuracy you need real device rendering (BrowserStack Live, or your own phone via remote debugging).

### 6. Remote debugging on real devices (most accurate)

This gives you both the real on-device engine **and** DevTools-style inspection:

- **iOS Safari via macOS (Safari Web Inspector):** On the iPhone, Settings → Safari → Advanced → enable **Web Inspector** (may require enabling Developer Mode under Privacy & Security). On the Mac, Safari → Settings → Advanced → "Show features for web developers" to get the **Develop** menu. Connect via USB (first pairing), open your page on the phone, then Mac Safari → Develop → [your iPhone] → [tab]. You get full Elements/Console/Network/Timelines against the *real* WebKit page, with live highlighting on the device. After the first wired pairing it works wirelessly on the same Wi-Fi. **Requires a Mac** — this is the single biggest constraint if you're on Windows.
- **Android Chrome via USB (`chrome://inspect`):** Enable Developer Options + USB debugging on the phone, connect USB, open `chrome://inspect#devices` in desktop Chrome with "Discover USB devices" checked, accept the prompt on the phone, then click "inspect" for full DevTools against the real on-device Chrome (real Blink build/WebView version). Works from Windows/Mac/Linux.
- **No physical iPhone but have a Mac:** the **Xcode iOS Simulator** runs a genuine WebKit build; open Safari inside the Simulator and inspect via Mac Safari → Develop → Simulator. Widely called the free "gold standard" for iOS web testing (practitioners report it covers ~80–90% of WebKit issues; it misses real-device performance/GPU paths and app-level Safari behaviors like ITP, content blockers, and private-mode quotas).

### 7. Recommended workflow for a solo dev (Next.js + Vercel, VS Code, Windows or Mac)

**Tier 0 — instant, every save (approximation):** Keep using Chrome DevTools device mode and/or Responsively (free) for rough breakpoint layout while coding. Fast, but never trust it for final iOS behavior.

**Tier 1 — real phone on same Wi-Fi (free, ~2 min setup):** Run `next dev -H 0.0.0.0`, add your LAN IP to `allowedDevOrigins`, open the firewall port, browse from your phone at `http://<LAN-IP>:3000`. Perfect for CSS layout, touch-target sizing, and safe-area/notch checks. **HMR still works**, so it's a true fast loop with no git push.

**Tier 2 — HTTPS tunnel for secure-context features (free):** When testing better-auth passkeys, service workers, or geolocation, run a tunnel. **Recommended: Cloudflare Tunnel with a named tunnel on a domain you own, or Tailscale Funnel** for a stable hostname. Set better-auth's passkey `rpID`/`origin` and `trustedOrigins` to that stable domain so you register the passkey once. Add the tunnel domain to `allowedDevOrigins` too. Use VS Code's built-in Port Forwarding as a zero-install fallback.

**Tier 3 — remote debugging for real bugs (most accurate):** When something looks wrong only on the phone, attach DevTools to the real device — Safari Web Inspector (iPhone, if you have a Mac) or `chrome://inspect` (Android). This is where you actually diagnose WebKit-only layout issues. On Windows with an iPhone and no Mac, use BrowserStack Live (paid) or the iOS Simulator on any borrowed/cloud Mac.

**Tier 4 — pre-ship confidence:** Before merging, do one pass on a real iPhone (Safari) and one real Android (Chrome). If you lack an iPhone, a BrowserStack Live session or Xcode Simulator pass covers iOS WebKit.

## Recommendations

1. **Set up Tier 1 today** (`-H 0.0.0.0` + `allowedDevOrigins` + firewall rule). It's free, keeps HMR, and catches the majority of responsive/layout/touch-target bugs on a real screen. Threshold to escalate: if a bug involves passkeys, PWA/service workers, or geolocation → go to Tier 2.
2. **Choose one stable HTTPS tunnel and standardize your passkey config around it.** Cloudflare Tunnel (named) or Tailscale Funnel give a stable rpID so you don't re-register passkeys each session. Configure better-auth `passkey({ rpID, rpName, origin })` and top-level `trustedOrigins` to that domain. Avoid random-URL tunnels for passkey work.
3. **If you're on a Mac, install Xcode + use Safari Web Inspector on a real iPhone** — this is your highest-accuracy, zero-ongoing-cost tool and should be the arbiter of any "looks wrong on iOS" dispute. If you're on Windows, budget for a BrowserStack Live individual plan ($29/mo desktop, $39/mo desktop+mobile) or keep a cheap Android around for `chrome://inspect`, and borrow/rent a Mac or use the iOS Simulator for WebKit.
4. **Treat Responsively (free) or Polypane (paid) as speed tools, not truth.** Use them to lay out breakpoints quickly; verify on a real WebKit device before shipping. Don't pay for Sizzy/Polypane expecting real-device accuracy — they're Blink.
5. **Because this is a Vercel app, you never need to push to test** — the whole point of Tiers 1–3 is that `next dev` + LAN/tunnel + remote debugging gives you the real-device signal without a deploy. Reserve Vercel preview deployments for sharing with others, not for your own responsiveness loop.

## Caveats

- **iOS Safari can only be truly tested on Apple hardware or a real-device cloud.** Simulator/cloud covers ~80–90% of WebKit issues but misses real-device performance, GPU paths, and Safari app behaviors (ITP, content blockers, private-mode quotas). Always do a final real-iPhone pass if iOS traffic matters.
- **Secure context is non-negotiable for passkeys:** LAN-IP-over-HTTP will fail; you must use HTTPS (tunnel or mkcert). Per MDN, only `localhost`/`127.0.0.1`/`*.localhost` are exempt — this is a hard browser rule, not a config you can override with a flag.
- **Passkeys are rpID-bound:** a credential registered on one domain won't work on another. Plan your rpID (stable tunnel domain) before registering test passkeys, or you'll re-register constantly.
- **Tunnel stability varies by tier/config:** Cloudflare *quick* tunnels (`trycloudflare.com`) give random URLs; you need a named tunnel + custom domain for a stable rpID. ngrok's free tier caps data transfer at 1GB and HTTP/S requests at 20k, and shows an interstitial page (bypassable via the `ngrok-skip-browser-warning` header, or removed on the $8/mo-annual Hobbyist plan). Some third-party claims of an ngrok free "2-hour session timeout" are not corroborated by ngrok's own docs — treat with skepticism.
- **Pricing figures** are as of mid-2026 and change frequently; verify current tiers before subscribing.
- **VS Code live-preview extensions are Blink webviews** and add little for a Next.js SSR app; their value is convenience, not rendering accuracy.
