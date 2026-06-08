# SCP Static Website

Static rebuild of the International Society for Smart Construction and
Production website.

The archived WordPress export in `isscpi/` is treated as a read-only content
source. The generated website, assets, and build tooling live in the repository
root.

## Build

```bash
node generate.mjs
```

## Preview

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

The generator creates:

- A redesigned institutional homepage
- All 17 archived WordPress pages
- All 12 archived posts at their original URL paths
- News archive, client-side search, 404 page, sitemap, and robots file
- Local copies of the archived media and documents

Contact, nomination, and payment actions that previously depended on WordPress
plugins are presented as static guidance with secretariat contact links.
