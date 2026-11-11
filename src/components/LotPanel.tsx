import { useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRight, ChevronDown, Copy, Eye, FileText, MapPin, X } from 'lucide-react';
import type { LotSnapshot } from '../lib/files';
import { useDrag } from '../lib/useDrag';
import { territoryAt, territoryLinks, type Territory, type TerritoryLinks } from '../lib/territory';
import { acrisSales, infrastructureAt, type Infra, type Sale, FT_PER_M, lotArea, lotCenter, lotEdges, SQFT_PER_M2, streetViewUrl, unitsInLot, type LotFeature, type Unit } from '../lib/lots';

const n = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const money = (v: number | null | undefined) => v == null ? '—' : dollars.format(v);
const len = (m: number) => <>{(m * FT_PER_M).toFixed(1)} ft<small>{m.toFixed(1)} m</small></>;
const sqft = (m2: number | null, land = false) => m2 === null ? '—' : <>{n.format(m2 * SQFT_PER_M2)} ft²<small>{land && m2 > 4046 ? `${(m2 / 4046.86).toFixed(2)} acres` : `${n.format(m2)} m²`}</small></>;

interface Props {
  lot: LotFeature;
  address?: string;
  preferPoint?: [number, number] | null;
  /** One-line zone summary shown under the title, and its full details (collapsed). */
  zoneLine?: ReactNode;
  zoneDetails?: ReactNode;
  /** Plain-text zone summary and grid link, for reports. */
  zoneText?: string;
  zoneGrid?: string;
  onReport?: (snapshot: LotSnapshot) => void;
  onClose: () => void;
}

