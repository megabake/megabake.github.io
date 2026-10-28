# MegaBake

Site for [MegaBake](https://github.com/megabake/megabake), a PyTorch compiler backend that turns an unmodified Hugging Face model into one persistent CUDA kernel.

The page carries the project pitch and a decode leaderboard. Each row is a model, the hardware it ran on, and its speed in tokens per second.

## Leaderboard

Numbers are batch-1 bf16 decode on an NVIDIA H200 MIG `3g.71gb` slice (60 SMs), from the 21 Oct 2026 run in the upstream [ROADMAP.md](https://github.com/megabake/megabake/blob/main/ROADMAP.md). Speed is tokens per second from one token per call.

## Download megakernels

Published decode kernels for the leaderboard rows live in [megabake/megakernels](https://github.com/megabake/megakernels). The site’s Download section links there; clone with:

```bash
git clone https://github.com/megabake/megakernels.git
```

- **Pipelined** overlaps host work with the previous kernel.
- **Synchronized** includes host work on the call.
- **Faster / Slower** compares MegaBake with a CUDA graph of Inductor on the same model.

The headline 14× and 5.6× figures are against eager PyTorch and default `torch.compile`. The table uses the later graphed-Inductor baseline, so those ratios are smaller.

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
assets/           mark and favicon
```
