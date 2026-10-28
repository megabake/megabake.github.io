const HARDWARE = {
  name: "NVIDIA H200",
  detail: "MIG 3g.71gb · 60 SMs · bf16",
};

// Microseconds from the same published reports used by the downloads.
const RESULTS = PUBLISHED_KERNELS.map((item) => ({
  model: item.name,
  note: `${item.org} · ${item.modelRevision.slice(0, 7)}`,
  pipelined: item.bake.pipelined_call_us,
  basePipelined: item.baseline.pipelined_call_us,
  synced: item.bake.complete_call_us,
  baseSynced: item.baseline.complete_call_us,
  kernel: item.bake.kernel_duration_us,
  launches: item.baseline.launch_count,
  source: item.source,
  measuredAt: item.report.published.measured_at,
  runtimeRevision: item.report.published.megabake_commit,
  baselineLabel: item.baselineKey === "inductor_graphed" ? "Hand-captured CUDA graph" : "Inductor reduce-overhead",
}));

const MEASURE_COPY = {
  pipelined: "Pipelined calls overlap host work with the previous kernel.",
  synced: "Median complete call, including host and GPU work. Matches the published results.",
};

const state = {
  measure: "synced",
  filter: "all",
  sort: "speed",
  dir: "desc",
  open: null,
};

const body = document.querySelector("#board-body");
const note = document.querySelector("#measure-note");
const live = document.querySelector("#live-status");
const empty = document.querySelector("#empty-note");

function tokens(us) {
  return 1e6 / us;
}

function formatTok(n) {
  return Math.round(n).toLocaleString("en-US");
}

function formatMs(us) {
  return (us / 1000).toFixed(2);
}

function pair(row) {
  if (state.measure === "synced") {
    return { us: row.synced, base: row.baseSynced };
  }
  return { us: row.pipelined, base: row.basePipelined };
}

function verdict(speedup) {
  if (speedup >= 1.1) return "ahead";
  if (speedup >= 0.9) return "close";
  return "behind";
}

function verdictLabel(kind, speedup) {
  if (kind === "ahead") return `${((speedup - 1) * 100).toFixed(0)}% faster`;
  if (kind === "behind") return `${((1 - speedup) * 100).toFixed(0)}% slower`;
  return "Within 10%";
}

function multiplierLabel(kind, speedup) {
  if (kind === "ahead") return `${speedup.toFixed(2)}× faster`;
  if (kind === "behind") return `${(1 / speedup).toFixed(2)}× slower`;
  return "Within 10%";
}

function rows() {
  const decorated = RESULTS.map((row) => {
    const { us, base } = pair(row);
    const speed = tokens(us);
    const baseSpeed = tokens(base);
    const speedup = base / us;
    return { ...row, us, base, speed, baseSpeed, speedup, kind: verdict(speedup) };
  });
  decorated.sort((a, b) => b.speed - a.speed);
  decorated.forEach((row, index) => {
    row.place = index + 1;
  });
  const max = decorated.reduce((peak, row) => Math.max(peak, row.speed, row.baseSpeed), 1);
  let visible = decorated.filter((row) => {
    if (state.filter !== "all") return row.kind === state.filter;
    return true;
  });
  const dir = state.dir === "asc" ? 1 : -1;
  visible.sort((a, b) => {
    if (state.sort === "model") return a.model.localeCompare(b.model) * dir;
    return (a.speed - b.speed) * dir;
  });
  return { visible, max };
}

