# Prompt 09 accessibility audit

## Status and scope

This audit covers the accepted Prompt 08 application on
`feat/grapevyne-cinematic-v2`, using the production-preview Playwright harness,
the disposable E2E database, focused component tests, source review, and the
retained screenshots in [`docs/screenshots/prompt-09/`](../screenshots/prompt-09/).

The formal local accessibility gate **passed**. The final official
`npm run test:a11y` production-preview run completed with no WCAG 2 A/AA
violations in any scanned state. This is automated evidence plus the targeted
browser/manual review documented below; it is not a substitute for physical
assistive-technology sign-off.

Evidence labels used below are deliberately distinct:

- **axe automated** means a DOM-based `axe-core` WCAG A/AA scan.
- **browser automated** means a Playwright assertion against the production
  preview, including keyboard input or browser emulation.
- **component automated** means a Vitest/Testing Library contract test.
- **manual visual review** means inspection of a retained still image. It is not
  a numeric contrast measurement and does not cover every video frame.

No physical phone, physical Safari installation, screen reader, switch device,
voice-control product, or other assistive technology was used in this pass.

## Automated axe result

The repository pins `@axe-core/playwright` **4.12.1** and the resolved
`axe-core` engine is **4.12.1**. The tracked test is
[`frontend/e2e/accessibility.spec.ts`](../../frontend/e2e/accessibility.spec.ts).
It analyzes `wcag2a` and `wcag2aa` tags and attaches each state's violation
array to the local/CI Playwright report.

| Execution | Browser/project | Result |
| --- | --- | --- |
| Observed Prompt 09 run after fixes | Playwright `desktop-chromium`; the drawer state changes the viewport to 390 × 844 CSS pixels | **Pass:** zero violations in every state listed below |
| Final required `npm run test:a11y` rerun | `desktop-chromium` production preview | **Pass:** 1 test passed; zero violations across all 12 representative states |

The passing representative matrix contained:

1. homepage;
2. Discover initial state;
3. Discover results;
4. Wine Detail;
5. Login;
6. Signup;
7. public demo Cellar;
8. empty private Profile;
9. populated private Cellar;
10. open memory editor;
11. active Taste Profile/Taste Atlas; and
12. open mobile navigation drawer.

The private states are created through the same-origin API in a disposable test
database. The active-profile scan also asserts that a seeded private-note
sentinel is absent from the profile response and rendered page. Axe is useful
regression evidence, but it cannot prove sensible focus movement, composite
video contrast, understandable copy, or compatibility with assistive
technology.

## Keyboard, focus, and control behavior

| Requirement | Evidence and result | Method |
| --- | --- | --- |
| Skip navigation and focus visibility | `AppLayout` supplies a first-focusable “Skip to main content” link and one `main` target. Shared CSS gives links, buttons, fields, and explicit tab stops a 2 px champagne focus outline with offset and shadow. | Source review; component/browser coverage is indirect |
| Mobile drawer entry | Opening moves focus to **Close**, applies `aria-modal="true"`, labels the dialog “Menu,” and prevents body scrolling. | Component automated; open drawer included in the passing axe run |
| Mobile drawer trap | Forward Tab from the last action wraps to Close; reverse Tab from Close wraps to the last action. | Component automated |
| Escape and focus return | Escape closes the drawer and returns focus to the Menu trigger. The mobile Chromium/WebKit smoke specification repeats the Escape/return contract in a real browser. | Component automated; browser assertion implemented, final cross-browser rerun reported separately |
| Drawer route activation | Following a drawer link closes the dialog and navigates without leaving a stale overlay or scroll lock. | Component automated and browser automated assertion implemented |
| Recommendation breakdown | The disclosure button exposes `aria-controls`/`aria-expanded` and opens with Enter after explicit focus. | Browser automated assertion implemented |
| Taste Atlas nodes | Each signal is a real button. Focus or activation selects it, `aria-pressed` communicates state, and Space activation was exercised in the passing active-profile axe journey. | Component automated and browser automated |
| Cellar details | Bottle cards are buttons with `aria-controls`, `aria-expanded`, and `aria-pressed`. Closing details schedules focus back to the originating bottle. | Component automated |
| Cellar delete confirmation | Entering confirmation moves focus to **Confirm removal**; cancel schedules focus back to **Remove bottle**. | Source review with component-path coverage |

The live Cellar details surface is an `aside`, not a modal dialog: on desktop it
coexists with the bottle list, and users remain free to move between both. A
focus trap would be incorrect for that non-modal contract. It has a labeled
heading and explicit close/focus-return behavior. The mobile navigation drawer
is the modal surface and owns the focus trap.

No end-to-end human keyboard-only traversal of every route was performed.
Browser and component assertions cover the highest-risk interactions, but a
physical keyboard and assistive-technology sign-off remains a pre-release manual
QA task.

## Forms, names, descriptions, and live feedback

- Shared text, password, select, search, checkbox, radio, and textarea controls
  use visible labels. Descriptions and validation messages are connected with
  `aria-describedby`; invalid fields use `aria-invalid`; forms expose
  `aria-busy` during requests.
