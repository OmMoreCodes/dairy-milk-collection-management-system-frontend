# Dairy Milk Collection Management System — Frontend
[![Netlify Status](https://api.netlify.com/api/v1/badges/aed53d78-0774-4735-bfdd-b39985cbe928/deploy-status)](https://app.netlify.com/projects/milk-collection-management-system/deploys)

Frontend for the Dairy Milk Collection Management System, built with **HTML5, CSS3 and vanilla JavaScript** (no frameworks). 11 HTML pages, one stylesheet and 10 JavaScript files.

The matching REST API lives in the sibling `backend/` folder of this project.

## Run

Start the backend first (see `backend/README.md`), then serve this folder with any static server — for example the VS Code **Live Server** extension — or simply open `index.html` in your browser.

The frontend calls the backend at the address defined in `js/config.js`:

```js
const API_BASE_URL = 'http://localhost:5000';
```

If your backend runs somewhere else, change this one line.

## Test

```bash
npm test
```

Runs `tests/test-finishing.js` (22 checks). It loads the real `js/common.js` into a sandbox with a localStorage shim and verifies the logout-confirm wiring and the per-page filter persistence helpers (save / load / clear round-trips, control restoration, page-namespace isolation). Pure Node — no server, no database and no npm dependencies required.

## Pages

| Page | Purpose |
|------|---------|
| `index.html` | Landing page |
| `login.html` / `register.html` | Organization login and registration |
| `dashboard.html` | Today's liters, collections, amount and active farmers, with quick links |
| `farmers.html` | Add, search, edit and deactivate farmers |
| `collection.html` | Record morning/evening milk collections |
| `history.html` | Filter collection history by date range, farmer, shift and milk type |
| `rates.html` | Cow/Buffalo rates with effective dates and history |
| `reports.html` | Daily, monthly and custom date-range reports |
| `statement.html` | Per-farmer period statement with PDF export |
| `profile.html` | Operator details, dairy details and password change |

## Structure

```
frontend/
├── *.html             # 11 pages
├── favicon.svg        # browser tab icon (milk-drop brand mark)
├── css/style.css      # design system, light + dark theme
├── js/
│   ├── config.js      # API_BASE_URL (single definition)
│   ├── common.js      # shared shell, sidebar, theme, modals, filter helpers
│   └── ...            # one file per page
└── tests/             # automated frontend checks
```
