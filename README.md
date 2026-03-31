# Wallpaper Vault

A static, searchable wallpaper library built with 11ty and vanilla web components.

Fork it, add wallpapers under `wallpapers/`, push to `main`, and GitHub Pages can publish the gallery automatically.

## Quick Start

### Use this repo

1. Edit `_data/site.json` with your title, description, base URL, and theme colors.
2. Add wallpapers to themed folders under `wallpapers/`.
3. Run the local build to generate the index and thumbnails.
4. Push to `main` to deploy through GitHub Pages.

### Local development

```bash
nvm use        # Node 22+
npm install
npm run dev    # builds index + thumbnails, then starts 11ty on :8081
```

## Folder Structure

```text
wallpapers/
  landscapes/
    my-wallpaper.jpg
  pixelart/
    neon-city.png
  japan/
    temple-night.webp
  vertical/
    phone-background.jpg
```

The first folder under `wallpapers/` becomes the wallpaper theme automatically.

## Optional Metadata

Drop a `_meta.yaml` file into any theme folder to override titles or tags:

```yaml
defaults:
  tags: ["favorite", "curated"]

files:
  neon-city.png:
    title: "Neon City"
    tags: ["city", "night", "cyberpunk"]
```

Folder `defaults.tags` are added to the auto-generated tags. Per-file `tags` replace filename-derived tags, while keeping the theme tag.

## Features

- Search by title, theme, size, or tags
- Theme filters and size filters
- Favorites saved in `localStorage`
- Lightbox preview with previous/next navigation
- Copy direct wallpaper URL
- Download original files
- Dark/light theme toggle
- Responsive gallery with generated WebP thumbnails

## Keyboard Shortcuts

| Key | Context | Action |
|-----|---------|--------|
| `/` | Anywhere | Focus search |
| `Escape` | Search / Lightbox | Blur or close |
| `Enter` / `Space` | Focused card | Open preview |
| `D` | Card / Lightbox | Download wallpaper |
| `F` | Card / Lightbox | Toggle favorite |
| `Arrow Left/Right` | Lightbox | Previous / next wallpaper |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Build wallpaper index, generate thumbnails, start local server |
| `npm run build` | Build the full static site into `_site/` |
| `npm run index` | Rebuild `_data/wallpapers.json` only |
| `npm run thumbs` | Regenerate thumbnails from the current index |

## Deployment

This repo includes `.github/workflows/deploy.yml`, which:

- runs on pushes to `main`
- installs Node 22 and `ffmpeg`
- builds the site with `ELEVENTY_PATH_PREFIX=/wallpapers/`
- deploys `_site/` to GitHub Pages

For manual deployment:

```bash
npm run build
```

Then upload `_site/` to any static host.

## Notes

- Current index size: about 3,533 wallpapers across 24 themes.
- Supported indexed formats: `jpg`, `jpeg`, `png`, `webp`, `gif`, `mp4`, `webm`.
- Thumbnail generation currently works for image formats. Video files are indexed, but thumbnail extraction is not implemented yet.

## Tech Stack

- [11ty](https://www.11ty.dev/) v3
- Vanilla JS custom elements
- Plain CSS with custom properties
- [`sharp`](https://sharp.pixelplumbing.com/) for dimensions and thumbnails

## License

[MIT](LICENSE)
