# WAV Sorter

A static, text-only pairwise ranking sorter for WAV community usernames.

Live site: https://hxakaxinyufan.github.io/wavsorter/

## Important design rule

WAV entries are usernames/text only. There are no profile pictures, avatars, member photos, image URLs, or image fallbacks attached to a WAV entry.

The only images that may exist in `public/` are normal site assets such as a favicon. They are not associated with usernames.

## Main features

- Select any subset of the 93 current WAV entries.
- Search the selection list by username/nickname.
- Pairwise ranking with randomized starting order.
- Undo during sorting, including Ctrl/Cmd + Z.
- Autosave unfinished progress to `localStorage` and resume after a refresh.
- Saves the user's WAV selection locally.
- Top 30 results by default, with an option to show the complete ranking.
- Undo the final choice from the results page.
- Download a text-only Top 30 PNG generated locally in the browser.
- Share a Top 10 summary to X.
- Dark mode.
- Optional shuffled background music.
- Keyboard support: left/right arrow keys choose the left/right WAV.
- GitHub Pages deployment through GitHub Actions.

## Project structure

```text
assets/
  member-data.js     # the text-only WAV list
  sorter-class.js    # ranking algorithm + serializable state/undo
  sorter.js          # UI, autosave, results, music, keyboard controls
  sorter.css         # all site styling
public/
  *.mp3              # local background playlist
  robots.txt
  sitemap.xml
  site.webmanifest
.github/workflows/
  deploy.yml         # tests, builds and deploys to GitHub Pages
```

## Update the WAV list

Edit `assets/member-data.js` only:

```js
export const wavNames = [
  "@username",
  "@anotherusername (nickname)",
];
```

Do not add image objects or avatar URLs. The application renders every name with `textContent`, so Discord names containing HTML-like characters are treated as text instead of markup.

## Run locally

```bash
npm install
npm run dev
```

## Test

```bash
npm test -- --runInBand
```

## Build

```bash
npm run build
```

The production site is deployed under `/wavsorter/`. If the GitHub repository is ever renamed, change `GITHUB_PAGES_BASE` in `vite.config.js`. Runtime public assets use `import.meta.env.BASE_URL`, so the path does not need to be duplicated throughout the JavaScript.

## Deployment

A push to the `master` branch runs `.github/workflows/deploy.yml`:

1. `npm ci`
2. tests
3. Vite build
4. deploy `dist/` to GitHub Pages

The GitHub repository must have Pages set to **GitHub Actions** as its deployment source.
