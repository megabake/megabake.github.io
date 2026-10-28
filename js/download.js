const KERNEL_REVISION = "4f5f3b77d8af3c140ab9c0c7ffc60776f753185e";
const KERNEL_ROOT =
  `https://raw.githubusercontent.com/megabake/megakernels/${KERNEL_REVISION}/kernels`;
const KERNEL_GPU = "nvidia-h200-mig-3g-71gb";
const KERNEL_MODE = "decode";
const KERNEL_FILES = ["module.py", "report.json", "source_map.json"];

// Pin all package files to one verified repository snapshot.
const KERNELS = [
  {
    id: "HuggingFaceTB--SmolLM-135M",
    name: "SmolLM-135M",
    org: "HuggingFaceTB",
    hardware: "H200 · decode",
  },
  {
    id: "Qwen--Qwen2-0.5B",
    name: "Qwen2-0.5B",
    org: "Qwen",
    hardware: "H200 · decode",
  },
  {
    id: "jukofyork--DeepSeek-V3-DRAFT-0.6B-v3.0",
    name: "DeepSeek-V3 draft 0.6B",
    org: "jukofyork",
    hardware: "H200 · decode",
  },
  {
    id: "HuggingFaceTB--SmolLM-1.7B",
    name: "SmolLM-1.7B",
    org: "HuggingFaceTB",
    hardware: "H200 · decode",
  },
  {
    id: "reflection--Beam-1.0-501B-A23B-DFlash2",
    name: "Beam DFlash2 draft",
    org: "reflection",
    hardware: "H200 · decode",
  },
  {
    id: "google--gemma-2b",
    name: "gemma-2b",
    org: "google",
    hardware: "H200 · decode",
  },
];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(data) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n) {
  const out = new Uint8Array(2);
  new DataView(out.buffer).setUint16(0, n, true);
  return out;
}

function u32(n) {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, n, true);
  return out;
}

function concat(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Store-only ZIP so one click can ship several raw GitHub files. */
function zipStore(files) {
  const encoder = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const { data } = file;
    const crc = crc32(data);
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      data,
    ]);
    const central = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }

  const localBlob = concat(locals);
  const centralBlob = concat(centrals);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralBlob.length),
    u32(localBlob.length),
    u16(0),
  ]);
  return concat([localBlob, centralBlob, end]);
}

function kernelBase(id) {
  return `${KERNEL_ROOT}/${id}/${KERNEL_GPU}/${KERNEL_MODE}`;
}

function browseUrl(id) {
  return `https://github.com/megabake/megakernels/tree/${KERNEL_REVISION}/kernels/${id}/${KERNEL_GPU}/${KERNEL_MODE}`;
}

function setStatus(message) {
  const el = document.querySelector("#download-status");
  if (el) el.textContent = message;
}

function saveBlob(filename, bytes) {
  const url = URL.createObjectURL(
    new Blob([bytes], { type: "application/zip" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function downloadKernel(kernel, button) {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = "Preparing…";
  setStatus(`Fetching ${kernel.name}…`);

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30_000);
  try {
    const base = kernelBase(kernel.id);
    const files = await Promise.all(
      KERNEL_FILES.map(async (name) => {
        const response = await fetch(`${base}/${name}`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`${name} (${response.status})`);
        }
        return { name, data: new Uint8Array(await response.arrayBuffer()) };
      }),
    );
    const zipName = `${kernel.id}--${KERNEL_GPU}--${KERNEL_MODE}.zip`;
    saveBlob(zipName, zipStore(files));
    button.textContent = "Saved";
    setStatus(`Downloaded ${zipName}`);
  } catch (error) {
    controller.abort();
    button.textContent = "Retry";
    setStatus(
      `Could not download ${kernel.name}. ${error.name === "AbortError" ? "The request timed out. Try again or use Browse to get the files." : error.message || "Try again."}`,
    );
  } finally {
    window.clearTimeout(timeout);
    window.setTimeout(() => {
      button.disabled = false;
      button.textContent = label;
    }, 1800);
  }
}

function renderKernels() {
  const list = document.querySelector("#kernel-list");
  if (!list) return;

  list.innerHTML = KERNELS.map(
    (kernel) => `
    <li class="kernel-row">
      <div class="kernel-meta">
        <p class="kernel-name">${kernel.name}</p>
        <p class="kernel-sub">${kernel.org} · ${kernel.hardware}</p>
      </div>
      <div class="kernel-actions">
        <a class="kernel-browse" aria-label="Browse ${kernel.name} files" href="${browseUrl(kernel.id)}">Browse</a>
        <button type="button" class="button primary kernel-download" aria-label="Download ${kernel.name} ZIP" data-kernel="${kernel.id}">
          Download
        </button>
      </div>
    </li>`,
  ).join("");

  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-kernel]");
    if (!button) return;
    const kernel = KERNELS.find((entry) => entry.id === button.dataset.kernel);
    if (kernel) downloadKernel(kernel, button);
  });
}

renderKernels();
