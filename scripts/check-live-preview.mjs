// Run only against a dedicated test instance: these actions move its viewport
// and toggle compose mode. Example: node scripts/check-live-preview.mjs 8148
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const base = `http://127.0.0.1:${process.argv[2] ?? '8148'}`;
async function request(path, body) {
  const response = await fetch(base + path, body ? {
    method: 'POST', headers: {'content-type':'application/json'}, body:JSON.stringify(body),
  } : undefined);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}
function text(scene) {
  return scene.regions.panes[0].cells.map(row => row.map(cell => cell.t).join('')).join('\n');
}
async function until(predicate) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const value = text(await request('/state'));
    if (predicate(value)) return value;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Real editor preview did not reach the expected rendering');
}
await request('/key', {key:'Home',ctrl:true});
const table = await until(value => value.includes('┌') && value.includes('Meaning'));
assert(!table.includes('| --- |'));
await request('/key', {key:'PageDown'});
const diagram = await until(value => value.includes('host process') && value.includes('┌') && !value.includes('subgraph HOST'));
assert(diagram.includes('Pan Diagrams Left/Right'), 'wide graphs must expose a horizontal viewport');
assert(diagram.split('\n').some(row => /[│╎](?: [│╎]){8}/.test(row)), 'MAIN must show all nine outgoing branches together');
{
  await request('/action', {action:'markdownPanDiagramsRight'});
  const right = await until(value => value.includes('Pan Diagrams Left/Right') && value !== diagram);
  assert.notEqual(right, diagram);
  await request('/action', {action:'markdownPanDiagramsLeft'});
  await until(value => value === diagram);
  await request('/action', {action:'markdownPanDiagramsRight'});
  await request('/action', {action:'markdownCenterDiagrams'});
  await until(value => value === diagram);
}
await request('/action', {action:'markdownToggleCompose'});
await request('/key', {key:'Home',ctrl:true});
await until(value => value.includes('# PetPlay architecture') && value.includes('| Term |'));
await request('/action', {action:'markdownToggleCompose'});
await until(value => value.includes('┌') && value.includes('Meaning'));
await writeFile('.integration/rendered-table.txt', table);
await writeFile('.integration/rendered-diagram.txt', diagram);
console.log('Fresh integration passed: table cells, connected diagram, panning, source restoration, preview restoration.');