function rowMarkup(row) {
  return `
    <tr class="result" data-model="${row.model}">
      <td class="col-rank-cell" data-label="Rank"><span class="rank">${row.place}</span></td>
      <td data-label="Model">
        <div class="model-name">${row.model}</div>
        <div class="model-note">${row.note}</div>
      </td>
      <td data-label="Hardware">
        <div class="hw-name">${HARDWARE.name}</div>
        <div class="hw-detail">${HARDWARE.detail}</div>
      </td>
      <td data-label="Speed">
        <div class="speed-num"><span class="tok">0</span> <span>tok/s</span></div>
        <div class="speed-meta"><span class="ms">0.00</span> ms/token</div>
        <div class="chip"><span class="desktop-comparison"></span><span class="mobile-comparison"></span></div>
        <div class="bars">
          <div class="bar-row"><em>MegaBake</em><div class="track"><i class="bake"></i></div><span class="bake-tok"></span></div>
          <div class="bar-row"><em>Inductor</em><div class="track"><i class="base"></i></div><span class="base-tok"></span></div>
        </div>
        <button type="button" class="more" aria-controls="detail-${RESULTS.findIndex((item) => item.model === row.model)}" aria-label="Breakdown for ${row.model}" aria-expanded="false" data-open="${row.model}">Breakdown</button>
      </td>
    </tr>
    <tr class="breakdown" id="detail-${RESULTS.findIndex((item) => item.model === row.model)}" data-for="${row.model}" hidden>
      <td colspan="4">
        <div class="breakdown-clip">
          <div>
            <dl>
              <div>
                <dt>Pipelined</dt>
                <dd>${formatMs(row.pipelined)} ms · Inductor ${formatMs(row.basePipelined)} ms</dd>
              </div>
              <div>
                <dt>Synchronized call</dt>
                <dd>${formatMs(row.synced)} ms · Inductor ${formatMs(row.baseSynced)} ms</dd>
              </div>
              <div>
                <dt>Kernel launches</dt>
                <dd>${row.launches} → 1 per call</dd>
              </div>
            </dl>
            <p>Measured ${row.measuredAt}. Baseline: ${row.baselineLabel}. MegaBake revision: <code>${row.runtimeRevision}</code>.</p>
            <p><a href="${row.source}">View the source report ↗</a></p>
          </div>
        </div>
      </td>
    </tr>`;
}

function resultRow(model) {
  return [...body.querySelectorAll("tr.result")].find((row) => row.dataset.model === model);
}

function percent(value, max) {
  return Math.max(2, (value / max) * 100);
}

function render() {
  const focusedControl = document.activeElement;
  const { visible, max } = rows();
  if (!body.querySelector("tr.result")) {
    body.innerHTML = RESULTS.map((row) => rowMarkup({ ...row, place: 0 })).join("");
  }

  const visibleIds = new Set(visible.map((row) => row.model));
  empty.hidden = visible.length !== 0;

  for (const row of visible) {
    const tr = resultRow(row.model);
    const detail = tr.nextElementSibling;
    tr.hidden = false;
    tr.querySelector(".rank").textContent = String(row.place);
    tr.querySelector(".rank").classList.toggle("gold", row.place === 1);
    tr.querySelector(".tok").textContent = formatTok(row.speed);
    tr.querySelector(".ms").textContent = formatMs(row.us);
    tr.querySelector(".bake-tok").textContent = formatTok(row.speed);
    tr.querySelector(".base-tok").textContent = formatTok(row.baseSpeed);
    const chip = tr.querySelector(".chip");
    chip.className = `chip ${row.kind}`;
    chip.querySelector(".desktop-comparison").textContent = multiplierLabel(row.kind, row.speedup);
    chip.querySelector(".mobile-comparison").textContent = verdictLabel(row.kind, row.speedup);
    tr.querySelector(".bake").style.width = `${percent(row.speed, max)}%`;
    tr.querySelector(".base").style.width = `${percent(row.baseSpeed, max)}%`;
    const open = state.open === row.model;
    const button = tr.querySelector(".more");
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", `${open ? "Hide" : "Show"} breakdown for ${row.model}`);
    button.textContent = open ? "Hide breakdown" : "Breakdown";
    detail.hidden = !open;
    detail.classList.toggle("is-open", open);
    body.appendChild(tr);
    body.appendChild(detail);
  }

  for (const row of RESULTS) {
    if (visibleIds.has(row.model)) continue;
    const tr = resultRow(row.model);
    const detail = tr.nextElementSibling;
    tr.hidden = true;
    detail.hidden = true;
    detail.classList.remove("is-open");
    body.appendChild(tr);
    body.appendChild(detail);
  }

  document.querySelectorAll("[data-sort]").forEach((button) => {
    const th = button.closest("th");
    if (!th) return;
    const active = button.dataset.sort === state.sort;
    th.setAttribute("aria-sort", active ? (state.dir === "asc" ? "ascending" : "descending") : "none");
  });

  document.querySelector("#mobile-sort").value = `${state.sort}:${state.dir}`;

  const sortLabel = state.sort === "model" ? "model name" : "speed";
  const dirLabel = state.sort === "model"
    ? state.dir === "asc" ? "A to Z" : "Z to A"
    : state.dir === "desc" ? "fastest first" : "slowest first";
  live.textContent = `${visible.length} models, sorted by ${sortLabel}, ${dirLabel}.`;
  if (body.contains(focusedControl) && document.activeElement !== focusedControl) {
    focusedControl.focus({ preventScroll: true });
  }
}

