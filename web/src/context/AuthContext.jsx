import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, signOut, sendPasswordResetEmail, sendEmailVerification, updateProfile,
  fetchSignInMethodsForEmail, signInAnonymously, linkWithPopup, linkWithCredential, EmailAuthProvider
} from 'firebase/auth';
import { ref, get, update, serverTimestamp } from 'firebase/database';
import { auth, db, googleProvider, githubProvider } from '../firebase';
import { clearCache } from '../lib/cache';

const AuthCtx = createContext(null);

const ERR = {
  'auth/invalid-credential': 'Email atau kata sandi salah.',
  'auth/user-not-found': 'Akun tidak ditemukan.',
  'auth/wrong-password': 'Kata sandi salah.',
  'auth/email-already-in-use': 'Email sudah terdaftar. Silakan masuk.',
  'auth/weak-password': 'Kata sandi minimal 6 karakter.',
  'auth/invalid-email': 'Format email tidak valid.',
  'auth/popup-closed-by-user': 'Jendela login ditutup.',
  'auth/account-exists-with-different-credential': 'Email ini sudah terdaftar dengan metode login lain. Masuk dengan metode tersebut dulu.',
  'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi nanti.',
  'auth/network-request-failed': 'Koneksi internet bermasalah.',
  'auth/admin-restricted-operation': 'Mode tamu belum diaktifkan admin. Silakan masuk.',
  'auth/credential-already-in-use': 'Akun ini sudah terdaftar. Masuk dengan akun tersebut (aplikasi tamu tidak ikut pindah).',
  'auth/provider-already-linked': 'Akun sudah terhubung.'
};
export const authError = (e) => ERR[e?.code] || e?.message || 'Terjadi kesalahan.';

async function ensureProfile(user) {
  if (user.isAnonymous) return; // tamu: tidak perlu profil (hemat tulis)
  // Hanya tulis sekali saat pertama kali login (hemat kuota tulis RTDB)
  const key = `apkify:profile:${user.uid}`;
  if (localStorage.getItem(key)) return;
  const snap = await get(ref(db, `users/${user.uid}/createdAt`));
  const data = {
    email: user.email || '',
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
    provider: user.providerData?.[0]?.providerId || 'password',
    lastLoginAt: serverTimestamp()
  };
  if (!snap.exists()) data.createdAt = serverTimestamp();
  await update(ref(db, `users/${user.uid}`), data);
  localStorage.setItem(key, '1');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ver, setVer] = useState(0); // paksa render ulang setelah akun tamu ditautkan

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setUser(u);
    setIsAdmin(false);
    if (u) {
      ensureProfile(u).catch(() => {});
      if (!u.isAnonymous) try {
        const s = await get(ref(db, `admins/${u.uid}`));
        setIsAdmin(s.val() === true);
      } catch { /* bukan admin */ }
    }
    setLoading(false);
  }), []);

  /** Build tanpa login: buat sesi tamu (Firebase Anonymous Auth) bila belum masuk */
  const ensureUser = useCallback(async () => auth.currentUser || (await signInAnonymously(auth)).user, []);

  // Tamu yang mendaftar/masuk via Google/GitHub -> akun ditautkan, uid & aplikasi tetap
  const popup = useCallback(async (provider) => {
    const cur = auth.currentUser;
    if (cur?.isAnonymous) {
      try {
        const r = await linkWithPopup(cur, provider);
        localStorage.removeItem(`apkify:profile:${r.user.uid}`);
        await ensureProfile(r.user);
        setVer((v) => v + 1);
        return r;
      } catch (e) {
        if (e.code !== 'auth/credential-already-in-use') throw e;
      }
    }
    return signInWithPopup(auth, provider);
  }, []);

  const loginEmail = useCallback((email, pass) => signInWithEmailAndPassword(auth, email, pass), []);
  const register = useCallback(async (name, email, pass) => {
    const cur = auth.currentUser;
    const cred = cur?.isAnonymous
      ? await linkWithCredential(cur, EmailAuthProvider.credential(email, pass))
      : await createUserWithEmailAndPassword(auth, email, pass);
    if (name) await updateProfile(cred.user, { displayName: name });
    sendEmailVerification(cred.user).catch(() => {});
    localStorage.removeItem(`apkify:profile:${cred.user.uid}`);
    await ensureProfile(cred.user);
    setVer((v) => v + 1);
    return cred;
  }, []);
  const loginGoogle = useCallback(() => popup(googleProvider), [popup]);
  const loginGithub = useCallback(() => popup(githubProvider), [popup]);
  const resetPassword = useCallback((email) => sendPasswordResetEmail(auth, email), []);
  const logout = useCallback(async () => {
    clearCache();
    await signOut(auth);
  }, []);

  return (
    <AuthCtx.Provider value={{ ver, user, isAnon: !!user?.isAnonymous, isAdmin, loading, ensureUser, loginEmail, register, loginGoogle, loginGithub, resetPassword, logout, fetchSignInMethodsForEmail }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
