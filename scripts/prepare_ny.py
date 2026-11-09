#!/usr/bin/env python3
"""Static layers for the New York Lot Atlas: county outlines, NYC zoning districts, links, metadata.

Parcels, owners and values are not stored: the app queries the NYS Tax Parcels Public service live.

  python3 scripts/prepare_ny.py --output public/data --checked-date YYYY-MM-DD
"""
import argparse, json, re, subprocess
from pathlib import Path
from shapely.geometry import shape, mapping

COUNTIES = 'https://services6.arcgis.com/EbVsqZ18sv1kVJ3k/arcgis/rest/services/NYS_Civil_Boundaries/FeatureServer/3/query'
NYZD = 'https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/nyzd/FeatureServer/0/query'
PARCELS = 'https://services6.arcgis.com/EbVsqZ18sv1kVJ3k/arcgis/rest/services/NYS_Tax_Parcels_Public/FeatureServer/1/query'
# NYC counties appear in the parcel layer under their borough names.
BOROUGHS = {'New York': 'Manhattan', 'Kings': 'Brooklyn', 'Queens': 'Queens', 'Bronx': 'Bronx', 'Richmond': 'Staten Island'}


def get(url, **params):
    q = '&'.join(f'{k}={v}' for k, v in params.items())
    return json.loads(subprocess.run(['curl', '-s', '--max-time', '180', f'{url}?{q}'], capture_output=True, check=True).stdout)


def family(z):
    if '/' in z or z.startswith('BPC'):
        return 'ZMX', 'Mixed residential & manufacturing' if '/' in z else 'Special mixed'
    if z.startswith('R'):
        return 'ZH', 'Residential'
    if z.startswith('C'):
        return 'ZC', 'Commercial'
    if z.startswith('M'):
        return 'ZI', 'Manufacturing'
    if z.startswith('PARK'):
        return 'ZCON', 'Park'
    return 'ZX', 'Other'


def main():
    a = argparse.ArgumentParser()
    a.add_argument('--output', required=True)
    a.add_argument('--checked-date', required=True)
    a = a.parse_args()
    out = Path(a.output)
    out.mkdir(parents=True, exist_ok=True)

    # Counties with parcel data in the public layer (others have not opted in to sharing).
    shared = {f['attributes']['COUNTY_NAME'] for f in get(PARCELS, where='1%3D1', outFields='COUNTY_NAME', returnDistinctValues='true',
                                                             returnGeometry='false', f='json')['features']}
    shared = {'New York' if c == 'NewYork' else 'St. Lawrence' if c == 'StLawrence' else c for c in shared}
    counties = get(COUNTIES, where='1%3D1', outFields='NAME,FIPS_CODE', outSR='4326', maxAllowableOffset='0.001', f='geojson')['features']
    terr, links = [], {}
    for f in counties:
        name, code = f['properties']['NAME'], f['properties']['FIPS_CODE']
        nyc = name in BOROUGHS
        label = BOROUGHS[name] if nyc else f'{name} County'
        terr.append({'type': 'Feature', 'properties': {'code': code, 'name': label, 'type': 'borough' if nyc else 'city', 'offIsland': True,
                                                       'parcels': name in shared}, 'geometry': f['geometry']})
        links[code] = {'zoning': 'https://zola.planning.nyc.gov/' if nyc else f'https://www.google.com/search?q={name.replace(" ", "+")}+County+NY+town+zoning+map',
                       'zoningLabel': 'NYC zoning map (ZoLa)' if nyc else 'Find the town or village zoning map',
                       'site': 'https://www.nyc.gov/site/finance/property/property.page' if nyc else f'https://www.google.com/search?q={name.replace(" ", "+")}+County+NY+real+property+tax+services',
                       'roll': 'https://a836-pts-access.nyc.gov/care/search/commonsearch.aspx?mode=persprop' if nyc else None}
    (out / 'territories.geojson').write_text(json.dumps({'type': 'FeatureCollection', 'features': terr}, separators=(',', ':')))
    (out / 'territory-links.json').write_text(json.dumps(links, indent=0))

    # NYC zoning districts (base districts), one zone per polygon.
    feats, index = [], []
    for off in range(0, 8000, 2000):
        page = get(NYZD, where='1%3D1', outFields='ZONEDIST', outSR='4326', geometryPrecision='6', resultOffset=str(off),
                   resultRecordCount='2000', orderByFields='OBJECTID', f='geojson')['features']
        for i, f in enumerate(page):
            z = (f['properties']['ZONEDIST'] or '').strip()
            if not z or not f['geometry']:
                continue
            fam, label = family(z)
            g = shape(f['geometry'])
            props = {'code': f'NYC-{z}-{off + i}', 'number': z, 'type': f'New York City · {label}', 'family': fam,
                     'qualityIssue': not g.is_valid, 'city': 'New York City',
                     'grid': f'https://zr.planning.nyc.gov/'}
            feats.append({'type': 'Feature', 'properties': props, 'geometry': mapping(g)})
            c = g.representative_point()
            index.append({**props, 'center': [round(c.x, 6), round(c.y, 6)], 'bounds': [round(v, 6) for v in g.bounds]})
        if len(page) < 2000:
            break
    (out / 'zones.geojson').write_text(json.dumps({'type': 'FeatureCollection', 'features': feats}, separators=(',', ':')))
    (out / 'zones-index.json').write_text(json.dumps(index, separators=(',', ':')))

    count = get(PARCELS, where='1%3D1', returnCountOnly='true', f='json')['count']
    meta = {'checkedDate': a.checked_date, 'zoningDate': a.checked_date, 'addressDate': a.checked_date, 'unitsDate': a.checked_date,
            'zoneCount': len(index), 'addressCount': 0, 'milieuCount': 0, 'addressShards': [], 'unitCount': count,
            'sharedCounties': sorted(shared), 'geometryIssues': [],
            'zoningSource': 'https://www.nyc.gov/site/planning/data-maps/open-data/dwn-gis-zoning.page',
            'addressSource': 'https://gis.ny.gov/address-points', 'transformations': 'Live parcel queries; NYC zoning districts copied unchanged.'}
    (out / 'metadata.json').write_text(json.dumps(meta, indent=1))
    print(len(terr), 'counties,', len(shared), 'with parcels;', len(index), 'NYC zoning districts;', count, 'parcels')


if __name__ == '__main__':
    main()