function placeThumbs() {
  document.querySelectorAll(".segment").forEach((group) => {
    const thumb = group.querySelector(".segment-thumb");
    const active = group.querySelector("[aria-pressed='true']");
    if (!thumb || !active) return;
    thumb.style.width = `${active.offsetWidth}px`;
    thumb.style.transform = `translateX(${active.offsetLeft}px)`;
  });
}

document.querySelectorAll("[data-measure]").forEach((button) => {
  button.addEventListener("click", () => {
    if (state.measure === button.dataset.measure) return;
    state.measure = button.dataset.measure;
    document.querySelectorAll("[data-measure]").forEach((peer) => {
      peer.setAttribute("aria-pressed", String(peer === button));
    });
    placeThumbs();
    note.style.opacity = "0";
    window.setTimeout(() => {
      note.textContent = MEASURE_COPY[state.measure];
      note.style.opacity = "1";
    }, 140);
    render();
  });
});

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    if (state.filter === button.dataset.filter) return;
    state.filter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((peer) => {
      peer.setAttribute("aria-pressed", String(peer === button));
    });
    placeThumbs();
    render();
  });
});

document.querySelectorAll("[data-sort]").forEach((button) => {
  button.addEventListener("click", () => {
    if (state.sort === button.dataset.sort) {
      state.dir = state.dir === "asc" ? "desc" : "asc";
    } else {
      state.sort = button.dataset.sort;
      state.dir = state.sort === "model" ? "asc" : "desc";
    }
    render();
  });
});

document.querySelector("#mobile-sort").addEventListener("change", (event) => {
  [state.sort, state.dir] = event.target.value.split(":");
  render();
});

body.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open]");
  if (!button) return;
  const model = button.dataset.open;
  state.open = state.open === model ? null : model;
  render();
});

async function bindCopyButton(button, text) {
  if (!button) return;
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "Copied";
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(document.querySelector(".codeblock pre code"));
      selection.removeAllRanges();
      selection.addRange(range);
      button.textContent = "Press Ctrl/Cmd+C";
    }
    setTimeout(() => {
      button.textContent = "Copy";
    }, 1600);
  });
}

bindCopyButton(
  document.querySelector("#copy-code"),
  "compiled = torch.compile(\n    model,\n    backend=megabake.make_backend(),\n)",
);

const board = document.querySelector(".board");
render();
placeThumbs();
requestAnimationFrame(() => {
  board.classList.add("is-live");
  document.querySelectorAll(".segment-thumb").forEach((thumb) => thumb.classList.add("is-ready"));
});
window.addEventListener("resize", placeThumbs);
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(placeThumbs);
}