- Login and Signup use the expected `name` and `autocomplete` values. Auth
  validation and server failures render as alerts and are also sent through the
  notification system.
- Loading and ordinary success updates use polite status regions. Errors use
  alerts/assertive regions. Toasts are atomic, have an accessible dismiss
  button, and pause timed dismissal during pointer or keyboard interaction.
- A successful memory update renders “Changes saved to your private cellar” as
  a status. Field errors remain associated with the affected input. Delete and
  request failures do not announce success.
- Duplicate-save feedback is a status and the resulting “Already in cellar”
  action is disabled. Session-check states in navigation and auth forms are
  exposed as status text rather than color-only changes.

The open memory editor is part of the passing axe matrix. Relevant component
tests also exercise auth labels/errors, atomic toast status/alerts, busy-button
labels, Cellar validation, saved feedback, and focus restoration. The final
full frontend and E2E reruns are recorded in the Prompt 09 quality-gate report,
not inferred here.

## Reflow, zoom, spacing, high contrast, and touch

[`frontend/e2e/responsive-input.spec.ts`](../../frontend/e2e/responsive-input.spec.ts)
contains real assertions for the following matrix:

| Check | Browser-automated contract | Current evidence boundary |
| --- | --- | --- |
| Responsive reflow | Home and Discover run at 360 × 800, 390 × 844, 430 × 932, 768 × 1024, 1024 × 768, 1440 × 900, 1920 × 1080, and 320 × 800. In addition, Wine Detail, populated Cellar, active Profile/Taste Atlas, demo Cellar, demo Taste Atlas, the honest 404, Login, and Signup each run at all eight viewports: 64 route/viewport checks. The matrix asserts visible headings and core landmarks, no clipped visible H1/H2, no document-level horizontal overflow, and no input-intercepting canvas. | The complete route surfaces are covered at every required size, but every nested private form or interaction state is not opened at every size; the memory editor, for example, has focused coverage elsewhere. |
| 200% zoom | Chromium DevTools Protocol sets a page-scale factor of 2, confirms `visualViewport.scale >= 2`, preserves the Discover heading/search focus, and finds no horizontal document overflow. | CDP scale is controlled browser evidence, not a substitute for a human check with Chrome/Firefox/Safari browser zoom. See [`10-browser-zoom-200-percent.png`](../screenshots/prompt-09/10-browser-zoom-200-percent.png). |
| Text spacing | At 360 × 800, the test applies 1.5 line height, 0.12 em letter spacing, 0.16 em word spacing, and 2 em paragraph spacing; Home remains present without horizontal overflow and the drawer remains operable. | Browser-injected WCAG spacing values; one representative mobile route. |
| Forced colors | At 390 × 844, Chromium forced-colors emulation is confirmed active; Discover retains its heading, banner/main/footer, primary navigation, search input, enabled Match button, and no horizontal overflow. | Emulation, not Windows High Contrast on physical hardware. See [`11-forced-colors-high-contrast.png`](../screenshots/prompt-09/11-forced-colors-high-contrast.png). |
| Touch targets | At every responsive width where the drawer is used, the Menu target is measured at least 44 × 44 CSS pixels and Close is measured at least 44 pixels high. Mobile Chromium and WebKit projects use touch-capable device profiles. | Targeted measurement of the primary mobile controls, not an exhaustive geometry audit of every inline link. |

The retained mobile Home and Login evidence is available at
[`02-homepage-mobile-production-preview.png`](../screenshots/prompt-09/02-homepage-mobile-production-preview.png)
and [`07-login-mobile.png`](../screenshots/prompt-09/07-login-mobile.png).
The refreshed Login capture is an unobscured signed-out state with its primary
controls visible.

## Headings, landmarks, and reading alternatives

- The application shell contains a banner/header, one main landmark, and a
  contentinfo/footer. Primary, mobile, and chapter navigation regions are named.
- Each of the nine homepage chapters is a semantic `section` labeled by its own
  H1/H2. Browser assertions verify the nine chapters and core landmarks in the
  responsive matrix. Axe scans cover representative public and private route
  headings.
- Decorative cinematic videos, posters, and the WebGL canvas are
  `aria-hidden`; video and canvas are removed from the tab order. The WebGL
  canvas is pointer-inert. The title, product explanation, forms, buttons,
  memory data, and chapter navigation remain semantic HTML outside those
  visuals.
- Videos are muted and have no controls or declarative autoplay attribute.
  Playback is attempted programmatically only when the selected silent scene is
  eligible and visible. Sound is therefore disabled by default.
- Cellar entries are semantic buttons whose names contain the sourced bottle
  content. The selected details use headings and definition lists; the memory
  editor retains visible labels and textual state.
- Taste Atlas nodes announce label, dimension, strength out of 100, and evidence
  count. Node state does not rely on color. A separate “THE SAME PATTERNS, IN
  TEXT” section repeats every major signal, evidence totals, summaries, lower
  affinity observations, and the observed sourced price range without relying
  on position, shape, size, or color. The active-profile browser flow exercises
  node selection and confirms private tasting notes are not exposed.

