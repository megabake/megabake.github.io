const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function load(fetch) {
  const status = { textContent: '' };
  const timers = [];
  const blobs = [];
  const context = vm.createContext({
    TextEncoder, Uint8Array, Uint32Array, DataView, Blob, AbortController, fetch,
    URL: { createObjectURL(blob) { blobs.push(blob); return 'blob:test'; }, revokeObjectURL() {} },
    document: {
      querySelector: (selector) => selector === '#download-status' ? status : null,
      createElement: () => ({ click() {}, remove() {} }),
      body: { appendChild() {} },
    },
    window: { setTimeout(fn, delay) { timers.push({ fn, delay }); return timers.length; }, clearTimeout() {} },
  });
  vm.runInContext(fs.readFileSync('js/download.js', 'utf8'), context);
  return { api: vm.runInContext('({zipStore, crc32, downloadKernel, KERNELS, KERNEL_REVISION})', context), status, timers, blobs };
}

test('ZIP preserves binary data, headers, directory offsets and CRC', () => {
  const { api } = load();
  assert.equal(api.crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const files = [
    { name: 'module.py', data: new TextEncoder().encode('print("baked")\n') },
    { name: 'report.json', data: new TextEncoder().encode('{"ok":true}') },
    { name: 'source_map.json', data: Uint8Array.from([0, 128, 255, 10]) },
  ];
  const zip = Buffer.from(api.zipStore(files));
  const end = zip.length - 22;
  assert.equal(zip.readUInt32LE(end), 0x06054b50);
  assert.equal(zip.readUInt16LE(end + 10), 3);
  let central = zip.readUInt32LE(end + 16);
  for (const file of files) {
    assert.equal(zip.readUInt32LE(central), 0x02014b50);
    const offset = zip.readUInt32LE(central + 42);
    assert.equal(zip.readUInt32LE(offset), 0x04034b50);
    const nameLength = zip.readUInt16LE(offset + 26);
    assert.equal(zip.subarray(offset + 30, offset + 30 + nameLength).toString(), file.name);
    const data = zip.subarray(offset + 30 + nameLength, offset + 30 + nameLength + file.data.length);
    assert.deepEqual(data, Buffer.from(file.data));
    assert.equal(zip.readUInt32LE(offset + 14), api.crc32(data));
    central += 46 + nameLength;
  }
  assert.equal(central, end);
});

test('download uses one immutable revision and produces a ZIP', async () => {
  const requests = [];
  const env = load(async (url, options) => {
    requests.push({ url, signal: options.signal });
    return { ok: true, arrayBuffer: async () => new TextEncoder().encode('test').buffer };
  });
  const button = { textContent: 'Download', disabled: false };
  await env.api.downloadKernel(env.api.KERNELS[0], button);
  assert.equal(requests.length, 3);
  assert.ok(requests.every(({url}) => url.includes(env.api.KERNEL_REVISION)));
  assert.ok(requests.every(({signal}) => signal === requests[0].signal));
  assert.equal(env.blobs.length, 1);
  assert.match(env.status.textContent, /^Downloaded .*\.zip$/);
  env.timers.find(t => t.delay === 1800).fn();
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, 'Download');
});

test('HTTP failure aborts companion requests, reports the error and allows retry', async () => {
  let signal;
  const env = load(async (url, options) => {
    signal = options.signal;
    return { ok: false, status: 404 };
  });
  const button = { textContent: 'Download', disabled: false };
  await env.api.downloadKernel(env.api.KERNELS[0], button);
  assert.equal(signal.aborted, true);
  assert.equal(env.blobs.length, 0);
  assert.match(env.status.textContent, /Could not download.*404/);
  env.timers.find(t => t.delay === 1800).fn();
  assert.equal(button.disabled, false);
});

test('timeout gives an actionable message', async () => {
  const env = load(async () => { const error = new Error('Aborted'); error.name = 'AbortError'; throw error; });
  await env.api.downloadKernel(env.api.KERNELS[0], { textContent: 'Download' });
  assert.match(env.status.textContent, /timed out.*Browse/);
  assert.equal(env.blobs.length, 0);
});
