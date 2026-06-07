# Quill Mobile Sharing

This app is built as a mobile-friendly static PWA. There is no backend, login, or server database.
Each person who opens it saves their own fonts locally in that phone browser.

For a real Android APK, use the GitHub Actions workflow described in `docs/android-app.md`.

## Build

```bash
npm run build
```

## Browser Link

The public browser version is served from:

```text
https://thecameronboyer-beep.github.io/quill/
```

To publish the current browser build to that link:

```bash
npm run publish:browser
```

That command builds `dist`, then copies the generated app files into `docs` for GitHub Pages.

Upload the contents of:

```text
D:\quill\dist
```

to any static host that gives you an HTTPS URL.

Good easy options:

- Netlify Drop: drag the `dist` folder into Netlify
- Cloudflare Pages: upload/deploy the `dist` folder
- GitHub Pages: publish the built files

## Friend Install

Send your friend the HTTPS link.

On Android Chrome:

- Open the link
- Tap the browser menu
- Tap `Add to Home screen` or `Install app`

On iPhone Safari:

- Open the link
- Tap Share
- Tap `Add to Home Screen`

## Important

Fonts are saved locally on each device. If your friend draws fonts, their fonts stay on their phone/browser.
If they clear site data or browser storage, those local fonts can be removed.
