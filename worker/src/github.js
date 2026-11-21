// Memicu workflow GitHub Actions (builder) — pengganti VPS untuk build Android.
// Repo publik: menit Actions gratis tanpa batas. Hanya buildId yang dikirim
// sebagai input; konfigurasi diambil builder dari Worker memakai BUILDER_SECRET.
export async function dispatchBuild(env, buildId) {
  const res = await fetch(
    `https://api.github.com/repos/${env.GITHUB_BUILDER_REPO}/actions/workflows/${env.GITHUB_BUILDER_WORKFLOW || 'build-apk.yml'}/dispatches`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.GITHUB_TOKEN}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'apkify-worker',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ ref: env.GITHUB_BUILDER_REF || 'main', inputs: { build_id: buildId } })
    }
  );
  if (res.status !== 204) throw new Error(`GitHub dispatch ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
