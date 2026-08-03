# GRAPEVYNE Preview manual review checklist

Preview URL: pending verified stable branch Preview link.

These checks are intentionally **not marked passed** by automated Chromium, Firefox, WebKit, or Axe results. Complete them against the verified Prompt 10A Preview before Prompt 10B.

## Physical iPhone Safari

- [ ] Open the homepage in normal motion; confirm there is no blank hero, horizontal overflow, clipped navigation, or stalled chapter.
- [ ] Scroll through all nine chapters and confirm video/poster transitions remain legible and controllable.
- [ ] Enable iOS Reduce Motion, reload, and confirm calm static/fallback presentation without lost content.
- [ ] Open Discover, a wine detail, Demo Cellar, and Demo Taste Atlas directly from copied links.
- [ ] Complete signup, refresh the page, and confirm the signed session persists.
- [ ] Save one bottle, edit its private memory, then delete it.
- [ ] Log out and confirm `/cellar` and `/profile` return to login.

## Physical Mac Safari

- [ ] Open the homepage at a desktop window size and confirm video, poster, fonts, and the WebGL bottle load without console/CSP errors.
- [ ] Verify normal-motion scrolling, browser Back/Forward, direct route loads, and the intentional 404.
- [ ] Enable macOS Reduce Motion, reload, and confirm the reduced-motion experience has no missing semantic content.
- [ ] Complete login and a full refresh, then confirm the same signed-in user remains active.
- [ ] Save, edit, and delete one disposable Cellar entry; confirm status, rating, favorite, and memory changes persist.

## VoiceOver or another physical screen reader

- [ ] Navigate from the skip link through primary navigation and the homepage chapters in a meaningful order.
- [ ] Confirm decorative cinematic/WebGL content does not obscure or duplicate the semantic story.
- [ ] Use Discover catalog mode and explainable recommendation mode; confirm results and explanations have useful names.
- [ ] Complete signup/login error and success states without relying on color or toast timing alone.
- [ ] Open Cellar, edit a memory, and use Taste Profile’s readable alternative.
- [ ] Confirm focus returns predictably after dialogs/editors and remains visible.

## Review handoff

Record the device/OS/browser or screen-reader versions, the date, and any issue links below. Do not enter passwords, cookie values, tokens, database URLs, or private notes.

```text
iPhone Safari:
Mac Safari:
Screen reader:
Reviewer/date:
Issues or approval:
```
