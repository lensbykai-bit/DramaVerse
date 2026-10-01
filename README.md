# DramaVerse

Static DramaVerse website for GitHub Pages.

## Files

- `index.html` — homepage
- `css/style.css` — Dark/Light responsive theme
- `js/app.js` — search, filters, cards, modal and theme toggle
- `data/movies.json` — movie/poster/price/Telegram data
- `admin.html` — shortcut page for editing content on GitHub

## Edit movies

Open:

`https://github.com/lensbykai-bit/DramaVerse/edit/main/data/movies.json`

Each movie can use:

```json
{
  "id": "dv-001",
  "title": "ឈ្មោះរឿង",
  "category": ["AI", "VIP", "new"],
  "badge": "VIP",
  "price": "2,000៛",
  "rating": 4.9,
  "episode": "រឿងពេញ",
  "description": "សេចក្តីពិពណ៌នា",
  "poster": "https://example.com/poster.jpg",
  "watchUrl": "https://t.me/your-link"
}
```

## Publish with GitHub Pages

In the repository go to:

`Settings → Pages → Build and deployment → Deploy from a branch`

Choose:

- Branch: `main`
- Folder: `/ (root)`

Then save.

The expected Pages URL is:

`https://lensbykai-bit.github.io/DramaVerse/`
