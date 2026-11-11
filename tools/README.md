# Building the home page

`index.html` and `en/index.html` are **generated**. Do not edit them by hand: the next build overwrites them.

1. Edit `tools/src/index.html` (the English source; Arabic strings live in its `AR_DICT`).
2. Run `python3 tools/build_static.py --grids` (needs `google-chrome`).
3. Commit `tools/src/index.html`, `index.html` and `en/index.html` together.

What the build does:

- `index.html`: the Arabic page, with the Arabic text, main heading and product grids already in the HTML, so search engines and AI crawlers that do not run JavaScript read Arabic at `https://hudera.ai/`.
- `en/index.html`: the English page with its own title, description and canonical, and in-page links that stay on `/en/`.

Blog pages are built separately with `python3 tools/build_blog.py`.
