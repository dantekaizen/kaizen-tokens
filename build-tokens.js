const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, 'tokens');

function findJson(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) findJson(full, acc);
    else if (e.name.endsWith('.json') && !e.name.startsWith('$')) acc.push(full);
  }
  return acc;
}

function flatten(obj, prefix, out) {
  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('$') || !val || typeof val !== 'object') continue;
    const name = prefix ? `${prefix}-${key}` : key;
    if ('$value' in val) out[name] = val.$value;
    else flatten(val, name, out);
  }
}

const prefixFor = f => f.toLowerCase().includes(`${path.sep}color${path.sep}`) ? 'color' : '';

function load(files) {
  const out = {};
  for (const f of files) flatten(JSON.parse(fs.readFileSync(f, 'utf8')), prefixFor(f), out);
  return out;
}

function resolve(v, map, depth = 0) {
  if (typeof v !== 'string' || depth > 10) return v;
  const m = v.match(/^\{(.+)\}$/);
  if (!m) return v;
  const k = m[1].replace(/\./g, '-');
  const hit = k in map ? k : (`color-${k}` in map ? `color-${k}` : null);
  return hit ? resolve(map[hit], map, depth + 1) : v;
}

const all = findJson(ROOT);
const light = all.find(f => f.endsWith('Light.json'));
const dark = all.find(f => f.endsWith('Dark.json'));
const base = load(all.filter(f => f !== light && f !== dark));
const lightMap = { ...base, ...load([light]) };
const darkMap = { ...base, ...load([dark]) };

function block(map, selector, only) {
  const lines = Object.entries(map)
    .filter(([k]) => !only || k.startsWith(only))
    .map(([k, v]) => [k, resolve(v, map)])
    .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
    .map(([k, v]) => `  --${k}: ${v};`);
  return `${selector} {\n${lines.join('\n')}\n}`;
}

const css = [
  '/* Generado desde las variables de Figma. No editar a mano. */',
  block(lightMap, ':root'),
  block(darkMap, '[data-theme="dark"]', 'color-')
].join('\n\n');

fs.writeFileSync(path.join(__dirname, 'tokens.css'), css);
console.log('tokens.css generado');