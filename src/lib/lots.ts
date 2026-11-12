import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';

// NYS Tax Parcels Public (NYS GIS Program Office): every county that shares its parcels, NYC included. Queried live; nothing is stored.
export const LOT_SERVICE = 'https://services6.arcgis.com/EbVsqZ18sv1kVJ3k/arcgis/rest/services/NYS_Tax_Parcels_Public/FeatureServer/1/query';
// NYC Department of Finance property valuation (market values; the State layer has none for NYC).
const DOF_VALUES = 'https://data.cityofnewyork.us/resource/8y4t-faws.json';
const PLUTO_SERVICE = 'https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/MAPPLUTO/FeatureServer/0/query';
export const LOT_MIN_ZOOM = 16;

/** NO_LOT is the statewide parcel key (SWIS + SBL); LABEL is the local tax-map number shown on the map. */
export type ParcelProps = { NO_LOT: string; LABEL: string; [field: string]: string | number | null };
export type LotFeature = Feature<Geometry | null, ParcelProps>;

/** Parcel keys are opaque; any non-empty input is passed through (map clicks use the statewide key). */
export function normalizeLot(input: string): string {
  return /^\d{12,}$/.test(input.trim()) || /^9\d{3,}$/.test(input.trim()) ? input.trim() : '';
}

const LIGHT = 'SWIS_SBL_ID,PRINT_KEY,SBL,PARCEL_ADDR';
async function query(params: Record<string, string>, signal?: AbortSignal): Promise<FeatureCollection<Geometry | null, ParcelProps>> {
  const body = new URLSearchParams({ outFields: '*', outSR: '4326', f: 'geojson', ...params });
  const response = await fetch(LOT_SERVICE, { method: 'POST', body, signal });
  if (!response.ok) throw new Error('Parcel service unavailable');
  const data = await response.json();
  if (data.error) throw new Error('Parcel service error');
  for (const f of data.features) {
    const p = f.properties;
    p.NO_LOT = String(p.SWIS_SBL_ID || p.OBJECTID || '');
    p.LABEL = String(p.PRINT_KEY || p.SBL || '');
  }
  return data;
}

