// Shared benchmark and download metadata derived from the published report snapshot.
const MODEL_NAMES = {
  'jukofyork/DeepSeek-V3-DRAFT-0.6B-v3.0': 'DeepSeek-V3 draft 0.6B',
  'reflection/Beam-1.0-501B-A23B-DFlash2': 'Beam DFlash2 draft',
};
const PUBLISHED_KERNELS = BENCHMARK_DATA.records.map(({ id, gpu, report }) => {
  const [modelId, modelRevision] = report.model.split('@');
  const baselineKey = ['inductor_graphed', 'inductor_cudagraphs']
    .filter(key => report.decode[key])
    .reduce((best, key) => !best || report.decode[key].complete_call_us < report.decode[best].complete_call_us ? key : best, null);
  return {
    id,
    gpu,
    name: MODEL_NAMES[modelId] || modelId.split('/').pop(),
    org: modelId.split('/')[0],
    hardware: 'H200 · decode',
    modelId,
    modelRevision,
    report,
    baselineKey,
    baseline: report.decode[baselineKey],
    bake: report.decode.megabake_graphed,
    source: `https://github.com/megabake/megakernels/blob/${BENCHMARK_DATA.revision}/kernels/${id}/${gpu}/decode/report.json`,
  };
});
