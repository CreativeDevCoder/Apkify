// Data contoh HANYA untuk inspeksi tampilan lokal (VITE_PREVIEW_FIXTURES=1 di .env.local).
// Build produksi tidak menyertakan modul ini karena flag tidak diset.
export const PREVIEW = import.meta.env.VITE_PREVIEW_FIXTURES === '1' && typeof localStorage !== 'undefined' && !!localStorage.getItem('apkify:preview-user');

const now = Date.now();
export const previewUser = { uid: 'preview', email: 'dewi@tokosaya.id', displayName: 'Dewi Lestari', photoURL: '', isAnonymous: false, providerData: [], getIdToken: async () => 'x' };

export const previewApps = [
  { id: 'a1', name: 'Toko Saya', packageName: 'id.tokosaya.app', versionName: '1.4.2', versionCode: 14, lastStatus: 'success', lastBuildId: 'b1', updatedAt: now - 36e5 * 2, platforms: { android: true, windows: true } },
  { id: 'a2', name: 'Absensi Lapangan', packageName: 'com.focus.absensi', versionName: '2.0.0', versionCode: 31, lastStatus: 'building', lastBuildId: 'b2', updatedAt: now - 6e4 * 3, platforms: { android: true } },
  { id: 'a3', name: 'Radio Kita FM', packageName: 'fm.radiokita.player', versionName: '1.0.1', versionCode: 3, lastStatus: 'failed', lastBuildId: 'b3', updatedAt: now - 864e5 * 3, platforms: { android: true, ios: true } },
  { id: 'a4', name: 'Warga RT 05', packageName: 'id.smartvillage.rt05', versionName: '0.9.0', versionCode: 9, lastStatus: 'partial', lastBuildId: 'b4', updatedAt: now - 864e5 * 9, platforms: { android: true, macos: true, linux: true } }
];

export const previewBuilds = [
  { id: 'b2', name: 'Absensi Lapangan', versionName: '2.0.0', status: 'building', createdAt: now - 6e4 * 3 },
  { id: 'b1', name: 'Toko Saya', versionName: '1.4.2', status: 'success', createdAt: now - 36e5 * 2 },
  { id: 'b3', name: 'Radio Kita FM', versionName: '1.0.1', status: 'failed', createdAt: now - 864e5 * 3 },
  { id: 'b4', name: 'Warga RT 05', versionName: '0.9.0', status: 'partial', createdAt: now - 864e5 * 9 },
  { id: 'b5', name: 'Toko Saya', versionName: '1.4.1', status: 'success', createdAt: now - 864e5 * 12 }
];

export const previewBuild = (id) => ({
  b1: {
    appId: 'a1', name: 'Toko Saya', packageName: 'id.tokosaya.app', versionName: '1.4.2', versionCode: 14, status: 'success', createdAt: now - 36e5 * 2, finishedAt: now - 36e5 * 2 + 4.2 * 6e4,
    jobs: { android: 'success', windows: 'success' }, apkFileId: 'x', aabFileId: 'y', apkSize: 6.4e6,
    artifacts: { apk: { fileId: 'x', size: 6.4e6 }, aab: { fileId: 'y', size: 5.1e6 }, exe: { fileId: 'z', size: 3.2e6 }, msi: { fileId: 'w', size: 3.9e6 } }
  },
  b2: { appId: 'a2', name: 'Absensi Lapangan', packageName: 'com.focus.absensi', versionName: '2.0.0', versionCode: 31, status: 'building', createdAt: now - 6e4 * 3, jobs: { android: 'building' } },
  b3: { appId: 'a3', name: 'Radio Kita FM', packageName: 'fm.radiokita.player', versionName: '1.0.1', versionCode: 3, status: 'failed', createdAt: now - 864e5 * 3, jobs: { android: 'failed', ios: 'failed' }, error: 'Gradle: dependency com.example:lib tidak ditemukan.', jobErrors: { android: 'gradle', ios: 'signing' }, logUrl: 'https://github.com' }
}[id] || null);
