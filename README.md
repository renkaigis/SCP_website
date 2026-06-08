# SCP Static Website

Static rebuild of the International Society for Smart Construction and
Production website.

## Project Structure

- `isscpi/`: read-only WordPress backup and source archive.
- `tools/build-site.mjs`: static site generator.
- `src/styles/`: editable CSS source.
- `src/scripts/`: editable browser JavaScript source.
- `public/`: generated static website for local preview and GitHub Pages.

The repository root is intentionally kept clean. Do not edit the generated
HTML in `public/` directly; update the generator or source assets, then rebuild.

## Build

```bash
npm run build
```

The build reads from `isscpi/`, copies archived media into `public/assets/`,
adds the source CSS and JavaScript, and generates:

- A redesigned institutional homepage
- All archived WordPress pages and posts at their preserved URL paths
- Structured top-level pages for About, Research, Membership, Awards,
  Conferences, Journals, Governance, IPC2026, Contact, and nominations
- News archive, client-side search, 404 page, sitemap, robots file, and CNAME

## Preview

```bash
npm run serve
```

Then open `http://localhost:4173`.

Contact, nomination, and payment actions that previously depended on WordPress
plugins are presented as static guidance with secretariat contact links.
