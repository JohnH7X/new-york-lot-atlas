import type { LotSnapshot, PropertyFile } from './files';

// Worksheets and checklists for the reporting module, for New York practice. They prepare a licensee's work;
// the contract of sale, the agency disclosure and the Property Condition Disclosure Statement are still signed on the official forms.

export interface Field { key: string; label: string; type?: 'text' | 'date' | 'number' | 'area'; hint?: string; side?: 'listing' | 'buyer' }

export const MANDATE_FIELDS: Field[] = [
  { key: 'clientName', label: 'Client name(s)' },
  { key: 'clientAddress', label: 'Client address' },
  { key: 'clientPhone', label: 'Client phone' },
  { key: 'clientEmail', label: 'Client email' },
  { key: 'entity', label: 'If an entity: legal name, state of formation, signer', hint: 'Check the NYS Division of Corporations database.' },
  { key: 'agency', label: 'Agency disclosure form signed (DOS-1736) and relationship', hint: 'Seller’s agent, buyer’s agent, dual or designated agency.' },
  { key: 'price', label: 'List price', type: 'number', side: 'listing' },
  { key: 'budget', label: 'Maximum price / budget', type: 'number', side: 'buyer' },
  { key: 'criteria', label: 'Search criteria (areas, type, units, must-haves)', type: 'area', side: 'buyer' },
  { key: 'type', label: 'Agreement type (exclusive right to sell, exclusive agency, open)', side: 'listing' },
  { key: 'start', label: 'Agreement start', type: 'date' },
  { key: 'end', label: 'Agreement end', type: 'date' },
  { key: 'commission', label: 'Commission and co-broke offered' },
  { key: 'inclusions', label: 'Inclusions (fixtures, appliances)', type: 'area', side: 'listing' },
  { key: 'exclusions', label: 'Exclusions', type: 'area', side: 'listing' },
  { key: 'mortgage', label: 'Mortgage(s) and payoff, liens, judgments', side: 'listing' },
  { key: 'financing', label: 'Pre-approval (lender, amount) or proof of funds', side: 'buyer' },
  { key: 'attorney', label: 'Client’s real estate attorney' },
  { key: 'showings', label: 'Showing instructions (lockbox, notice, tenants)', side: 'listing' },
  { key: 'other', label: 'Other conditions', type: 'area' }
];

export interface Topic { key: string; label: string; ask: string; hint?: (s: LotSnapshot) => string | '' }
const year = (s: LotSnapshot) => s.unit?.builtYear ?? null;
const units = (s: LotSnapshot) => s.unit?.dwellings ?? 0;

// Follows the subjects of the NY Property Condition Disclosure Statement (Real Property Law §462).
export const DECLARATION_TOPICS: Topic[] = [
  { key: 'title', label: 'General & title', ask: 'How long owned? Any liens, encroachments, easements, boundary disputes, rights of first refusal or leases?' },
  { key: 'environment', label: 'Environmental', ask: 'Fuel storage tanks (above or below ground), spills, landfill, asbestos, lead plumbing, radon tests, wetlands or flood plain?', hint: s => (year(s) ?? 2000) < 1978 ? 'Built before 1978: federal lead-based paint disclosure and pamphlet are required.' : '' },
  { key: 'flood', label: 'Flood history & insurance', ask: 'Is the property in a FEMA flood zone? Any flood damage, claims or FEMA assistance? Is flood insurance carried? (Flood disclosure is mandatory in NY since 2023.)' },
  { key: 'structure', label: 'Structure & foundation', ask: 'Rot, water damage, foundation cracks, settling, sagging, or structural repairs?' },
  { key: 'roof', label: 'Roof', ask: 'Age of the roof, leaks, repairs, warranties?' },
  { key: 'water', label: 'Water intrusion & basement', ask: 'Basement water, sump pump, mold, past remediation?' },
  { key: 'pests', label: 'Pests', ask: 'Termites, carpenter ants, rodents, bedbugs, treatments?' },
  { key: 'mechanical', label: 'Heating, cooling & electrical', ask: 'Systems and ages; fuse panel, knob-and-tube or aluminum wiring; known defects?', hint: s => (year(s) ?? 2000) < 1950 ? 'Pre-1950: ask about knob-and-tube wiring and the service size.' : '' },
  { key: 'plumbing', label: 'Water supply & sewer', ask: 'Public or private water (well tests)? Public sewer or septic (age, last pumped)?', hint: s => /Private|Well|Septic/i.test(s.unit?.utilities || '') ? `Roll shows: ${s.unit?.utilities}. Ask for well and septic records.` : '' },
  { key: 'permits', label: 'Permits & certificate of occupancy', ask: 'Additions, finished basement, decks or conversions — with permits and a C of O?' },
  { key: 'use', label: 'Legal use & units', ask: 'Is the number of units legal (C of O)? Any violations or open permits?', hint: s => units(s) > 1 ? `${units(s)} residential units on record: collect leases, rent roll and the C of O.` : '' },
  { key: 'rent', label: 'Leases & rent regulation', ask: 'Leases, deposits, rent-stabilized units, pending housing court or DHCR cases?', hint: s => /New York City/.test(s.place) && units(s) >= 6 && (year(s) ?? 2000) < 1974 ? '6+ units built before 1974 in NYC: likely rent-stabilized — check DHCR rent registration.' : '' },
  { key: 'condo', label: 'Co-op / condo / HOA', ask: 'Board approval, offering plan, financials, assessments, flip tax, HOA dues?' },
  { key: 'taxes', label: 'Taxes & exemptions', ask: 'STAR, veteran, senior or other exemptions that end at sale? Any special assessments or tax arrears?' },
  { key: 'other', label: 'Anything else', ask: 'Any other material defect or condition the buyer should know?' }
];

