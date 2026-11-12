import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';

/**
 * Firestore 컬렉션/쿼리를 실시간으로 구독
 * @param {() => import('firebase/firestore').Query | null} factory
 * @param {any[]} deps
 * @returns {{ data: any[] | null, error: Error | null }}
 */
export function useCollection(factory, deps) {
  const [state, setState] = useState({ data: null, error: null });
  useEffect(() => {
    const q = factory();
    if (!q) return undefined;
    setState({ data: null, error: null });
    return onSnapshot(
      q,
      (snap) => setState({ data: snap.docs.map((d) => ({ id: d.id, ...d.data() })), error: null }),
      (error) => {
        console.error(error);
        setState({ data: [], error });
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

/**
 * Firestore 문서 1개를 실시간으로 구독
 * data: undefined(로딩 중) / null(없음) / 객체
 */
export function useDocument(factory, deps) {
  const [state, setState] = useState({ data: undefined, error: null });
  useEffect(() => {
    const ref = factory();
    if (!ref) return undefined;
    setState({ data: undefined, error: null });
    return onSnapshot(
      ref,
      (snap) => setState({ data: snap.exists() ? { id: snap.id, ...snap.data() } : null, error: null }),
      (error) => {
        console.error(error);
        setState({ data: null, error });
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export function formatDate(ts) {
  if (!ts) return '';
  const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
