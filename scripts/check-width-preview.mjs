// Targets only a dedicated Fresh test instance; changes its compose preference.
import assert from 'node:assert/strict';
const base = `http://127.0.0.1:${process.argv[2] ?? '8148'}`;
async function request(path, body) {
  const result = await fetch(base + path, body ? {
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),
  } : undefined);
  if (!result.ok) throw new Error(`${path}: ${result.status}`);
  return result.json();
}
await request('/key', {key:'Escape'});
for (const width of ['80', 'None']) {
  await request('/action', {action:'markdownSetComposeWidth'});
  await request('/key', {key:'a',ctrl:true});
  const input = await request('/paste', {text:width});
  assert.equal(input.regions.palette.query, width);
  await request('/key', {key:'Enter'});
  await request('/key', {key:'Home',ctrl:true});
  await request('/key', {key:'PageDown'});
  const deadline = Date.now() + 15000;
  let diagram = false;
  while (Date.now() < deadline) {
    const scene = await request('/state');
    const text = scene.regions.panes[0].cells.map(row => row.map(cell => cell.t).join('')).join('\n');
    if (text.includes('host process') && text.includes('┌') && !text.includes('subgraph HOST')) {
      diagram = true; break;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert(diagram, `diagram after choosing ${width}`);
}
const prompt = await request('/action', {action:'markdownSetComposeWidth'});
assert.equal(prompt.regions.palette.query, 'None');
await request('/key', {key:'Escape'});
console.log('Live width check passed: diagram renders at 80 and after changing to None.');
