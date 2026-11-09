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
  return /^\d{12,}$/.test(input.trim()) ? input.trim() : '';
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

export function lotsInBounds(bounds: [number, number, number, number], signal?: AbortSignal) {
  return query({ geometry: bounds.join(','), geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
    returnGeometry: 'true', outFields: LIGHT, resultRecordCount: '2000' }, signal);
}

export async function findLot(input: string, signal?: AbortSignal): Promise<LotFeature | null> {
  const key = input.trim().replace(/'/g, '');
  if (!key) return null;
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
  county?: string | null; muni?: string | null; swis?: string | null; sbl?: string | null; bbl?: string | null; agDistrict?: string | null;
  utilities?: string | null; bedrooms?: number | null; baths?: number | null;
  zoning?: string | null; overlays?: string | null; special?: string | null; far?: string | null; landmark?: string | null; histDistrict?: string | null;
  depth?: number | null;
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
export async function unitsInLot(feature: LotFeature): Promise<Unit[]> {
  const p = feature.properties;
  if (!p || (p.TOTAL_AV == null && p.PRIMARY_OWNER == null && p.PROP_CLASS == null)) return [];
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
    bedrooms: num(p.NBR_BEDROOMS), baths: num(p.NBR_FULL_BATHS)
  };
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
  const at = (distance?: number) => query({ geometry: `${lng},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
    returnGeometry: 'true', ...(distance ? { distance: String(distance), units: 'esriSRUnit_Meter' } : {}) }, signal);
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
