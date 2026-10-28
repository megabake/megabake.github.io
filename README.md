# MegaBake

Site for [MegaBake](https://github.com/megabake/megabake), a PyTorch compiler backend that turns an unmodified Hugging Face model into one persistent CUDA kernel.

The page carries the project pitch and a decode leaderboard. Each row is a model, the hardware it ran on, and its speed in tokens per second.

## Leaderboard

Numbers are batch-1 bf16 decode on an NVIDIA H200 MIG `3g.71gb` slice (60 SMs), from the 21 Oct 2026 run in the upstream [ROADMAP.md](https://github.com/megabake/megabake/blob/main/ROADMAP.md). Speed is tokens per second from one token per call.

## Download megakernels

Published decode kernels live in [megabake/megakernels](https://github.com/megabake/megakernels). The site’s Download section lists each model with a one-click zip (`module.py`, `report.json`, `source_map.json`) fetched from that repo — no clone required.

- **Pipelined** overlaps host work with the previous kernel.
- **Synchronized** includes host work on the call.
- **Faster / Slower** requires at least a 10% speed difference versus CUDA-graphed Inductor. **Close** is within 10%; all three filters use the same thresholds as the badges.

The headline 14× and 5.6× figures are against eager PyTorch and default `torch.compile`. The table uses the later graphed-Inductor baseline, so those ratios are smaller.

The leaderboard intentionally preserves the full eight-model 21 October run, including regressions.
Download packages are pinned to megakernels revision `4f5f3b77d8af3c140ab9c0c7ffc60776f753185e`; their reports include later measurements and are not the leaderboard dataset.
They require model weights, compatible hardware, and the corresponding MegaBake runtime. Hub distribution is a proposal.

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8765
```

Then visit http://127.0.0.1:8765/.

## Layout

```
index.html        page
css/site.css      layout and type
js/board.js       leaderboard data and controls
js/download.js    per-kernel zip downloads
assets/           mark and favicon
```

## Validation

Run `node --test tests/download.test.cjs` to check ZIP integrity, pinned package downloads, and failure recovery.