/** Everything about one selected parcel, in a single card. */
export default function LotPanel({ lot, address, preferPoint, zoneLine, zoneDetails, zoneText, zoneGrid, onReport, onClose }: Props) {
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'overview' | 'owner' | 'sales' | 'infra' | 'lot'>('overview');
  useEffect(() => { setTab('overview'); }, [lot]);
  const [infra, setInfra] = useState<Infra | null | 'loading'>('loading');
  const [sales, setSales] = useState<Sale[] | null | 'loading'>(null);
  useEffect(() => {
    let active = true; setInfra('loading');
    const c = lotCenter(lot);
    if (!c) { setInfra(null); return; }
    void infrastructureAt(c).then(r => { if (active) setInfra(r); }).catch(() => { if (active) setInfra(null); });
    return () => { active = false; };
  }, [lot]);
  useEffect(() => {
    const b = units?.[0]?.bbl;
    if (!b || b.length !== 10) { setSales(null); return; }
    let active = true; setSales('loading');
    void acrisSales(b).then(r => { if (active) setSales(r); }).catch(() => { if (active) setSales(null); });
    return () => { active = false; };
  }, [units]);
  const [territory, setTerritory] = useState<{ place: Territory; links: TerritoryLinks | null } | null | 'none'>(null);
  const drag = useDrag('detail');
  useEffect(() => {
    let active = true;
    setTerritory(null);
    const center = lotCenter(lot);
    if (!center) { setTerritory('none'); return; }
    void territoryAt(center).then(async place => {
      if (active) setTerritory(place ? { place, links: await territoryLinks(place.code) } : 'none');
    }).catch(() => { if (active) setTerritory('none'); });
    return () => { active = false; };
  }, [lot]);
  useEffect(() => {
    let active = true;
    setUnits(null);
    void unitsInLot(lot).then(found => { if (active) setUnits(found); }).catch(() => { if (active) setUnits([]); });
    return () => { active = false; };
  }, [lot]);

  const area = lotArea(lot);
  const edges = lotEdges(lot);
  const perimeter = edges.reduce((t, e) => t + e.length, 0);
  const unit = units?.[0];
  const viewPoint = preferPoint || lotCenter(lot);
  const place = territory && territory !== 'none' ? territory.place : null;
  const links = territory && territory !== 'none' ? territory.links : null;
  const nyc = place?.type === 'borough';
  const muni = unit?.muni && unit.muni !== place?.name ? unit.muni : '';
  const placeLabel = !place ? '' : nyc ? `${place.name} · New York City` : [muni, place.name].filter(Boolean).join(' · ');
  const key = unit?.sbl || lot.properties.LABEL;
  const bbl = unit?.bbl && unit.bbl.length === 10 ? unit.bbl : '';
  const acris = bbl ? `https://a836-acris.nyc.gov/bblsearch/bblsearch.asp?borough=${bbl[0]}&block=${Number(bbl.slice(1, 6))}&lot=${Number(bbl.slice(6))}` : '';
  const zola = bbl ? `https://zola.planning.nyc.gov/l/lot/${bbl[0]}/${Number(bbl.slice(1, 6))}/${Number(bbl.slice(6))}` : '';
  const bis = bbl ? `https://a810-bisweb.nyc.gov/bisweb/PropertyProfileOverviewServlet?boro=${bbl[0]}&block=${Number(bbl.slice(1, 6))}&lot=${Number(bbl.slice(6))}` : '';
  const rollUrl = nyc ? links?.roll || undefined : links?.site;
  const title = address || unit?.label;

  async function copy() {
    try { await navigator.clipboard.writeText(key); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  }

  function report() {
    const g = lot.geometry;
    const polys = g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : [];
    onReport?.({
      lot: key, address: title || '', place: placeLabel, zone: zoneText || (unit?.zoning ? `Zoning ${unit.zoning}${unit.overlays ? ` · overlays ${unit.overlays}` : ''}${unit.special ? ` · special district ${unit.special}` : ''}` : ''),
      zoneGrid: zola || zoneGrid, zoningUrl: links?.zoning, rollUrl: acris || rollUrl,
      center: viewPoint, rings: polys.map(p => p[0].map(([x, y]) => [x, y] as [number, number])), area, perimeter, sides: edges.map(e => e.length),
      unit: unit ? { ...unit, sales: Array.isArray(sales) ? sales : null, infra: infra === 'loading' ? null : infra } : null, capturedAt: new Date().toISOString()
    });
  }

  return <section className="detail-card" aria-label="Selected parcel" style={drag.style}>
    <header className="detail-head drag-handle" {...drag.handle}><span className="grip" aria-hidden="true"/>
      <div>
        <div className="eyebrow">{placeLabel ? placeLabel.toUpperCase() : 'TAX PARCEL'}</div>
        <h2>{bbl ? `BBL ${bbl}` : `Parcel ${key}`}</h2>
        {title && <p className="detail-address"><MapPin size={13}/>{title}</p>}
      </div>
      <button className="icon-button" onClick={onClose} aria-label="Close parcel details"><X size={18}/></button>
    </header>

    {zoneLine && <details className="zone-line"><summary>{zoneLine}<ChevronDown size={14}/></summary><div className="zone-line-body">{zoneDetails}</div></details>}

    {units === null && <p className="detail-note" role="status">Loading assessment…</p>}
    {units?.length === 0 && <p className="detail-note">No assessment record on this parcel. Check the county’s real property office.</p>}

    {unit && <div className="tabs" role="tablist">{(['overview', 'owner', 'sales', 'infra', 'lot'] as const).map(t => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
      {t === 'overview' ? 'Overview' : t === 'owner' ? 'Owner' : t === 'sales' ? (Array.isArray(sales) && sales.length ? `Sales (${sales.length})` : 'Sales') : t === 'infra' ? 'Utilities' : 'Lot'}</button>)}</div>}

    {unit && tab === 'overview' && <>
      <div className="value-hero"><span>{unit.marketValue ? 'Full market value · appraisal' : 'Total assessed value'}</span><strong>{money(unit.marketValue ?? unit.totalValue)}</strong>
        <small>{unit.marketDate || 'Assessment roll'} · {nyc ? 'NYC Department of Finance' : `${unit.muni || unit.county || ''} assessor`}</small></div>
      <button className="owner-line as-link" onClick={() => setTab('owner')}><span>Owner of record</span><b>{unit.owner || 'Not published by this county'}</b><small>Owner details →</small></button>
      <table className="appraisal"><tbody>
        {unit.marketValue != null && <tr className="sum"><th>Full market value</th><td>{money(unit.marketValue)}</td></tr>}
        {unit.previousValue != null && <tr><th>Previous year market value</th><td>{money(unit.previousValue)}</td></tr>}
        <tr><th>Land assessed value</th><td>{money(unit.landValue)}</td></tr>
        <tr><th>Total assessed value</th><td>{money(unit.totalValue)}</td></tr>
      </tbody></table>
      <dl className="fact-grid">
        <div><dt>Lot area</dt><dd>{sqft(unit.landArea ?? area, true)}</dd></div>
        <div><dt>Building area</dt><dd>{sqft(unit.floorArea)}</dd></div>
        <div><dt>Year built</dt><dd>{unit.builtYear ?? '—'}</dd></div>
        <div><dt>{nyc ? 'Residential units' : 'Bed / bath'}</dt><dd>{nyc ? unit.dwellings ?? '—' : unit.bedrooms || unit.baths ? `${unit.bedrooms ?? '—'} / ${unit.baths ?? '—'}` : '—'}</dd></div>
        {nyc && <div><dt>Floors</dt><dd>{unit.floors ?? '—'}</dd></div>}
        <div><dt>Property class</dt><dd>{unit.use || '—'}</dd></div>
        {!nyc && <div><dt>School district</dt><dd>{unit.school || '—'}</dd></div>}
        {unit.zoning && <div><dt>Zoning</dt><dd>{unit.zoning}{unit.overlays && <small>Overlay {unit.overlays}</small>}{unit.special && <small>Special district {unit.special}</small>}</dd></div>}
        {unit.far && <div><dt>FAR</dt><dd><small>{unit.far}</small></dd></div>}
        {(unit.landmark || unit.histDistrict) && <div><dt>Landmark</dt><dd>{[unit.landmark, unit.histDistrict].filter(Boolean).join(' · ')}</dd></div>}
        {unit.agDistrict && <div><dt>Agricultural district</dt><dd>{unit.agDistrict}</dd></div>}
      </dl>
      {Array.isArray(sales) && sales[0] && <button className="owner-line as-link" onClick={() => setTab('sales')}><span>Last deed</span><b>{sales[0].price && sales[0].price > 100 ? money(sales[0].price) : 'No consideration'} · {sales[0].date}</b><small>Full deed history →</small></button>}
    </>}

    {unit && tab === 'owner' && <div className="tab-body">
      <div className="owner-line"><span>Owner of record</span><b>{unit.owner || 'Not published by this county — see its property search'}</b></div>
      <dl className="fact-grid">
        <div><dt>Mailing address</dt><dd>{unit.ownerMail || '—'}</dd></div>
        <div><dt>{nyc ? 'BBL' : 'Tax map'}</dt><dd>{bbl || key}</dd></div>
        <div><dt>County</dt><dd>{unit.county || '—'}</dd></div>
        <div><dt>Municipality</dt><dd>{unit.muni || '—'}</dd></div>
        {Array.isArray(sales) && sales[0]?.buyer && <div><dt>Acquired</dt><dd>{sales[0].date}<small>{sales[0].price && sales[0].price > 100 ? money(sales[0].price) : 'no consideration'}</small></dd></div>}
      </dl>
      <ol className="owner-links">
        {acris && <li><a href={acris} target="_blank" rel="noreferrer">ACRIS deeds & mortgages <ArrowUpRight size={11}/></a> — recorded documents for this BBL, free.</li>}
        {!nyc && links?.site && <li><a href={links.site} target="_blank" rel="noreferrer">County real property search <ArrowUpRight size={11}/></a> — tax map {key}.</li>}
      </ol>
      <p className="detail-foot">Owner of record on the assessment roll (NYS public tax parcel data). Confirm the vesting deed{nyc ? ' on ACRIS' : ' with the county clerk'}.</p>
    </div>}

    {unit && tab === 'sales' && <div className="tab-body">
      <div className="sales"><b>Sales & deed history{Array.isArray(sales) && sales.length ? ` · ${sales.length} deed${sales.length > 1 ? 's' : ''}` : ''}</b>
        {sales === 'loading' && <p className="detail-foot">Loading deeds from ACRIS…</p>}
        {Array.isArray(sales) && sales.slice(0, 25).map((x, i) => <div key={i}><span>{x.date}</span><strong>{x.price && x.price > 100 ? money(x.price) : 'No consideration'}</strong>
          <small>{[x.type, x.units > 1 ? `${x.units} units/lots` : '', x.ref].filter(Boolean).join(' · ')}{(x.seller || x.buyer) && <><br/>{x.seller && <>From {x.seller}</>}{x.seller && x.buyer && ' → '}{x.buyer && <>to {x.buyer}</>}</>}</small></div>)}
        {Array.isArray(sales) && !sales.length && <p className="detail-foot">No deed recorded in ACRIS for this lot (records start in 1966; condo units have their own lots).</p>}
        {!nyc && <>{unit.deedRef && <div><span>Last deed</span><strong>{unit.deedRef}</strong><small>county clerk</small></div>}
          <p className="detail-foot">Sale prices outside NYC are filed with the state (RP-5217) but not published per parcel. Dates, prices and parties are in the {unit.county} County Clerk’s records; sold prices also come from the MLS.</p></>}
        {nyc && Array.isArray(sales) && sales.length > 25 && <p className="detail-foot">Showing the 25 latest of {sales.length}. Full list on ACRIS.</p>}
      </div>
    </div>}

    {unit && tab === 'infra' && <div className="tab-body infra">
        <ul>
          <li className={nyc || /public|comm/i.test(unit.water || '') ? 'ok' : /private|well/i.test(unit.water || '') ? 'warn' : 'q'}><span>Water</span><b>{nyc ? 'NYC public water (DEP)' : unit.water || 'Not on the roll'}</b></li>
          <li className={nyc || /public|comm/i.test(unit.sewer || '') ? 'ok' : /private|septic/i.test(unit.sewer || '') ? 'warn' : 'q'}><span>Sewer</span><b>{nyc ? 'NYC public sewer (DEP)' : unit.sewer || 'Not on the roll'}</b></li>
          <li className={infra !== 'loading' && infra?.electric.length ? 'ok' : 'q'}><span>Electric</span><b>{infra === 'loading' ? 'Checking…' : infra?.electric.join(', ') || 'Check with the utility'}{unit.utilityDesc && <small> · roll: {unit.utilityDesc}</small>}</b></li>
          {unit.heat && <li className="q"><span>Heat / fuel</span><b>{unit.heat}</b></li>}
          <li className="q"><span>Internet</span><b>{viewPoint && <a href={`https://broadbandmap.fcc.gov/location-summary/fixed?lat=${viewPoint[1]}&lon=${viewPoint[0]}&zoom=17`} target="_blank" rel="noreferrer">FCC broadband map <ArrowUpRight size={10}/></a>}</b></li>
          <li className="q"><span>Gas · road · drainage · fees</span><b>Confirm with the utility and the town</b></li>
        </ul>
        <p className="detail-foot">Water, sewer and utilities: the assessor’s roll (outside NYC). Electric: NYS PSC service territories. Full checklist in the property file.</p>
    </div>}

    {(tab === 'lot' || !unit) && <div className="tab-body">
      {!unit && area !== null && <dl className="fact-grid"><div><dt>Lot area (drawing)</dt><dd>{sqft(area, true)}</dd></div></dl>}
      {edges.length > 0 && <>
      <dl className="fact-grid">
        {unit?.frontage != null && <div><dt>Frontage (roll)</dt><dd>{len(unit.frontage)}</dd></div>}
        {unit?.depth != null && <div><dt>Depth (roll)</dt><dd>{len(unit.depth)}</dd></div>}
        <div><dt>Perimeter</dt><dd>{len(perimeter)}</dd></div>
        <div><dt>Sides</dt><dd>{edges.length}</dd></div>
      </dl>
      <ol className="side-list">{edges.map((e, i) => <li key={i}><span>Side {i + 1}</span><strong>{(e.length * FT_PER_M).toFixed(1)} ft</strong><small>{e.length.toFixed(1)} m</small></li>)}</ol>
      <p className="detail-foot">Sides are measured on the county tax-map drawing, not a survey. Frontage and depth are the assessor’s figures.</p>
      </>}
    </div>}

    {onReport && <button className="report-button" onClick={report} disabled={units === null}><FileText size={15}/> Create report</button>}
    {viewPoint && <a className="street-view-button" href={streetViewUrl(viewPoint)} target="_blank" rel="noreferrer"><Eye size={15}/> Street View <ArrowUpRight size={13}/></a>}

    <div className="link-row">
      {zola ? <a href={zola} target="_blank" rel="noreferrer">ZoLa zoning <ArrowUpRight size={11}/></a> : links && <a href={links.zoning} target="_blank" rel="noreferrer">Zoning <ArrowUpRight size={11}/></a>}
      {bis && <a href={bis} target="_blank" rel="noreferrer">DOB permits & C of O <ArrowUpRight size={11}/></a>}
      {acris && <a href={acris} target="_blank" rel="noreferrer">ACRIS <ArrowUpRight size={11}/></a>}
      {!nyc && rollUrl && <a href={rollUrl} target="_blank" rel="noreferrer">County records <ArrowUpRight size={11}/></a>}
      <a href="https://msc.fema.gov/portal/search" target="_blank" rel="noreferrer">FEMA flood <ArrowUpRight size={11}/></a>
      <button onClick={copy}><Copy size={11}/>{copied ? 'Copied' : key}</button>
    </div>

    <p className="detail-foot">Assessment data: NYS Tax Parcels Public ({unit?.county || 'county'} roll{unit?.swis ? `, SWIS ${unit.swis}` : ''}).{nyc && ' NYC zoning and building data: MapPLUTO.'} Assessed value is a share of market value set by each town’s equalization rate.</p>
  </section>;
}
