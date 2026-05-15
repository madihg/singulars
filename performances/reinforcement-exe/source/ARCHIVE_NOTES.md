# archive notes

this directory archives the unique source from the original `madihg/reinforcement`
github repository so it can be safely deleted upstream.

what's here:
- `app/` - the original next.js `app/` directory (routes, components, assets)
- `public/` - custom static assets from the original repo
- `scripts/` - fine-tune training scripts and data
- `README.md`, `LICENSE.md` - originals from upstream
- any `.jsonl` at the source root - original training data

renamed extensions:
to keep the singulars build clean, every `.ts` and `.tsx` file in this
archive has been suffixed with `.txt` (e.g. `page.tsx` -> `page.tsx.txt`).
the file contents are byte-identical to the originals - only the extension
changed, so the typescript compiler in the singulars repo doesn't try to
type-check archived source. to revive the standalone app, strip the `.txt`
suffix from every file.

skipped (next.js boilerplate, regenerable):
`package.json`, `package-lock.json`, `pnpm-lock.yaml`,
`next.config.js`, `postcss.config.js`, `tailwind.config.js`,
`prettier.config.js`, `tsconfig.json`, `.gitignore`, `.DS_Store`,
`node_modules/`, `.next/`.
