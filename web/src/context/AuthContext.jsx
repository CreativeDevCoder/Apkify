import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, signOut, sendPasswordResetEmail, sendEmailVerification, updateProfile,
  fetchSignInMethodsForEmail
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
  'auth/network-request-failed': 'Koneksi internet bermasalah.'
};
export const authError = (e) => ERR[e?.code] || e?.message || 'Terjadi kesalahan.';

async function ensureProfile(user) {
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

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setUser(u);
    setIsAdmin(false);
    if (u) {
      ensureProfile(u).catch(() => {});
      try {
        const s = await get(ref(db, `admins/${u.uid}`));
        setIsAdmin(s.val() === true);
      } catch { /* bukan admin */ }
    }
    setLoading(false);
  }), []);

  const loginEmail = useCallback((email, pass) => signInWithEmailAndPassword(auth, email, pass), []);
  const register = useCallback(async (name, email, pass) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (name) await updateProfile(cred.user, { displayName: name });
    sendEmailVerification(cred.user).catch(() => {});
    return cred;
  }, []);
  const loginGoogle = useCallback(() => signInWithPopup(auth, googleProvider), []);
  const loginGithub = useCallback(() => signInWithPopup(auth, githubProvider), []);
  const resetPassword = useCallback((email) => sendPasswordResetEmail(auth, email), []);
  const logout = useCallback(async () => {
    clearCache();
    await signOut(auth);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, isAdmin, loading, loginEmail, register, loginGoogle, loginGithub, resetPassword, logout, fetchSignInMethodsForEmail }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
