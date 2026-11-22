// Serah-terima data antar halaman di memori (mis. ZIP hasil Media App Maker -> halaman Buat Aplikasi).
// File tidak bisa disimpan di sessionStorage, jadi cukup variabel modul (hilang bila halaman di-refresh).
let pending = null;

export function setHandoff(data) {
  pending = data;
}

export function takeHandoff() {
  const d = pending;
  pending = null;
  return d;
}
