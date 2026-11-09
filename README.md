# New York Lot Atlas

Static browser map of New York State tax parcels: owner of record, assessed and full market values, property class and building facts from county assessment rolls, NYC zoning districts and MapPLUTO zoning/FAR, satellite imagery, Street View, and a property-file module (branded reports, NY agreement and disclosure worksheets, pre-offer checklist, documents). No backend or accounts; property files stay in the browser.

## Run and build

`npm ci`, then `npm run build` and `node scripts/serve-dist.mjs dist 5200`. Deployed on Vercel from GitHub (`main` auto-deploys).

## Data

| Layer | Source | How |
|---|---|---|
| Tax parcels, owners, values | [NYS Tax Parcels Public](https://gis.ny.gov/parcels) (NYS GIS Program Office) | Queried live per view and per click |
| Address search | NYS Street and Address Composite locator | Live |
| NYC zoning, overlays, FAR, landmarks | [MapPLUTO](https://www.nyc.gov/site/planning/data-maps/open-data/dwn-pluto-mappluto.page) | Live per NYC parcel |
| NYC zoning districts (map colours) | [NYZD](https://www.nyc.gov/site/planning/data-maps/open-data/dwn-gis-zoning.page) | `public/data/zones.geojson` |
| County outlines | NYS Civil Boundaries | `public/data/territories.geojson` |

Rebuild the static layers with `python3 scripts/prepare_ny.py --output public/data --checked-date YYYY-MM-DD` (needs `shapely`). Only counties that share parcels with the State appear (38 of 62 at the last check); the list is in `metadata.json`. Outside NYC, zoning is local and not published statewide.