// Counties that do not share parcels with the State layer, read from each county's (or regional agency's) own public service
// and mapped onto the State field names. Keys are '9' + 2-digit source index + object id, so they never collide with SWIS keys.
type Attrs = Record<string, string | number | null>;
const RPS_SEWER: Record<string, string> = { '1': 'None', '2': 'Private', '3': 'Comm/public', '4': 'Comm/private' };
const RPS_WATER: Record<string, string> = { '1': 'None', '2': 'Private', '3': 'Comm/public', '4': 'Comm/private' };
const s_ = (v: unknown) => typeof v === 'string' ? v.trim() || null : typeof v === 'number' ? String(v) : null;
const words = (...v: unknown[]) => v.map(s_).filter(Boolean).join(' ') || null;
export interface CountySource { county: string; url: string; where?: string; bbox: [number, number, number, number]; id: string; map: (a: Attrs) => Attrs; sales?: 'niagara' | 'cattaraugus'; note?: string }
export const COUNTY_SOURCES: CountySource[] = [
  { county: 'Nassau', url: 'https://services6.arcgis.com/dptt3Slw4IV02m0l/arcgis/rest/services/Nassau_County_Parcels_v2/FeatureServer/0', bbox: [-73.77, 40.58, -73.42, 40.92], id: 'OBJECTID',
    map: a => ({ PARCEL_ADDR: words(a.LOC_ST_NBR, a.LOC_STREET, a.LOC_UNIT), MUNI_NAME: a.MUNI_NAME || a.CITYTOWN_N, SWIS: a.CITYTOWN_S, SBL: a.SBL, PRINT_KEY: a.MUNI_PARCE,
      PRIMARY_OWNER: a.PRIMARY_OW, MAIL_ADDR: a.MAIL_ADDR, PO_BOX: a.PO_BOX, MAIL_CITY: a.MAIL_CITY, MAIL_STATE: a.MAIL_STATE, MAIL_ZIP: a.MAIL_ZIP, PROP_CLASS: a.PROP_CLASS, ACRES: a.ACRES }) },
  { county: 'Monroe', url: 'https://services1.arcgis.com/yisUfwZZ4fyubK3R/arcgis/rest/services/Monroe_County_Parcels/FeatureServer/0', bbox: [-78.0, 42.94, -77.37, 43.37], id: 'OBJECTID',
    map: a => ({ PARCEL_ADDR: a.PARCELADDRESS, MUNI_NAME: a.PARCELADDRESSCITY, SWIS: a.SWIS, SBL: a.COUNTYSBL, PRINT_KEY: a.PRINTKEY, PRIMARY_OWNER: a.OWNERNAME1, ADD_OWNER: a.OWNERNAME2,
      MAIL_ADDR: a.OWNERSTREETADDRESS, PO_BOX: a.OWNERPOBOX, MAIL_CITY: a.OWNERCITYSTATEZIPCODE, FRONT: a.FRONTAGEFEET, DEPTH: a.DEPTHFEET, ACRES: a.ACRES, ROLL_YR: a.ROLLYEAR,
      TOTAL_AV: a.TOTALASSESSEDVALUE, LAND_AV: a.LANDASSESSEDVALUE, SCHOOL_NAME: a.SCHOOLDISTRICTNAME, PROP_CLASS: s_(a.PROPERTYCLASS), YR_BLT: a.YEARBUILT, BLDG_STYLE_DESC: a.BUILDINGSTYLE,
      SQFT_LIVING: a.SQUAREFEETLIVINGAREA, NBR_BEDROOMS: a.NUMBEROFBEDROOMS, NBR_FULL_BATHS: a.NUMBEROFFULLBATHROOMS, HEAT_TYPE_DESC: a.HEATTYPE, SEWER_DESC: a.SEWERTYPE, WATER_DESC: a.WATERSUPPLY,
      BOOK: a.HISTBOOK, PAGE: a.HISTPAGE }) },
  { county: 'Saratoga', url: 'https://services8.arcgis.com/L31p4Kvi5t2HjDqc/arcgis/rest/services/Parcels/FeatureServer/57', bbox: [-74.16, 42.77, -73.57, 43.4], id: 'OBJECTID',
    map: a => ({ PARCEL_ADDR: a.PROP_ADDR, MUNI_NAME: a.MUNI, SWIS: a.SWIS, SBL: a.SBL, PRINT_KEY: a.PRINT_KEY, PRIMARY_OWNER: a.OWNER, MAIL_ADDR: words(a.MAIL_1ADDR, a.MAIL_2ADDR), MAIL_CITY: a.MAIL_CITY,
      MAIL_STATE: a.MAIL_STATE, MAIL_ZIP: a.MAIL_ZIP, ACRES: a.ACRES, FRONT: a.FRONTAGE, DEPTH: a.DEPTH, PROP_CLASS: a.PRP_CLS_CODE, LAND_AV: a.LAND_AV, TOTAL_AV: a.TOTAL_AV, SCHOOL_NAME: a.SCHOOL,
      WATER_DESC: a.WATER, SEWER_DESC: a.SEWER, UTILITIES_DESC: a.UTILITIES, BOOK: a.DEED_BOOK, PAGE: a.DEED_PAGE, ROLL_YR: a.ROLL_YEAR }) },
  { county: 'Schoharie', url: 'https://services7.arcgis.com/fScJUugRnMdg5KWv/arcgis/rest/services/Parcels/FeatureServer/5', bbox: [-74.72, 42.35, -74.16, 42.83], id: 'OBJECTID',
    map: a => ({ PARCEL_ADDR: words(a.LOC_NUMBER, a.LOC_STREET), MUNI_NAME: a.MUNI, SWIS: a.SWIS, SBL: a.SBL, PRINT_KEY: a.PRINT_KEY, PRIMARY_OWNER: a.OWNER, ADD_OWNER: a.OWNER2,
      MAIL_ADDR: words(a.MAIL_1ADDR, a.MAIL_2ADDR), MAIL_CITY: a.MAIL_CITY, MAIL_STATE: a.MAIL_STATE, MAIL_ZIP: a.MAIL_ZIP, ACRES: a.ACRES_1, PROP_CLASS: a.PRP_CLS_CO, LAND_AV: a.LAND_AV,
      TOTAL_AV: a.TOTAL_AV, BOOK: a.DEED_BOOK, PAGE: a.DEED_PAGE }) },
  { county: 'Schenectady', url: 'https://services3.arcgis.com/DvTqoyLKkslnGFR5/arcgis/rest/services/Final21/FeatureServer/0', bbox: [-74.31, 42.71, -73.8, 42.96], id: 'FID',
    note: 'roll extract from 2021',
    map: a => ({ PARCEL_ADDR: a.PROP_ADDR, SWIS: s_(a.SWIS), PRINT_KEY: a.PRINT_KEY, PRIMARY_OWNER: a.OWNER, MAIL_ADDR: a.STREET, MAIL_CITY: a.CITY_STATE, ACRES: a.ACRES, FRONT: a.FRONT_FEET,
      DEPTH: a.DEPTH_FEET, PROP_CLASS: a.PROP_CLASS, TOTAL_AV: a.CURR_TOT, ROLL_YR: '2021' }) },
  // Development Authority of the North Country: Clinton, Essex, Franklin and Jefferson (its other counties are in the State layer).
  { county: '', url: 'https://maps.dancgis.org/server/rest/services/Parcel_Model/MapServer/0', where: "COUNTY IN ('CLINTON','ESSEX','FRANKLIN','Jefferson','JEFFERSON - Watertown')",
    bbox: [-76.45, 43.62, -73.28, 45.06], id: 'OBJECTID',
    map: a => ({ COUNTY_NAME: String(a.COUNTY || '').replace(/ - .*/, '').toLowerCase().replace(/^./, c => c.toUpperCase()), PARCEL_ADDR: a.PARCEL_ADD, MUNI_NAME: a.MUNI_NAME, SWIS: a.SWIS, SBL: a.SBL,
      PRINT_KEY: a.PRINT_KEY, PRIMARY_OWNER: a.PRIMARY_OW, ADD_OWNER: a.ADD_OWNER, MAIL_ADDR: words(a.MAIL_ADDR, a.MAIL_ADDR2), MAIL_CITY: a.MAIL_CITY, MAIL_STATE: a.MAIL_STATE, MAIL_ZIP: a.MAIL_ZIP,
      ACRES: a.ACRES, CALC_ACRES: a.CALC_ACRES, FRONT: a.FRONT, PROP_CLASS: a.PROP_CLASS, LAND_AV: a.LAND_AV, TOTAL_AV: a.TOTAL_AV, FULL_MARKET_VAL: a.FULL_MARKE, YR_BLT: a.YR_BLT }) },
  // Mohawk Valley regional layer: class, year built, water and sewer only (no owner names).
  { county: '', url: 'https://services2.arcgis.com/okXm0pb6aWH6XOGI/arcgis/rest/services/Tax_Parcels_new/FeatureServer/0', where: "County IN ('Delaware','Fulton','Herkimer','Madison')",
    bbox: [-76.01, 41.85, -74.08, 44.1], id: 'OBJECTID', note: 'regional layer without owner names',
    map: a => ({ COUNTY_NAME: a.County, SWIS: a.SWIS, SBL: a.SBL, PRINT_KEY: a.PrintKey, PROP_CLASS: a.PROP_CLASS, YR_BLT: a.YR_BUILT, SEWER_DESC: RPS_SEWER[String(a.SEWER)] || null,
      WATER_DESC: RPS_WATER[String(a.WATCODE)] || null }) },
  // Niagara's server sends no CORS headers, so it goes through the site's /gis/niagara rewrite.
  { county: 'Niagara', url: '/gis/niagara/PublicViewer/Public_Viewer/FeatureServer/4', bbox: [-79.08, 43.01, -78.46, 43.38], id: 'OBJECTID_1', sales: 'niagara',
    map: a => ({ PARCEL_ADDR: words(a.PrclNumb, a.PrclStreet), MUNI_NAME: a.PrclMuni, SWIS: a.SwisCode, SBL: a.SBL, PRINT_KEY: a.PrintKey, PRIMARY_OWNER: a.OwnrName, MAIL_ADDR: a.own_street_address,
      MAIL_CITY: a.own_city_state_zip, ACRES: a.ACRES, FRONT: a.Frontage, DEPTH: a.Depth, PROP_CLASS: a.PropClsite, LAND_AV: a.LandAssess, TOTAL_AV: a.TotAssess, FULL_MARKET_VAL: a.FullMktVal,
      YR_BLT: a.YrBuilt, BLDG_STYLE_DESC: a.Bldgstyl, SQFT_LIVING: a.SFLA, BOOK: a.Book, PAGE: a.Page, NIAGARA_SALE_DATE: a.SaleDate, NIAGARA_SALE_PRICE: a.SalePrice }) },
  { county: 'Cattaraugus', url: 'https://maps2.cattco.org/arcgiswebadaptor/rest/services/ParcelandSales_Viewer/MapServer/3', bbox: [-79.07, 41.99, -78.3, 42.55], id: 'OBJECTID', sales: 'cattaraugus',
    map: a => ({ PARCEL_ADDR: words(a.LOC_NO, a.PROP_LOC), SWIS: a.SWIS, PRINT_KEY: a.TAX_MAP_NO, SBL: a.PRINTKEY, PRIMARY_OWNER: a.OWNER1, MAIL_ADDR: words(a.PO_BOX, a.STREET), MAIL_CITY: a.CITY_STATE,
      PROP_CLASS: a.CLASS_CODE, ACRES: a.ACRES, FRONT: a.FRONTAGE, DEPTH: a.DEPTH, BOOK: a.DEED_BOOK, PAGE: a.DEED_PAGE }) },
  { county: 'Chemung', url: 'https://services5.arcgis.com/Zuw6weNBpZX2wFbS/arcgis/rest/services/Chemung_County_Property_Parcels/FeatureServer/0', bbox: [-76.97, 41.99, -76.53, 42.3], id: 'OBJECTID',
    note: 'parcel map without assessment data',
    map: a => ({ PARCEL_ADDR: a.RPS_ADDRESS || a.Parcel_Location, MUNI_NAME: a.Muni_Name, SBL: a.SBL, PRINT_KEY: a.PrintKey, CALC_ACRES: a.Calc_Acre, DEED_REF: a.DEEDBK_PG }) },
  { county: 'Dutchess', url: 'https://services7.arcgis.com/qa9lgxOEmOSHoWNZ/arcgis/rest/services/County_Parcels/FeatureServer/0', bbox: [-74.0, 41.44, -73.48, 42.09], id: 'FID',
    note: 'parcel map without assessment data',
    map: a => ({ SWIS: a.Swis, PRINT_KEY: a.PrintKey, SBL: a.Parcelgrid }) }
];
/** Counties with no open parcel service at all (owners and values only on each county's own site). */
export const CLOSED_COUNTIES = ['Allegany', 'Chenango', 'Columbia', 'Orleans', 'Seneca', 'Washington', 'Yates'];