export interface Check { key: string; label: string; url?: string; hint?: string }
export const PREOFFER_CHECKS: Check[] = [
  { key: 'title', label: 'Title search ordered (deeds, mortgages, liens, judgments)', url: 'https://a836-acris.nyc.gov/' },
  { key: 'survey', label: 'Survey current and matches the tax map and buildings' },
  { key: 'roll', label: 'Assessment roll checked (owner of record, values, class, exemptions)' },
  { key: 'zoning', label: 'Zoning read: permitted uses, units, FAR, height, setbacks' },
  { key: 'co', label: 'Certificate of occupancy matches the legal use and units' },
  { key: 'violations', label: 'Open permits and building violations searched' },
  { key: 'flood', label: 'FEMA flood zone checked (and flood insurance quote)', url: 'https://msc.fema.gov/portal/search' },
  { key: 'environment', label: 'NYS DEC environmental remediation and spill databases searched', url: 'https://www.dec.ny.gov/data/DecDocs/' },
  { key: 'wetlands', label: 'DEC wetlands and environmental mapper checked', url: 'https://gisservices.dec.ny.gov/gis/erm/' },
  { key: 'historic', label: 'Historic status checked (NYS CRIS / NYC LPC)', url: 'https://cris.parks.ny.gov/' },
  { key: 'agri', label: 'Agricultural district checked (disclosure notice if inside)' },
  { key: 'disclosure', label: 'Property Condition Disclosure Statement received and reviewed' },
  { key: 'lead', label: 'Lead-based paint disclosure (built before 1978)' },
  { key: 'inspection', label: 'Home inspection booked or contingency written' },
  { key: 'well', label: 'Well water and septic tests (if private systems)' },
  { key: 'financing', label: 'Mortgage commitment and insurance confirmed' },
  { key: 'leases', label: 'Leases, rent roll and rent-stabilization status reviewed', url: 'https://hcr.ny.gov/rent-administration' },
  { key: 'taxes', label: 'Property and school taxes confirmed, no arrears' },
  { key: 'comparables', label: 'Comparable sales from the last 12 months pulled' },
  { key: 'valuation', label: 'Price compared with the full market value on the roll' },
  { key: 'transfer', label: 'Transfer taxes and mansion tax estimated' },
  { key: 'oilTank', label: 'Oil tank status (in use, abandoned, removed with certificate)' },
  { key: 'board', label: 'Co-op / condo: offering plan, financials, board package' },
  { key: 'cityProjects', label: 'Nearby rezonings, projects or roadwork checked' },
  { key: 'attorney', label: 'Attorney review of the contract of sale' },
  { key: 'closing', label: 'Closing date, possession and tenants agreed' }
];

export const LISTING_FIELDS: Field[] = [
  { key: 'type', label: 'Property type' },
  { key: 'price', label: 'Price', type: 'number' },
  { key: 'rooms', label: 'Bedrooms / bathrooms' },
  { key: 'parking', label: 'Parking' },
  { key: 'heating', label: 'Heating / cooling / fuel' },
  { key: 'taxes', label: 'Annual taxes (property + school)' },
  { key: 'hoa', label: 'HOA / common charges / maintenance' },
  { key: 'revenue', label: 'Gross rents (multi-family)' },
  { key: 'description', label: 'Public remarks', type: 'area' },
  { key: 'agentRemarks', label: 'Agent remarks', type: 'area' }
];

export const DOC_CATEGORIES = ['Listing / buyer agreement', 'Agency disclosure', 'Property disclosure (PCDS)', 'Survey', 'Title / deed', 'Certificate of occupancy', 'Inspection', 'Leases', 'Photos', 'Offer / contract', 'Other'];

// ---- pre-offer findings filled in from what the atlas already knows about the parcel ----

