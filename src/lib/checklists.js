// Starting checklists for residential renovation. Edit the items before adding, and always
// check against the rules and certificates that apply in your state.
export const CHECKLIST_TEMPLATES = [
  { name: 'Site safety (start of job)', items: ['Site induction done with everyone on site', 'SWMS (safe work method statement) signed', 'Asbestos check done (older homes)', 'Power, water and gas shut-off locations noted', 'First aid kit and fire extinguisher on site', 'Neighbours told about work and hours'] },
  { name: 'Waterproofing (wet areas)', items: ['Surface clean, sound and primed', 'Sealing tape / bond breaker at wall and floor junctions and penetrations', 'First coat of membrane applied', 'Second coat applied after the recoat time', 'Cure time observed before tiling', 'Flood test passed (kept for 24 hours)', 'Photos taken of every coat', 'Waterproofing certificate received'] },
  { name: 'Plumbing', items: ['Rough-in pressure tested', 'Rough-in photographed before walls are lined', 'Fixtures fitted and checked for leaks', 'Licensed plumber certificate of compliance received'] },
  { name: 'Electrical', items: ['Rough-in checked before walls are lined', 'Rough-in photographed before walls are lined', 'Safety switches tested', 'Licensed electrician certificate of compliance received'] },
  { name: 'Handover', items: ['Defects list cleared', 'Final clean done', 'Warranties and manuals given to client', 'Certificates given to client', 'Final walkthrough with client', 'Keys handed over', 'Final payment received'] }
]

export function listProgress(items) {
  const done = items.filter((i) => i.done).length
  return { done, total: items.length, complete: items.length > 0 && done === items.length }
}

// Groups a project's items by list name, keeping the order the lists were added.
export function groupLists(items) {
  const out = []
  for (const it of items) {
    let g = out.find((x) => x.name === it.list_name)
    if (!g) out.push((g = { name: it.list_name, items: [] }))
    g.items.push(it)
  }
  return out
}