async function countyQuery(i: number, params: Record<string, string>, signal?: AbortSignal): Promise<LotFeature[]> {
  const src = COUNTY_SOURCES[i];
  const p = { outFields: '*', outSR: '4326', f: 'geojson', where: src.where || '1=1', ...params };
  if (src.where && params.where) p.where = `(${src.where}) AND (${params.where})`;
  const response = await fetch(`${src.url}/query`, { method: 'POST', body: new URLSearchParams(p), signal });
  if (!response.ok) return [];
  const data = await response.json();
  if (data.error || !Array.isArray(data.features)) return [];
  return data.features.map((f: LotFeature & { id?: number }) => {
    const a = f.properties as unknown as Attrs || {};
    const oid = Number(a[src.id] ?? f.id ?? 0);
    const m = src.map(a);
    const props: ParcelProps = { COUNTY_NAME: src.county || null, ...Object.fromEntries(Object.entries(m).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v ?? null])),
      NO_LOT: `9${String(i).padStart(2, '0')}${oid}`, LABEL: String(m.PRINT_KEY || m.SBL || oid), SWIS_SBL_ID: `9${String(i).padStart(2, '0')}${oid}`,
      SOURCE: src.note || null, SALES_SOURCE: src.sales || null } as ParcelProps;
    return { ...f, properties: props };
  });
}
const overlaps = (b: [number, number, number, number], c: [number, number, number, number]) => b[0] <= c[2] && b[2] >= c[0] && b[1] <= c[3] && b[3] >= c[1];

