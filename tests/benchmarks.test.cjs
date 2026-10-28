const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function load() {
  const context = vm.createContext({});
  for (const file of ['js/benchmark-data.js', 'js/benchmarks.js']) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  }
  const board = fs.readFileSync('js/board.js', 'utf8');
  vm.runInContext(board.slice(0, board.indexOf('const body =')) + board.slice(board.indexOf('function tokens('), board.indexOf('function rowMarkup(')), context);
  return context;
}

test('complete-call values match the six rows published by megakernels', () => {
  const context = load();
  const actual = JSON.parse(vm.runInContext('JSON.stringify(PUBLISHED_KERNELS.map(k => [k.name, Math.round(k.bake.complete_call_us), Math.round(k.baseline.complete_call_us)]))', context));
  assert.deepEqual(actual, [
    ['SmolLM-135M', 1097, 2292],
    ['Qwen2-0.5B', 1318, 2368],
    ['DeepSeek-V3 draft 0.6B', 1339, 2354],
    ['SmolLM-1.7B', 2386, 3099],
    ['gemma-2b', 3351, 3697],
    ['Beam DFlash2 draft', 2508, 2709],
  ]);
});

test('default leaderboard uses complete calls and the strongest graphed baseline', () => {
  const context = load();
  assert.equal(vm.runInContext('state.measure', context), 'synced');
  assert.equal(vm.runInContext('formatTok(rows().visible[0].speed)', context), '912');
  assert.equal(vm.runInContext('multiplierLabel(rows().visible[0].kind, rows().visible[0].speedup)', context), '2.09× faster');
  assert.equal(vm.runInContext('PUBLISHED_KERNELS.every(k => k.baseline.complete_call_us === Math.min(...[k.report.decode.inductor_graphed, k.report.decode.inductor_cudagraphs].filter(Boolean).map(v => v.complete_call_us)))', context), true);
  assert.equal(vm.runInContext('PUBLISHED_KERNELS.every(k => k.source.includes(BENCHMARK_DATA.revision) && k.report.decode.capacity === 128)', context), true);
});

test('pipelined timing uses the same selected baseline and recalculates speedup', () => {
  const context = load();
  vm.runInContext('state.measure = "pipelined"', context);
  assert.equal(vm.runInContext('pair(RESULTS[0]).us', context), vm.runInContext('PUBLISHED_KERNELS[0].bake.pipelined_call_us', context));
  assert.equal(vm.runInContext('pair(RESULTS[0]).base', context), vm.runInContext('PUBLISHED_KERNELS[0].baseline.pipelined_call_us', context));
  assert.equal(vm.runInContext('multiplierLabel(rows().visible[0].kind, rows().visible[0].speedup)', context), '1.85× faster');
});

test('published HTML contains the benchmark values and package links without JavaScript', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.equal((html.match(/<tr class="result" /g) || []).length, 6);
  assert.equal((html.match(/<li class="kernel-row">/g) || []).length, 6);
  assert.match(html, /class="tok">912<\/span>/);
  assert.match(html, /class="desktop-comparison">2\.09× faster<\/span>/);
  const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)[1];
  assert.equal(schema['@graph'][0].url, canonical);
  assert.ok(fs.readFileSync('sitemap.xml', 'utf8').includes(`<loc>${canonical}</loc>`));
});
