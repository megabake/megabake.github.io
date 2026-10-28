# MegaBake

Website for [MegaBake](https://github.com/megabake/megabake), a PyTorch compiler backend for persistent CUDA kernels.

## Benchmark source

The leaderboard and downloads share the six published H200 decode packages from [megabake/megakernels](https://github.com/megabake/megakernels), pinned to revision `4f5f3b77d8af3c140ab9c0c7ffc60776f753185e`, measured 24 October 2026.

`js/benchmark-data.js` contains the original reports. `js/benchmarks.js` derives shared model metadata, timings, and download paths from that snapshot.

- Complete-call timing is selected by default and matches the source README.
- The baseline is the faster complete call from `inductor_graphed` or `inductor_cudagraphs`. Pipelined comparisons use that same selected baseline.
- Speed is one million divided by latency in microseconds. Speedup is baseline latency divided by MegaBake latency.
- Faster / Slower requires a 10% speed difference. Close is within 10%.
- All rows use batch 1, bf16, and a static 128-token KV cache. Longer-context results use different capacities and are not mixed into this table.

Refresh the snapshot with a full repository commit SHA:

```bash
python3 scripts/update-benchmarks.py <40-character-commit-sha>
```

After refreshing, check the displayed date and headline numbers in `index.html` against the new reports and run the checks below.

The downloadable ZIP contains `module.py`, `report.json`, and `source_map.json` from the same repository revision. Kernels require model weights, compatible hardware, and the matching MegaBake runtime. Hub distribution remains a proposal.

## Run locally

```bash
python3 -m http.server 8765
```

Visit http://127.0.0.1:8765/ or open `index.html` directly.

## Validation

```bash
node --test tests/*.test.cjs
```

Checks cover source benchmark values, baseline selection, timing modes, ZIP integrity, pinned downloads, and failure recovery.