export async function lotsInBounds(bounds: [number, number, number, number], signal?: AbortSignal) {
  const state = query({ geometry: bounds.join(','), geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
    returnGeometry: 'true', outFields: LIGHT, resultRecordCount: '2000' }, signal);
  const counties = COUNTY_SOURCES.map((s, i) => overlaps(bounds, s.bbox) ? countyQuery(i, { geometry: bounds.join(','), geometryType: 'esriGeometryEnvelope', inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', resultRecordCount: '2000' }, signal).catch(() => []) : Promise.resolve([] as LotFeature[]));
  const [data, ...extra] = await Promise.all([state, ...counties]);
  data.features.push(...extra.flat());
  return data;
}

export async function findLot(input: string, signal?: AbortSignal): Promise<LotFeature | null> {
  const key = input.trim().replace(/'/g, '');
  if (!key) return null;
  if (/^9\d{3,}$/.test(key)) {
    const i = Number(key.slice(1, 3)), src = COUNTY_SOURCES[i];
    if (!src) return null;
    return (await countyQuery(i, { where: `${src.id} = ${Number(key.slice(3))}`, returnGeometry: 'true' }, signal))[0] || null;
  }
  const data = await query({ where: `SWIS_SBL_ID = '${key}'`, returnGeometry: 'true' }, signal);
  return data.features[0] || null;
}

export function lotCenter(feature: LotFeature): [number, number] | null {
  const g = feature.geometry;
  if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) return null;
  const rings: Position[] = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates.flatMap(p => p[0]);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of rings) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

function polygons(feature: LotFeature): Position[][][] {
  const g = feature.geometry;
  if (!g) return [];
  if (g.type === 'Polygon') return [g.coordinates];
  if (g.type === 'MultiPolygon') return g.coordinates;
  return [];
}
function inRing([x, y]: Position, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function inLot(point: Position, polys: Position[][][]): boolean {
  return polys.some(([outer, ...holes]) => inRing(point, outer) && !holes.some(h => inRing(point, h)));
}

/** Approximate area of the lot drawing in m² (spherical excess on small polygons). */
export function lotArea(feature: LotFeature): number | null {
  const polys = polygons(feature);
  if (!polys.length) return null;
  const R = 6378137, rad = Math.PI / 180;
  const ringArea = (ring: Position[]) => {
    let sum = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i], [x2, y2] = ring[i + 1];
      sum += (x2 - x1) * rad * (2 + Math.sin(y1 * rad) + Math.sin(y2 * rad));
    }
    return Math.abs(sum * R * R / 2);
  };
  return polys.reduce((total, [outer, ...holes]) => total + ringArea(outer) - holes.reduce((h, r) => h + ringArea(r), 0), 0);
}

export const SQFT_PER_M2 = 10.7639;

/** Opens Google Street View at the nearest panorama to a point. */
export function streetViewUrl([lng, lat]: [number, number]): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/** One assessment record from the NYS roll (one per parcel; NYC adds MapPLUTO zoning and building data). */
export interface Unit {
  id: string; label: string; center: [number, number]; use: string | null; category: string | null;
  floors: number | null; dwellings: number | null; builtYear: number | null; landArea: number | null; floorArea: number | null;
  marketDate: string | null; landValue: number | null; buildingValue: number | null; totalValue: number | null; previousValue: number | null;
  frontage: number | null;
  owner?: string | null; ownerMail?: string | null; marketValue?: number | null; propClass?: string | null; school?: string | null;
  county?: string | null; muni?: string | null; swis?: string | null; sbl?: string | null; bbl?: string | null; agDistrict?: string | null; sewer?: string | null; water?: string | null; utilityDesc?: string | null; heat?: string | null; deedRef?: string | null; sales?: Sale[] | null; infra?: Infra | null;
  utilities?: string | null; bedrooms?: number | null; baths?: number | null;
  zoning?: string | null; overlays?: string | null; special?: string | null; far?: string | null; landmark?: string | null; histDistrict?: string | null;
  depth?: number | null; source?: string | null; salesSource?: string | null;
}

// NYS Real Property System property class codes (first digit is the group).
const CLASS_GROUP: Record<string, string> = { '1': 'Agricultural', '2': 'Residential', '3': 'Vacant land', '4': 'Commercial', '5': 'Recreation & entertainment',
  '6': 'Community services', '7': 'Industrial', '8': 'Public services', '9': 'Wild, forest & parks' };
const CLASS: Record<string, string> = { '210': 'One-family residence', '215': 'One-family with apartment', '220': 'Two-family residence', '230': 'Three-family residence',
  '240': 'Rural residence with acreage', '250': 'Estate', '260': 'Seasonal residence', '270': 'Mobile home', '280': 'Multiple residences', '281': 'Multiple residences',
  '283': 'Residence with commercial use', '311': 'Residential vacant land', '312': 'Residential land with small improvement', '314': 'Rural vacant lot under 10 acres',
  '322': 'Rural vacant over 10 acres', '330': 'Commercial vacant land', '340': 'Industrial vacant land', '411': 'Apartments', '421': 'Restaurant', '422': 'Diner / luncheonette',
  '431': 'Auto dealer', '432': 'Service / gas station', '438': 'Parking lot', '449': 'Warehouse', '452': 'Neighborhood shopping center', '464': 'Office building',
  '465': 'Professional building', '481': 'Downtown row building', '482': 'Downtown row building, detached', '484': 'One-story small structure', '486': 'Mini-mart', '710': 'Manufacturing' };
// NYC rows carry MapPLUTO land-use codes instead.
const NYC_USE: Record<string, string> = { '01': 'One & two family buildings', '02': 'Multi-family walk-up', '03': 'Multi-family elevator', '04': 'Mixed residential & commercial',
  '05': 'Commercial & office', '06': 'Industrial & manufacturing', '07': 'Transportation & utility', '08': 'Public facilities & institutions', '09': 'Open space & recreation',
  '10': 'Parking facilities', '11': 'Vacant land' };
const NYC_COUNTIES = new Set(['NewYork', 'Kings', 'Queens', 'Bronx', 'Richmond']);
const num = (v: unknown) => typeof v === 'number' && v > 0 ? v : null;
const str = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim() : null;
const M2_PER_ACRE = 4046.8564, M_PER_FT = 0.3048;

export function useLabel(code: string | null, nyc: boolean): string | null {
  if (!code) return null;
  if (nyc) return NYC_USE[code] || code;
  return CLASS[code] ? `${CLASS[code]} (${code})` : `${CLASS_GROUP[code[0]] || 'Class'} (${code})`;
}

/** The parcel's roll record as a unit (NYS has one record per parcel), with NYC zoning from MapPLUTO. */
export interface Sale { date: string; price: number | null; type: string; buyer: string | null; seller: string | null; ref: string | null; units: number }
export interface Infra { electric: string[] }
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOC: Record<string, string> = { DEED: 'Deed', DEEDO: 'Deed (other)', 'DEED, RC': 'Deed, recorded copy', DEEDP: 'Deed, pre-RPT tax', CORRD: 'Correction deed', 'DEED, TS': 'Timeshare deed', CONDEED: 'Confirmatory deed' };
/** Every deed on a NYC lot, from ACRIS (NYC Department of Finance) open data: legals → master → parties. */
export async function acrisSales(bbl: string): Promise<Sale[]> {
  const soc = async (id: string, where: string, extra: Record<string, string> = {}) =>
    (await (await fetch(`https://data.cityofnewyork.us/resource/${id}.json?${new URLSearchParams({ $where: where, $limit: '1000', ...extra })}`)).json()) as Record<string, string>[];
  const legals = await soc('8h5j-fqxa', `borough='${bbl[0]}' AND block='${Number(bbl.slice(1, 6))}' AND lot='${Number(bbl.slice(6))}'`, { $select: 'document_id,unit' });
  const ids = [...new Set(legals.map(l => l.document_id))];
  if (!ids.length) return [];
  const docs: Record<string, string>[] = [];
  for (let i = 0; i < ids.length; i += 150) docs.push(...await soc('bnx9-e6tj', `document_id in(${ids.slice(i, i + 150).map(x => `'${x}'`).join(',')}) AND doc_type in(${Object.keys(DOC).map(x => `'${x}'`).join(',')})`));
  const deeds = docs.filter((d, i, l) => l.findIndex(x => x.document_id === d.document_id) === i);
  const parties = deeds.length ? await soc('636b-3b5g', `document_id in(${deeds.slice(0, 150).map(d => `'${d.document_id}'`).join(',')})`, { $select: 'document_id,party_type,name' }) : [];
  const who = (id: string, t: string) => [...new Set(parties.filter(p => p.document_id === id && p.party_type === t).map(p => p.name))].join(', ') || null;
  return deeds.map(d => {
    const dt = new Date(d.document_date || d.recorded_datetime);
    return { date: isNaN(+dt) ? '—' : `${MONTHS[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`, t: +dt || 0, price: Number(d.document_amt) || null, type: DOC[d.doc_type] || d.doc_type,
      seller: who(d.document_id, '1'), buyer: who(d.document_id, '2'), ref: d.crfn ? `CRFN ${d.crfn}` : d.reel_nbr && d.reel_nbr !== '0' ? `Reel ${d.reel_nbr} / page ${d.reel_pg}` : null,
      units: new Set(legals.filter(l => l.document_id === d.document_id).map(l => l.unit || '')).size };
  }).sort((a, b) => b.t - a.t).map(({ t: _t, ...x }) => x);
}
/** Every recorded sale on a Cattaraugus County parcel, from the county's public sales layer. */
export async function cattaraugusSales(swis: string, printKey: string): Promise<Sale[]> {
  const body = new URLSearchParams({ where: `SwisCode = '${swis.replace(/'/g, '')}' AND PrintKey = '${printKey.replace(/'/g, '')}'`, outFields: 'SDate,SalePrice,OwnrName,ValUseable', orderByFields: 'SDate DESC', returnGeometry: 'false', f: 'json' });
  const d = await (await fetch('https://maps2.cattco.org/arcgiswebadaptor/rest/services/ParcelandSales_Viewer/MapServer/0/query', { method: 'POST', body })).json();
  return (d.features || []).map((f: { attributes: Attrs }) => {
    const a = f.attributes, dt = new Date(Number(a.SDate));
    return { date: isNaN(+dt) ? '—' : `${MONTHS[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`, price: Number(a.SalePrice) || null,
      type: a.ValUseable === '1' ? 'Arm’s-length sale' : 'Sale (not arm’s-length)', buyer: s_(a.OwnrName), seller: null, ref: null, units: 1 };
  });
}
const ELECTRIC = 'https://services1.arcgis.com/XYYbHZEGlLw0p2gz/arcgis/rest/services/NYS_Electric_Utility_Service_Territories_20240820/FeatureServer/0/query';
export async function infrastructureAt([x, y]: [number, number]): Promise<Infra> {
  const q = new URLSearchParams({ geometry: `${x},${y}`, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'comp_full,notes', returnGeometry: 'false', f: 'json' });
  const d = await (await fetch(`${ELECTRIC}?${q}`)).json();
  return { electric: [...new Set<string>((d.features || []).map((f: { attributes: { comp_full: string } }) => f.attributes.comp_full).filter(Boolean))] };
}

export async function unitsInLot(feature: LotFeature): Promise<Unit[]> {
  const p = feature.properties;
  if (!p || (p.TOTAL_AV == null && p.PRIMARY_OWNER == null && p.PROP_CLASS == null && p.PARCEL_ADDR == null && p.SOURCE == null)) return [];
  const nyc = NYC_COUNTIES.has(String(p.COUNTY_NAME));
  const acres = num(p.ACRES) || num(p.CALC_ACRES);
  const land = num(p.LAND_AV), total = num(p.TOTAL_AV);
  const cls = str(p.PROP_CLASS);
  const mail = [str(p.MAIL_ADDR) || str(p.PO_BOX), [str(p.MAIL_CITY), str(p.MAIL_STATE)].filter(Boolean).join(', '), str(p.MAIL_ZIP)].filter(Boolean).join(' ');
  const unit: Unit = {
    id: String(p.SWIS_SBL_ID || p.NO_LOT), label: str(p.PARCEL_ADDR) || p.LABEL, center: lotCenter(feature) || [0, 0],
    use: useLabel(cls, nyc), category: str(p.BLDG_STYLE_DESC), floors: null,
    dwellings: cls === '210' || cls === '215' ? 1 : cls === '220' ? 2 : cls === '230' ? 3 : null,
    builtYear: num(p.YR_BLT), landArea: nyc ? (num(p.SQ_FT) ? num(p.SQ_FT)! / 10.7639 : null) : acres ? acres * M2_PER_ACRE : null,
    floorArea: num(p.GFA) ? num(p.GFA)! / 10.7639 : num(p.SQFT_LIVING) ? num(p.SQFT_LIVING)! / 10.7639 : null,
    marketDate: p.ROLL_YR ? `${p.ROLL_YR} roll` : null, landValue: land, totalValue: total, buildingValue: land !== null && total !== null ? total - land : null,
    previousValue: null, frontage: num(p.FRONT) ? num(p.FRONT)! * M_PER_FT : null, depth: num(p.DEPTH) ? num(p.DEPTH)! * M_PER_FT : null,
    owner: [str(p.PRIMARY_OWNER), str(p.ADD_OWNER)].filter(Boolean).join(' & ') || null, ownerMail: mail || null,
    marketValue: num(p.FULL_MARKET_VAL), propClass: cls, school: str(p.SCHOOL_NAME), county: str(p.COUNTY_NAME), muni: str(p.MUNI_NAME),
    swis: str(p.SWIS), sbl: str(p.PRINT_KEY) || str(p.SBL), bbl: nyc ? str(p.SBL) : null, agDistrict: str(p.AG_DIST_NAME),
    utilities: [str(p.SEWER_DESC), str(p.WATER_DESC), str(p.HEAT_TYPE_DESC), str(p.FUEL_TYPE_DESC)].filter(Boolean).join(' · ') || null,
    bedrooms: num(p.NBR_BEDROOMS), baths: num(p.NBR_FULL_BATHS),
    sewer: str(p.SEWER_DESC), water: str(p.WATER_DESC), utilityDesc: str(p.UTILITIES_DESC), heat: [str(p.HEAT_TYPE_DESC), str(p.FUEL_TYPE_DESC)].filter(Boolean).join(' · ') || null,
    deedRef: str(p.BOOK) && str(p.PAGE) ? `Liber ${str(p.BOOK)} / page ${str(p.PAGE)}` : str(p.DEED_REF) ? `Liber / page ${str(p.DEED_REF)}` : null,
    source: str(p.SOURCE), salesSource: str(p.SALES_SOURCE)
  };
  if (unit.salesSource === 'niagara' && num(p.NIAGARA_SALE_PRICE)) {
    const m = String(p.NIAGARA_SALE_DATE || '').match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    unit.sales = [{ date: m ? `${MONTHS[+m[2] - 1]} ${+m[3]}, ${m[1]}` : '—', price: num(p.NIAGARA_SALE_PRICE), type: "Sale (assessor)", buyer: null, seller: null, ref: unit.deedRef ?? null, units: 1 }];
  }
  if (nyc && unit.bbl) {
    try {
      const body = new URLSearchParams({ where: `BBL = ${Number(unit.bbl)}`, outFields: 'ZoneDist1,ZoneDist2,Overlay1,Overlay2,SPDist1,SPDist2,BuiltFAR,ResidFAR,CommFAR,FacilFAR,NumFloors,UnitsRes,UnitsTotal,Landmark,HistDist,OwnerName,LotArea,BldgArea,LotDepth',
        returnGeometry: 'false', f: 'json' });
      const r = await (await fetch(PLUTO_SERVICE, { method: 'POST', body })).json();
      const a = r.features?.[0]?.attributes;
      if (a) {
        unit.zoning = [a.ZoneDist1, a.ZoneDist2].filter(Boolean).join(' / ') || null;
        unit.overlays = [a.Overlay1, a.Overlay2].filter(Boolean).join(', ') || null;
        unit.special = [a.SPDist1, a.SPDist2].filter(Boolean).join(', ') || null;
        unit.far = `built ${a.BuiltFAR ?? '—'} · residential ${a.ResidFAR ?? '—'} · commercial ${a.CommFAR ?? '—'} · facility ${a.FacilFAR ?? '—'}`;
        unit.floors = num(a.NumFloors); unit.dwellings = a.UnitsRes ?? unit.dwellings;
        unit.landmark = str(a.Landmark); unit.histDistrict = str(a.HistDist);
        unit.owner = unit.owner || str(a.OwnerName);
        if (num(a.BldgArea)) unit.floorArea = a.BldgArea / 10.7639;
        if (num(a.LotDepth)) unit.depth = a.LotDepth * M_PER_FT;
      }
    } catch { /* PLUTO unavailable: roll data only */ }
    try {
      const q = new URLSearchParams({ $where: `parid='${unit.bbl}'`, $order: 'year DESC, period DESC', $limit: '1', $select: 'year,curmkttot,finmkttot,pymkttot' });
      const [v] = await (await fetch(`${DOF_VALUES}?${q}`)).json();
      const market = Number(v?.finmkttot || v?.curmkttot) || null;
      if (market) { unit.marketValue = market; unit.previousValue = Number(v.pymkttot) || null; unit.marketDate = `NYC Finance FY${v.year}`; }
    } catch { /* DOF unavailable */ }
  }
  return [unit];
}

/** No separate unit index in New York: the parcel record is the unit. */
export async function unitsByLotNumber(_lot: string): Promise<Unit[] | null> {
  return null;
}

/** Cadastre lot under a point (used when an address is chosen). */
export async function lotAtPoint([lng, lat]: [number, number], signal?: AbortSignal, address = ''): Promise<LotFeature | null> {
  const at = async (distance?: number) => {
    const params = { geometry: `${lng},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
      returnGeometry: 'true', ...(distance ? { distance: String(distance), units: 'esriSRUnit_Meter' } : {}) };
    const box: [number, number, number, number] = [lng, lat, lng, lat];
    const [data, ...extra] = await Promise.all([query(params, signal),
      ...COUNTY_SOURCES.map((s, i) => overlaps(box, s.bbox) ? countyQuery(i, params, signal).catch(() => []) : Promise.resolve([] as LotFeature[]))]);
    data.features.push(...extra.flat());
    return data;
  };
  const number = address.match(/^\s*([\d-]+)/)?.[1].replace(/-/g, '') || '';
  const matches = (f: LotFeature) => !!number && String(f.properties.PARCEL_ADDR || '').replace(/-/g, '').startsWith(number + ' ');
  const exact = (await at()).features.filter(f => f.geometry);
  if (exact.length && (!number || exact.some(matches))) return exact.find(matches) || exact[0];
  // Geocoded points often sit on the street line, just outside the parcel: prefer the parcel with the same house number within 40 m,
  // else the one whose edge is nearest.
  const near = (await at(40)).features.filter(f => f.geometry);
  const kx = Math.cos(lat * Math.PI / 180);
  const edge = (f: LotFeature) => Math.min(...polygons(f).flatMap(poly => poly[0].slice(1).map((b, i) => {
    const a = poly[0][i], dx = (b[0] - a[0]) * kx, dy = b[1] - a[1], px = (lng - a[0]) * kx, py = lat - a[1];
    const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy || 1)));
    return (px - t * dx) ** 2 + (py - t * dy) ** 2;
  })));
  return near.sort((x, y) => Number(matches(y)) - Number(matches(x)) || edge(x) - edge(y))[0] || exact[0] || null;
}

export interface LotEdge { from: [number, number]; to: [number, number]; mid: [number, number]; length: number }
const R_EARTH = 6371008.8;
function dist([x1, y1]: Position, [x2, y2]: Position): number {
  const rad = Math.PI / 180, lat = (y1 + y2) / 2 * rad;
  const dx = (x2 - x1) * rad * Math.cos(lat), dy = (y2 - y1) * rad;
  return Math.sqrt(dx * dx + dy * dy) * R_EARTH;
}
function bearing([x1, y1]: Position, [x2, y2]: Position): number {
  const lat = (y1 + y2) / 2 * Math.PI / 180;
  return Math.atan2(y2 - y1, (x2 - x1) * Math.cos(lat)) * 180 / Math.PI;
}

/**
 * Side lengths of the lot's outer boundary, in metres, as drawn in the cadastre.
 * Consecutive segments that run in nearly the same direction (within 8°) are merged into one side,
 * so a straight lot line drawn with extra vertices reads as a single measurement.
 */
export function lotEdges(feature: LotFeature): LotEdge[] {
  const polys = polygons(feature);
  if (!polys.length) return [];
  // Largest outer ring only (the lot itself, not detached pieces).
  const ring = polys.map(p => p[0]).sort((a, b) => b.length - a.length)[0];
  const pts = ring.slice(0, -1);
  if (pts.length < 3) return [];
  const sides: Position[][] = [];
  let current: Position[] = [pts[0]];
  for (let i = 1; i <= pts.length; i++) {
    const p = pts[i % pts.length];
    if (current.length >= 2) {
      const a = bearing(current[0], current[current.length - 1]), b = bearing(current[current.length - 1], p);
      const diff = Math.abs(((a - b + 540) % 360) - 180);
      if (diff > 8) { sides.push(current); current = [current[current.length - 1]]; }
    }
    current.push(p);
  }
  sides.push(current);
  // The last side may continue straight into the first one.
  if (sides.length > 1) {
    const first = sides[0], last = sides[sides.length - 1];
    const a = bearing(last[0], last[last.length - 1]), b = bearing(first[0], first[first.length - 1]);
    if (Math.abs(((a - b + 540) % 360) - 180) <= 8) { sides[0] = [...last, ...first.slice(1)]; sides.pop(); }
  }
  return sides.map(s => {
    let length = 0;
    for (let i = 1; i < s.length; i++) length += dist(s[i - 1], s[i]);
    const a = s[0] as [number, number], b = s[s.length - 1] as [number, number];
    return { from: a, to: b, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as [number, number], length };
  }).filter(e => e.length >= 0.5);
}
export const FT_PER_M = 3.28084;

const tipEsc = (v: unknown) => String(v ?? '').replace(/[<>&"]/g, '');
const tipRow = (a: string, b: string) => `<div class="tip-sale"><span>${tipEsc(a)}</span><b>${tipEsc(b)}</b></div>`;
/** Hover label body for the Sales tab: the parcel's latest recorded sales (ACRIS in NYC, county rolls elsewhere). */
export async function hoverSales(c: [number, number]): Promise<string> {
  const lot = await lotAtPoint(c); if (!lot) return '<br><small>No parcel here</small>';
  const u = (await unitsInLot(lot))[0];
  const addr = u?.label && u.label !== lot.properties.LABEL ? `<br>${tipEsc(u.label)}` : '';
  let sales: Sale[] | null = null;
  if (u?.salesSource === 'cattaraugus' && u.swis && u.sbl) sales = await cattaraugusSales(u.swis, u.sbl);
  else if (u?.sales) sales = u.sales;
  else if (u?.bbl && u.bbl.length === 10) sales = await acrisSales(u.bbl);
  if (!sales) return `${addr}<small>No public sales feed for this county · click for links</small>`;
  if (!sales.length) return `${addr}<br><small>No recorded sale · click for links</small>`;
  const priced = sales.filter(s => s.price && s.price > 100);
  const rows = (priced.length ? priced : sales).slice(0, 3).map(s => tipRow(s.date, s.price && s.price > 100 ? '$' + s.price.toLocaleString('en-US') : s.type)).join('');
  return `${addr}${rows || '<br><small>No recorded sale</small>'}<small>${sales.length} record${sales.length === 1 ? '' : 's'} · click for full history</small>`;
}
