# Upgrade wavsorterV2 to V3

This upgrade is designed for the existing GitHub Pages repository:

`https://github.com/HXakaXinyufan/wavsorterV2`

Live base path:

`https://hxakaxinyufan.github.io/wavsorterV2/`

## 1. Back up the current version

Before replacing files, create a backup branch or download the repository ZIP.

Example:

```bash
git checkout -b backup-before-v3
git push origin backup-before-v3
git checkout master
```

## 2. Replace these files with the V3 versions

```text
.github/workflows/deploy.yml
__tests__/sorter-class.test.js
assets/member-data.js
assets/sorter-class.js
assets/sorter.css
assets/sorter.js
index.html
package.json
package-lock.json
vite.config.js
README.md
public/404.html
public/robots.txt
public/site.webmanifest
public/sitemap.xml
```

Keep all existing `public/*.mp3` files and `public/favicon.ico`.

## 3. Delete old inherited files

These are no longer used:

```text
.gitmodules
404.html
build-songs.sh
bun.lock
google63b955d49c220275.html
pic-updater.cjs
postcss.config.js
public/main-og-image.jpg
public/og-image.jpg
```

If one of these files is already absent, do nothing.

## 4. WAV data is text only

`assets/member-data.js` now contains only:

```js
export const wavNames = [
  "@username",
  "@anotherusername (nickname)",
];
```

There is no avatar field, image field, image URL, fallback image, or member-photo system.

To add/remove/rename a WAV later, only edit this array.

## 5. What V3 changes

### Sorting / UX

- keeps the generic merge-sort ranking engine
- keeps Undo
- adds Undo for the final result choice
- supports Arrow Left / Arrow Right choices
- supports Ctrl/Cmd + Z for Undo
- uses the upstream-style double `requestAnimationFrame` interaction update so clicks render immediately
- removes the old Top 50 ceiling; results are Top 30 or the full ranking
- adds Sort Again and Change Selection

### Selection screen

- search usernames/nicknames
- selected count
- saves the last selection in localStorage
- Select All / Clear All / Reset Saved Selection

### Autosave

- saves unfinished sorter state to localStorage after each decision
- shows a Resume panel after refresh/reopening the site
- persists the latest 20 Undo snapshots with the saved session
- no server or database is needed

### Security / correctness

- usernames are created with DOM nodes and `textContent`
- usernames are never injected with `innerHTML`
- X share URLs use `URLSearchParams`
- sorter state is validated before restore

### Results

- Top 30 by default
- Show all 93 (or however many were selected)
- client-side text-only Top 30 PNG download
- no profile images are used in the PNG
- Share to X uses a compact Top 10 summary plus the site URL

### GitHub Pages

- `vite.config.js` contains the deployment base path in one constant: `/wavsorterV2/`
- audio URLs use `import.meta.env.BASE_URL`
- corrected robots.txt, sitemap and web manifest
- GitHub Actions now runs tests before deploying

## 6. Test locally

```bash
npm ci
npm test -- --runInBand
npm run dev
```

For a production build:

```bash
npm run build
```

The output goes to `dist/`.

## 7. Deploy

Commit and push to `master`:

```bash
git add -A
git commit -m "Upgrade WAV Sorter to V3"
git push origin master
```

The workflow in `.github/workflows/deploy.yml` will test, build and deploy the site.

In GitHub, `Settings -> Pages -> Build and deployment` should use **GitHub Actions**.

## Important: do not merge current SSSorter master wholesale

The original project now contains photo loading, responsive tripleS member images, Supabase authentication/history, and tripleS-specific behavior. Those are intentionally not included here.

V3 only ports ideas that make sense for a static username-only WAV sorter: interaction timing, accessibility patterns, cleaner result handling and maintainability.
