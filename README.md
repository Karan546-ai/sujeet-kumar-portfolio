# Sujeet Kumar — Portfolio

A personal portfolio website for Sujeet Kumar, showcasing AI video editing,
motion design, content creation, and selected creative work.

## Preview

Open [`index.html`](./index.html) in a modern web browser. The site is a
standalone HTML page and does not require a build step or package installation.

## Project structure

```text
.
├── index.html
└── assets/
    ├── css/
    ├── fonts/
    ├── icon/
    ├── images/
    └── js/
```

The page loads stylesheets, scripts, fonts, and media from the local `assets/`
directory. Keep that directory alongside `index.html` when copying or deploying
the site.

## Run locally

1. Download or clone this repository.
2. Open `index.html` in a browser.

For local web-server preview, run this from the repository root:

```bash
python -m http.server 8000
```

Then visit <http://localhost:8000>.

## Deployment

This static site can be hosted by GitHub Pages or any static web host. To use
GitHub Pages from this repository, configure the repository's **Pages** settings
to deploy from the `main` branch and the root (`/`) folder.

## Videos come from Google Drive

Every video on the site (Showreel + Portfolio) comes from the public Drive folder
<https://drive.google.com/drive/folders/1fooEe5ArRjdA7RegVuvokmxkLJLbi41o>.
Nothing is hard-coded.

- **Add a video:** upload it into one of the category folders (BEST WORK, AI WORK, …)
  or straight into the main folder (shows under "New Uploads"). Sharing must stay
  "Anyone with the link".
- **Remove a video:** delete it from Drive.
- **Showreel** shows the 9 newest videos in BEST WORK.

How it stays in sync:

1. `netlify/functions/drive-work.mjs` reads the Drive folder live at `/api/drive-work`
   (cached ~1 minute), so uploads and deletions show on the site within a minute or two.
2. `.github/workflows/sync-drive.yml` runs `scripts/sync-drive.mjs` every hour. It rewrites
   `assets/js/work-data.js` (the fallback list used for first paint and on non-Netlify hosts),
   makes poster frames for new videos and deletes posters of removed ones.