This establishes a strong semantic alternative, but it is not a screen-reader
usability session. NVDA/JAWS with Windows and VoiceOver with macOS/iOS remain
manual release checks.

## Motion, flashing, video, and WebGL fallbacks

- The dedicated reduced-motion project retains all nine semantic chapters,
  mounts no video or canvas, uses approved posters, keeps chapter links
  operable, and avoids loading the WebGL graph/model. Shared reduced-motion CSS
  collapses animations/transitions and disables smooth scrolling.
- Disabled WebGL plus Save-Data retains the CSS bottle and loads no renderer or
  model. Autoplay rejection replaces the video with its final poster. Neither
  fallback removes headings, copy, search, actions, or navigation.
- Cinematic media is decorative and silent. No interaction depends on hover;
  meaningful controls are links, buttons, or labeled fields with keyboard focus
  treatment.
- Source/test review found no intentional strobe or rapid-flash effect. No
  automated flash-frequency analysis of all approved video frames was run, so
  full-motion review remains a manual-media QA boundary.

Reduced-motion and WebGL fallback stills are
[`08-reduced-motion-hero.png`](../screenshots/prompt-09/08-reduced-motion-hero.png)
and [`09-disabled-webgl-fallback.png`](../screenshots/prompt-09/09-disabled-webgl-fallback.png).

## Composite video-background contrast

The cinematic chapters place semantic foreground content above the media layer.
The shared actual-frame treatment includes a dark chapter scrim; Portal,
Memory, and Atlas content receives an additional dark, bordered content
backdrop. Mobile uses a stronger vertical darkening treatment. These backdrops
are part of the semantic content composition and do not alter the approved
video files.

Manual visual review of the retained normal Home frame, reduced-motion poster,
disabled-WebGL fallback, Firefox smoke, and WebKit smoke found the principal
ivory/champagne heading, body copy, navigation, and hero controls visibly
separated from the sampled backgrounds:

- [`01-homepage-desktop-production-preview.png`](../screenshots/prompt-09/01-homepage-desktop-production-preview.png)
- [`08-reduced-motion-hero.png`](../screenshots/prompt-09/08-reduced-motion-hero.png)
- [`09-disabled-webgl-fallback.png`](../screenshots/prompt-09/09-disabled-webgl-fallback.png)
- [`14-desktop-firefox-smoke.png`](../screenshots/prompt-09/14-desktop-firefox-smoke.png)
- [`15-desktop-webkit-smoke.png`](../screenshots/prompt-09/15-desktop-webkit-smoke.png)

This is a representative still-frame review, not a contrast ratio for every
pixel behind every glyph throughout each moving clip. Axe evaluates computed
foreground/background styles but cannot reliably analyze a changing composite
video frame. The accepted manual-QA boundary therefore remains: review every
cinematic chapter through its complete playback on representative calibrated
displays. If any frame weakens legibility, strengthen the semantic scrim or
content backdrop; do not modify or degrade the approved media asset.

## Retained visual evidence and observations

Additional route-state evidence used in this audit includes:

- [`03-discover-recommendations.png`](../screenshots/prompt-09/03-discover-recommendations.png)
- [`04-populated-cellar.png`](../screenshots/prompt-09/04-populated-cellar.png)
- [`05-memory-editor.png`](../screenshots/prompt-09/05-memory-editor.png)
- [`06-active-taste-profile.png`](../screenshots/prompt-09/06-active-taste-profile.png)
- [`12-application-error-fallback.png`](../screenshots/prompt-09/12-application-error-fallback.png)
- [`13-not-found-404.png`](../screenshots/prompt-09/13-not-found-404.png)

The refreshed active-profile frame keeps the adjacent “Taste Profile” and
“Demo” authenticated-header labels visibly separated at 1440 × 900. The final
responsive matrix found no document-level overflow at any required viewport.

## Findings, limitations, and release decision

No critical accessibility issue was identified by the completed axe matrix,
responsive/cross-browser assertions, retained evidence, or reviewed semantic
contracts. The automated Prompt 09 accessibility gate passes. The following
manual work remains before physical assistive-technology release sign-off:

1. perform keyboard-only human traversal of every primary route;
2. perform NVDA/JAWS and VoiceOver checks, including live feedback, the mobile
   drawer, Cellar editing, and Taste Atlas;
3. verify 200% browser zoom with real browser UI controls, rather than relying
   only on CDP page-scale emulation;
4. review every moving cinematic frame against its production scrim/backdrop;
   and
5. run a human rapid-flash/media review on representative physical displays.

These are explicitly documented manual-device boundaries, not skipped automated
gates. The official axe, Chromium, responsive, reduced-motion, and
Firefox/WebKit smoke commands all passed locally.

## Reproduction commands

From `frontend/`:

```bash
npm run test:a11y
npm run test:e2e:chromium
npm run test:e2e:cross-browser
npm run test
```

Playwright reports, traces, videos, violation attachments, and failure
screenshots are ignored local/CI artifacts. Only intentional deterministic
visual baselines and the documentation evidence are tracked.
