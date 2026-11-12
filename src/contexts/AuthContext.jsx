import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase.js';

const AuthContext = createContext(null);

/**
 * 로그인 구조
 *  · 교사와 학생 모두 '익명 로그인'으로 자동 접속합니다. (회원가입·Google 로그인 없음)
 *  · 교사는 4자리 교사 PIN을 입력하면 이 기기가 '교사 기기'로 등록됩니다. (teacherSessions/{uid})
 *  · 한 번 등록된 기기는 [잠그기]를 누르기 전까지 PIN을 다시 묻지 않습니다.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [isTeacher, setIsTeacher] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [pinReady, setPinReady] = useState(null); // null: 확인 중, false: PIN 미설정, true: 설정됨

  // 1) 익명 자동 로그인
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
      } else {
        signInAnonymously(auth).catch((e) => {
          console.error(e);
          setAuthError('접속에 실패했어요. Firebase 콘솔에서 익명 로그인을 켰는지 확인해 주세요.');
        });
      }
    });
  }, []);

  // 2) 이 기기가 교사 기기로 등록되어 있는지 실시간 확인
  useEffect(() => {
    if (!user) return undefined;
    setSessionLoaded(false);
    return onSnapshot(
      doc(db, 'teacherSessions', user.uid),
      (snap) => {
        setIsTeacher(snap.exists());
        setSessionLoaded(true);
      },
      () => {
        setIsTeacher(false);
        setSessionLoaded(true);
      },
    );
  }, [user]);

  // 3) 교사 PIN이 이미 만들어졌는지 확인
  useEffect(() => {
    if (!user) return undefined;
    return onSnapshot(
      doc(db, 'config', 'status'),
      (snap) => setPinReady(snap.exists()),
      () => setPinReady(false),
    );
  }, [user]);

  const value = {
    user,
    authError,
    loading: !authError && (!user || !sessionLoaded || pinReady === null),
    isTeacher,
    pinReady,
    // 처음 1번: 교사 PIN 만들기 (+ 이 기기를 교사 기기로 등록)
    setupPin: async (pin) => {
      const batch = writeBatch(db);
      batch.set(doc(db, 'config', 'teacher'), { pinCode: pin });
      batch.set(doc(db, 'config', 'status'), { initialized: true, at: serverTimestamp() });
      batch.set(doc(db, 'teacherSessions', user.uid), { code: pin, at: serverTimestamp() });
      await batch.commit();
    },
    // PIN 입력 → 맞으면 교사 기기로 등록 (틀리면 보안 규칙이 거절)
    unlock: (pin) => setDoc(doc(db, 'teacherSessions', user.uid), { code: pin, at: serverTimestamp() }),
    // 잠그기: 이 기기의 교사 등록 해제
    lock: () => deleteDoc(doc(db, 'teacherSessions', user.uid)),
    changePin: (pin) => updateDoc(doc(db, 'config', 'teacher'), { pinCode: pin }),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
