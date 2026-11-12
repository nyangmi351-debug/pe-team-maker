import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useCollection, useDocument } from '../../lib/useFirestore.js';
import Spinner from '../../components/Spinner.jsx';

const storageKey = (pin) => `pe-team-maker:${pin}`;

function readLocal(pin) {
  try {
    return localStorage.getItem(storageKey(pin));
  } catch {
    return null;
  }
}
function writeLocal(pin, value) {
  try {
    if (value) localStorage.setItem(storageKey(pin), value);
    else localStorage.removeItem(storageKey(pin));
  } catch {
    /* 저장소를 쓸 수 없는 환경 */
  }
}

function FullMessage({ icon, title, children }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-linear-to-b from-blue-50 to-white p-6 text-center">
      <div className="text-8xl">{icon}</div>
      <h1 className="text-4xl font-extrabold">{title}</h1>
      <div className="text-xl text-slate-500">{children}</div>
    </div>
  );
}

/** 1~4점 기준 버튼 목록 (큰 터치 영역) */
function CriteriaButtons({ criteria, value, onPick }) {
  return (
    <div className="space-y-3">
      {[4, 3, 2, 1].map((s) => (
        <button
          type="button"
          key={s}
          onClick={() => onPick(s)}
          className={`flex w-full items-center gap-4 rounded-2xl p-4 text-left ring-2 transition active:scale-[0.99] ${value === s ? 'bg-blue-50 ring-blue-500' : 'bg-white ring-slate-200 hover:ring-blue-300'}`}
        >
          <span className="flex h-14 w-16 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-2xl font-extrabold text-white">{s}점</span>
          <span className="text-lg font-medium">{criteria[s - 1]}</span>
        </button>
      ))}
    </div>
  );
}

