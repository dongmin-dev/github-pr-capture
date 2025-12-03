# GitHub PR Capture

Utility scripts for producing clean, transparent-background screenshots of GitHub pull-request conversations using Puppeteer. Two variants are provided: a lightweight capture for public pages and a session-aware capture that preserves the merge box.

## Prerequisites

- Node.js 18+
- Google Chrome or Chromium (bundled with Puppeteer)
- Optional: a GitHub account to authenticate when using the merge-aware flow.

Install dependencies once:

```sh
npm install
```

## Scripts

### 1. `capture-pr-comments.js`

- Entry point: [`capture-pr-comments.run`](capture-pr-comments.js).
- Captures the entire discussion area (`#discussion_bucket` or `.js-discussion`) with a forced light theme and transparent outer chrome.
- Key helpers include [`capture-pr-comments.getPrUrl`](capture-pr-comments.js) for CLI overrides, [`capture-pr-comments.adjustViewportToContent`](capture-pr-comments.js), and [`capture-pr-comments.captureDiscussionScreenshot`](capture-pr-comments.js).
- Customize visuals via [`capture-pr-comments.CUSTOM_CSS`](capture-pr-comments.js).

Run against any PR:

```sh
node capture-pr-comments.js https://github.com/owner/repo/pull/123
```

If no URL is provided, it defaults to the example PR inside the script.

### 2. `capture-pr-comments-with-merge.js`

- Entry point: [`capture-pr-comments-with-merge.run`](capture-pr-comments-with-merge.js).
- Stores a persistent Chromium profile under `user_data/` to keep you logged in.
- Ensures the tab bar and merge box are included by expanding the clip rectangle in [`capture-pr-comments-with-merge.captureCombinedArea`](capture-pr-comments-with-merge.js).
- Handles login detection through [`capture-pr-comments-with-merge.performLogin`](capture-pr-comments-with-merge.js) and theme prep via [`capture-pr-comments-with-merge.preparePageForCapture`](capture-pr-comments-with-merge.js).
- Styling tweaks live in [`capture-pr-comments-with-merge.CUSTOM_CSS`](capture-pr-comments-with-merge.js).

Usage:

```sh
node capture-pr-comments-with-merge.js https://github.com/owner/repo/pull/123
```

On first run you will be prompted to log in manually; subsequent executions reuse the session.

## Output

- `pr-comments.png` — screenshot produced by the lightweight script.
- `pr-comments-with-merge.png` — screenshot including tabs and merge box.

Both renders use transparent backgrounds so they can be overlaid onto slides or documents.

## Tips

- Increase viewport height limits via `MAX_VIEWPORT_HEIGHT` in [capture-pr-comments.js](capture-pr-comments.js) or `CONFIG.maxViewportHeight` in [capture-pr-comments-with-merge.js](capture-pr-comments-with-merge.js) when dealing with long threads.
- Adjust `CONFIG.preThemeDelay` / `CONFIG.postStyleDelay` in [capture-pr-comments-with-merge.js](capture-pr-comments-with-merge.js) if styles apply too early or late on slower networks.
- The `.gitignore` already omits `temp/` and `user_data/`; keep screenshots or session files there to avoid accidental commits.