const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** Seller-paid transfer taxes plus the buyer's mansion tax (residential, NYS rates; NYC adds its RPTT). */
export function transferTaxes(price: number, nyc: boolean, residential: boolean) {
  const lines: [string, number][] = [];
  lines.push([`NYS transfer tax ${price > (residential ? 3e6 : 2e6) && nyc ? '0.65%' : '0.4%'}`, price * (price > (residential ? 3e6 : 2e6) && nyc ? 0.0065 : 0.004)]);
  if (nyc) lines.push([`NYC RPTT ${residential ? (price > 500000 ? '1.425%' : '1%') : (price > 500000 ? '2.625%' : '1.425%')}`, price * (residential ? (price > 500000 ? 0.01425 : 0.01) : (price > 500000 ? 0.02625 : 0.01425))]);
  if (residential && price >= 1e6) {
    const rate = !nyc ? 0.01 : price < 2e6 ? 0.01 : price < 3e6 ? 0.0125 : price < 5e6 ? 0.015 : price < 10e6 ? 0.0225 : price < 15e6 ? 0.0325 : price < 20e6 ? 0.035 : price < 25e6 ? 0.0375 : 0.039;
    lines.push([`Mansion tax ${(rate * 100).toFixed(2)}% (buyer)`, price * rate]);
  }
  return lines.map(([l, v]) => [l, Math.round(v)] as [string, number]);
}

export interface Finding { note: string; done?: boolean }
export function preofferFindings(f: PropertyFile): Record<string, Finding> {
  const s = f.snapshot, u = s.unit, out: Record<string, Finding> = {};
  const nyc = /New York City/.test(s.place);
  const price = Number(f.mandate.price || f.listing.price || f.mandate.budget) || 0;
  if (u) out.roll = { note: [u.owner && `Owner of record: ${u.owner}`, u.use, u.builtYear && `built ${u.builtYear}`, u.totalValue && `assessed ${money(u.totalValue)}`, u.marketValue && `full market ${money(u.marketValue)}`, u.marketDate].filter(Boolean).join(' · ') + '.', done: true };
  out.survey = { note: `Tax map ${s.lot}${s.area ? ` · about ${Math.round(s.area * 10.7639).toLocaleString()} ft² on the tax map` : ''}${u?.frontage ? ` · frontage ${Math.round(u.frontage * 3.28084)} ft` : ''}. Compare with the survey.` };
  if (u?.zoning) out.zoning = { note: `Zoning ${u.zoning}${u.overlays ? `, overlay ${u.overlays}` : ''}${u.special ? `, special district ${u.special}` : ''}. FAR ${u.far}. Confirm on ZoLa.` };
  else out.zoning = { note: nyc ? 'Open ZoLa for the parcel’s districts.' : `Zoning is set by ${u?.muni || 'the town or village'}; get its zoning map and code (often on eCode360).` };
  if (u?.landmark || u?.histDistrict) out.historic = { note: `Landmark status: ${[u.landmark, u.histDistrict].filter(Boolean).join(' · ')}. LPC approval needed for exterior work.` };
  out.agri = u?.agDistrict ? { note: `Inside agricultural district: ${u.agDistrict}. The agricultural data statement / disclosure notice applies.` } : { note: 'Not in an agricultural district on the roll.', done: true };
  if (u?.builtYear) out.lead = u.builtYear < 1978 ? { note: `Built ${u.builtYear}: lead paint disclosure and EPA pamphlet required.` } : { note: `Built ${u.builtYear}: lead paint disclosure not required.`, done: true };
  if (u?.utilities) out.well = /Private|Well|Septic/i.test(u.utilities) ? { note: `Roll: ${u.utilities}. Test the well and inspect the septic.` } : { note: `Roll: ${u.utilities}. No private systems indicated.`, done: true };
  if (u && (u.dwellings ?? 0) <= 1 && /Residen|family/i.test(u.use || '')) out.leases = { note: 'Single-family on the roll: no rent roll expected unless rented.', done: true };
  const value = u?.marketValue || u?.totalValue;
  if (value) out.valuation = price
    ? { note: `Price ${money(price)} vs ${u?.marketValue ? 'full market' : 'assessed'} ${money(value)}: ${price >= value ? '+' : ''}${Math.round((price / value - 1) * 100)}%.`, done: true }
    : { note: `${u?.marketValue ? 'Full market' : 'Assessed'} value ${money(value)}. Enter the price in the listing agreement to compare.` };
  const base = price || u?.marketValue || 0;
  if (base) {
    const residential = /Residen|family|Multi|walk-up|elevator|Mixed res/i.test(u?.use || 'Residential');
    const lines = transferTaxes(base, nyc, residential);
    out.transfer = { note: `On ${money(base)}: ${lines.map(([l, v]) => `${l} ${money(v)}`).join(' · ')}. Confirm with the attorney.`, done: true };
  }
  if (u?.owner && /CONDO|CO-?OP|HOUSING CORP|OWNERS? CORP/i.test(u.owner)) out.board = { note: `Owner of record is ${u.owner}: get the offering plan, financials and board package.` };
  return out;
}
