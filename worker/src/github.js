// Memicu workflow GitHub Actions (builder) — pengganti VPS untuk build Android, desktop, dan iOS.
// Repo publik: menit Actions gratis (termasuk runner Windows & macOS). Hanya ID build yang dikirim
// sebagai input; konfigurasi diambil builder dari Worker memakai BUILDER_SECRET.
export const WORKFLOWS = {
  android: (env) => env.GITHUB_BUILDER_WORKFLOW || 'build-apk.yml',
  desktop: (env) => env.GITHUB_DESKTOP_WORKFLOW || 'build-desktop.yml',
  ios: (env) => env.GITHUB_IOS_WORKFLOW || 'build-ios.yml'
};

export async function dispatchWorkflow(env, workflow, inputs) {
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_BUILDER_REPO}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'apkify-worker',
      'content-type': 'application/json'
    },
    body: JSON.stringify({ ref: env.GITHUB_BUILDER_REF || 'main', inputs })
  });
  if (res.status !== 204) throw new Error(`GitHub dispatch ${workflow} ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

/** Kompatibel dengan kode lama */
export const dispatchBuild = (env, buildId) => dispatchWorkflow(env, WORKFLOWS.android(env), { build_id: buildId });

/** Daftar job dari pilihan platform. Desktop: satu job per OS (matrix di workflow). */
export function jobsFor(platforms) {
  const jobs = [];
  if (platforms.android) jobs.push('android');
  for (const os of ['windows', 'macos', 'linux']) if (platforms[os]) jobs.push(os);
  if (platforms.ios) jobs.push('ios');
  return jobs;
}

export async function dispatchAll(env, buildId, jobs) {
  const groups = [];
  if (jobs.includes('android')) groups.push([['android'], WORKFLOWS.android(env), { build_id: buildId }]);
  const desk = jobs.filter((j) => ['windows', 'macos', 'linux'].includes(j));
  if (desk.length) groups.push([desk, WORKFLOWS.desktop(env), { build_id: buildId, targets: desk.join(',') }]);
  if (jobs.includes('ios')) groups.push([['ios'], WORKFLOWS.ios(env), { build_id: buildId }]);
  const results = await Promise.allSettled(groups.map(([, wf, inputs]) => dispatchWorkflow(env, wf, inputs)));
  const failedJobs = results.flatMap((r, i) => (r.status === 'rejected' ? groups[i][0] : []));
  if (failedJobs.length === jobs.length) throw results.find((r) => r.status === 'rejected').reason;
  return failedJobs; // job yang gagal dipicu (ditandai gagal oleh pemanggil)
}
