// Pre-render the existing client templates for visitors and crawlers without JS.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
process.chdir(path.resolve(__dirname, '..'));
const list = { innerHTML: '', addEventListener() {} };
const context = vm.createContext({
  document: { querySelector: selector => selector === '#kernel-list' ? list : null },
});
for (const file of ['js/benchmark-data.js', 'js/benchmarks.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context);
}
const board = fs.readFileSync('js/board.js', 'utf8');
vm.runInContext(board.slice(0, board.indexOf('const body =')) + board.slice(board.indexOf('function tokens('), board.indexOf('function render(')), context);
const rows = vm.runInContext('rows().visible.map(rowMarkup).join("")', context);
vm.runInContext(fs.readFileSync('js/download.js', 'utf8'), context);
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/(<tbody id="board-body">)[\s\S]*?(<\/tbody>)/, `$1${rows}\n$2`);
html = html.replace(/(<ul class="kernel-list" id="kernel-list" aria-label="Published megakernels">)[\s\S]*?(<\/ul>)/, `$1${list.innerHTML}\n$2`);
html = html.replace(/((?:src|href)=")((?:css|js)\/[^"?]+)(?:\?v=[^"]*)?"/g, (_, prefix, file) => {
  const version = createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
  return `${prefix}${file}?v=${version}"`;
});
fs.writeFileSync('index.html', html);
const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)[1];
fs.writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${canonical}</loc></url>\n</urlset>\n`);
console.log('Pre-rendered benchmark rows, download links, and sitemap.');