function NameGrid({ students, doneIds, onPick, title, subtitle }) {
  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <h1 className="mb-1 text-center text-3xl font-extrabold">{title}</h1>
      <p className="mb-6 text-center text-lg text-slate-500">{subtitle}</p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {students.map((s) => {
          const done = doneIds.has(s.id);
          return (
            <button
              type="button"
              key={s.id}
              disabled={done}
              onClick={() => onPick(s)}
              className={`flex aspect-[4/3] flex-col items-center justify-center rounded-2xl text-2xl font-bold shadow-sm ring-2 transition active:scale-95 ${
                done ? 'bg-slate-200 text-slate-400 ring-slate-200' : s.gender === 'M' ? 'bg-sky-50 ring-sky-200 hover:ring-sky-400' : 'bg-rose-50 ring-rose-200 hover:ring-rose-400'
              }`}
            >
              {s.name}
              {done && <span className="mt-1 text-sm font-semibold">✔ 완료</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function StudentRoom() {
  const { pin } = useParams();
  const { user, authError } = useAuth();
  const [mySubmitted, setMySubmitted] = useState(() => readLocal(pin));

  // 진행 상태
  const [me, setMe] = useState(null); // 선택한 내 이름(학생 객체)
  const [selfScore, setSelfScore] = useState(null);
  const [peerScores, setPeerScores] = useState({});
  const [peerStep, setPeerStep] = useState(0); // 동료평가: 몇 번째 친구
  const [stage, setStage] = useState('pick'); // pick → rate → vote → confirm
  const [votes, setVotes] = useState([]);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const ready = !!user;
  const { data: room } = useDocument(() => (ready ? doc(db, 'rooms', pin) : null), [pin, ready]);
  const { data: doneDocs } = useCollection(() => (ready ? collection(db, 'rooms', pin, 'done') : null), [pin, ready]);
  const doneIds = useMemo(() => new Set((doneDocs || []).map((d) => d.id)), [doneDocs]);

  // 선생님이 '제출 취소'를 누르면 다시 평가할 수 있도록
  useEffect(() => {
    if (mySubmitted && doneDocs && !doneIds.has(mySubmitted)) {
      writeLocal(pin, null);
      setMySubmitted(null);
      setMe(null);
      setStage('pick');
    }
  }, [mySubmitted, doneDocs, doneIds, pin]);

  if (authError) return <FullMessage icon="⚠️" title="입장 오류">{authError}</FullMessage>;
  if (!ready || room === undefined) return <Spinner text="입장하는 중..." />;
  if (room === null)
    return (
      <FullMessage icon="🔍" title="방을 찾을 수 없어요">
        방 코드 <b>{pin}</b>를 다시 확인해 주세요.
        <div className="mt-6">
          <Link to="/join" className="btn-primary px-6 py-3 text-xl">
            다시 입력하기
          </Link>
        </div>
      </FullMessage>
    );

  const absent = room.absent || {};
  const students = room.students.filter((s) => !absent[s.id]);

  if (mySubmitted && doneIds.has(mySubmitted)) {
    const name = room.students.find((s) => s.id === mySubmitted)?.name;
    return (
      <FullMessage icon="✅" title="제출 완료!">
        {name} 학생, 평가를 잘 마쳤어요.
        <br />
        선생님의 안내를 기다려 주세요.
      </FullMessage>
    );
  }

  if (room.status !== 'open') return <FullMessage icon="⏸️" title="평가가 마감되었어요">선생님의 안내를 기다려 주세요.</FullMessage>;

  // ── 제출 ──
  const submit = async (payload) => {
    setSending(true);
    setSubmitError('');
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'rooms', pin, 'submissions', me.id), {
        studentId: me.id,
        uid: user.uid,
        ...payload,
        submittedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'rooms', pin, 'done', me.id), { uid: user.uid, at: serverTimestamp() });
      await batch.commit();
      writeLocal(pin, me.id);
      setMySubmitted(me.id);
    } catch (e) {
      console.error(e);
      setSubmitError('제출하지 못했어요. 이미 제출된 이름이거나 평가가 마감되었을 수 있어요. 선생님께 말씀해 주세요.');
    } finally {
      setSending(false);
    }
  };

  const resetAll = () => {
    setMe(null);
    setSelfScore(null);
    setPeerScores({});
    setPeerStep(0);
    setVotes([]);
    setStage('pick');
    setSubmitError('');
  };

  // ── 1) 이름 고르기 ──
  if (!me || stage === 'pick') {
    return (
      <NameGrid
        students={students}
        doneIds={doneIds}
        title={room.title}
        subtitle={room.mode === 'self' ? '내 이름을 눌러 주세요' : '먼저 내 이름을 눌러 주세요'}
        onPick={(s) => {
          setMe(s);
          setStage('rate');
        }}
      />
    );
  }

  // ── 개별(자기) 평가 ──
  if (room.mode === 'self') {
    return (
      <div className="mx-auto min-h-screen max-w-2xl p-4 sm:p-6">
        <button type="button" onClick={resetAll} className="mb-4 text-lg text-slate-500">
          ← 이름 다시 고르기
        </button>
        <h1 className="mb-1 text-3xl font-extrabold">{me.name} 학생</h1>
        <p className="mb-5 text-lg text-slate-500">{room.title} · 나에게 맞는 점수를 골라 주세요.</p>
        <CriteriaButtons criteria={room.criteria} value={selfScore} onPick={setSelfScore} />
        {submitError && <p className="mt-4 text-lg text-red-600">{submitError}</p>}
        <button type="button" disabled={!selfScore || sending} onClick={() => submit({ selfScore })} className="btn-primary mt-6 w-full py-4 text-2xl">
          {sending ? '제출 중...' : selfScore ? `${selfScore}점으로 제출하기` : '점수를 골라 주세요'}
        </button>
      </div>
    );
  }

  // ── 동료 평가 ──
  const targets = (room.assignments?.[me.id] || []).map((id) => students.find((s) => s.id === id)).filter(Boolean);
  const voteMax = Math.min(2, students.length - 1);

  if (stage === 'rate' && targets.length > 0) {
    const target = targets[Math.min(peerStep, targets.length - 1)];
    const isLast = peerStep >= targets.length - 1;
    return (
      <div className="mx-auto min-h-screen max-w-2xl p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between text-lg text-slate-500">
          <button type="button" onClick={() => (peerStep === 0 ? resetAll() : setPeerStep(peerStep - 1))}>
            ← 이전
          </button>
          <span>
            친구 평가 {peerStep + 1} / {targets.length}
          </span>
        </div>
        <div className="mb-5 rounded-3xl bg-blue-600 p-6 text-center text-white">
          <div className="text-lg opacity-80">{me.name} 학생이 평가할 친구</div>
          <div className="text-5xl font-extrabold">{target.name}</div>
        </div>
        <CriteriaButtons
          criteria={room.criteria}
          value={peerScores[target.id]}
          onPick={(s) => {
            setPeerScores((p) => ({ ...p, [target.id]: s }));
            setTimeout(() => {
              if (isLast) setStage('vote');
              else setPeerStep((n) => n + 1);
            }, 250);
          }}
        />
      </div>
    );
  }

  if (stage === 'rate' || stage === 'vote') {
    const candidates = students.filter((s) => s.id !== me.id);
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between text-lg text-slate-500">
          <button
            type="button"
            onClick={() => {
              if (targets.length) {
                setPeerStep(targets.length - 1);
                setStage('rate');
              } else resetAll();
            }}
          >
            ← 이전
          </button>
          <span>리더십 투표</span>
        </div>
        <h1 className="mb-1 text-center text-3xl font-extrabold">👑 리더십이 가장 좋은 친구 {voteMax}명</h1>
        <p className="mb-6 text-center text-lg text-slate-500">
          ({votes.length} / {voteMax}명 선택)
        </p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {candidates.map((s) => {
            const on = votes.includes(s.id);
            return (
              <button
                type="button"
                key={s.id}
                onClick={() => setVotes((v) => (on ? v.filter((x) => x !== s.id) : v.length < voteMax ? [...v, s.id] : v))}
                className={`aspect-[4/3] rounded-2xl text-2xl font-bold ring-2 transition active:scale-95 ${on ? 'bg-amber-400 text-white ring-amber-500' : 'bg-white ring-slate-200'}`}
              >
                {on && '👑 '}
                {s.name}
              </button>
            );
          })}
        </div>
        <div className="sticky bottom-4 mx-auto mt-6 max-w-xl">
          <button type="button" disabled={votes.length !== voteMax} onClick={() => setStage('confirm')} className="btn-primary w-full py-4 text-2xl shadow-lg">
            다음 →
          </button>
        </div>
      </div>
    );
  }

  // 최종 확인
  const nameOf = (id) => students.find((s) => s.id === id)?.name || '';
  return (
    <div className="mx-auto min-h-screen max-w-2xl p-4 sm:p-6">
      <button type="button" onClick={() => setStage('vote')} className="mb-4 text-lg text-slate-500">
        ← 이전
      </button>
      <h1 className="mb-5 text-3xl font-extrabold">{me.name} 학생, 이대로 제출할까요?</h1>
      <div className="card mb-4 space-y-2 text-xl">
        {targets.map((t) => (
          <div key={t.id} className="flex justify-between">
            <span>{t.name}</span>
            <b>{peerScores[t.id]}점</b>
          </div>
        ))}
        <div className="border-t border-slate-100 pt-2">👑 리더십 투표: {votes.map(nameOf).join(', ')}</div>
      </div>
      {submitError && <p className="mb-4 text-lg text-red-600">{submitError}</p>}
      <button
        type="button"
        disabled={sending}
        onClick={() => {
          const scores = {};
          targets.forEach((t) => {
            if (peerScores[t.id]) scores[t.id] = peerScores[t.id];
          });
          submit({ peerScores: scores, leaderVotes: votes });
        }}
        className="btn-primary w-full py-4 text-2xl"
      >
        {sending ? '제출 중...' : '제출하기'}
      </button>
    </div>
  );
}
