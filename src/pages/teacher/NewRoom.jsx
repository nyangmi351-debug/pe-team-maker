import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useCollection } from '../../lib/useFirestore.js';
import { parseRoster, rosterToText, genderLabel } from '../../lib/roster.js';
import { buildRoundRobin } from '../../lib/peer.js';
import { EXAMPLE_TEMPLATE } from '../../lib/constants.js';

function Steps({ step }) {
  const items = ['학생 명단 등록', '평가 기준 · 방식'];
  return (
    <ol className="mb-6 flex gap-2">
      {items.map((label, i) => (
        <li key={label} className={`flex-1 rounded-xl px-4 py-3 text-center font-semibold ${step === i + 1 ? 'bg-blue-600 text-white' : step > i + 1 ? 'bg-blue-100 text-blue-700' : 'bg-white text-slate-400 ring-1 ring-slate-200'}`}>
          {i + 1}단계 · {label}
        </li>
      ))}
    </ol>
  );
}

async function generateFreePin() {
  for (let i = 0; i < 15; i += 1) {
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    const snap = await getDoc(doc(db, 'rooms', pin));
    if (!snap.exists()) return pin;
  }
  throw new Error('방 코드를 만들지 못했어요. 다시 시도해 주세요.');
}

export default function NewRoom() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // 1단계: 명단
  const [rosterText, setRosterText] = useState('');
  const [className, setClassName] = useState('');
  const [msg, setMsg] = useState('');
  const { data: classes } = useCollection(() => collection(db, 'classes'), []);
  const parsed = useMemo(() => parseRoster(rosterText), [rosterText]);
  const boys = parsed.students.filter((s) => s.gender === 'M').length;

  // 2단계: 평가
  const [title, setTitle] = useState('');
  const [criteria, setCriteria] = useState(['', '', '', '']);
  const [mode, setMode] = useState('self');
  const [peerCount, setPeerCount] = useState(4);
  const { data: templates } = useCollection(() => collection(db, 'templates'), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const flash = (text) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 2500);
  };

  const loadClass = (id) => {
    const c = (classes || []).find((x) => x.id === id);
    if (!c) return;
    setRosterText(rosterToText(c.students || []));
    setClassName(c.name);
  };

  const saveClass = async () => {
    const name = className.trim();
    if (!name) return flash('학급 이름을 입력해 주세요. (예: 6학년 2반)');
    if (parsed.students.length === 0) return flash('저장할 학생이 없어요.');
    const data = { name, students: parsed.students.map(({ name: n, gender }) => ({ name: n, gender })), updatedAt: serverTimestamp() };
    const existing = (classes || []).find((c) => c.name === name);
    if (existing) await updateDoc(doc(db, 'classes', existing.id), data);
    else await addDoc(collection(db, 'classes'), data);
    flash(`'${name}' 명단을 저장했어요.`);
  };

  const loadTemplate = (id) => {
    if (id === '__example') {
      setTitle(EXAMPLE_TEMPLATE.title);
      setCriteria([...EXAMPLE_TEMPLATE.criteria]);
      return;
    }
    const t = (templates || []).find((x) => x.id === id);
    if (!t) return;
    setTitle(t.title);
    setCriteria([...(t.criteria || ['', '', '', ''])]);
  };

  const saveTemplate = async () => {
    if (!title.trim() || criteria.some((c) => !c.trim())) return flash('평가 제목과 1~4점 기준을 모두 입력해 주세요.');
    const data = { title: title.trim(), criteria: criteria.map((c) => c.trim()), updatedAt: serverTimestamp() };
    const existing = (templates || []).find((t) => t.title === data.title);
    if (existing) await updateDoc(doc(db, 'templates', existing.id), data);
    else await addDoc(collection(db, 'templates'), data);
    flash(`'${data.title}' 템플릿을 저장했어요.`);
  };

  const createRoom = async () => {
    setError('');
    if (!title.trim() || criteria.some((c) => !c.trim())) {
      setError('평가 제목과 1~4점 기준을 모두 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      const pin = await generateFreePin();
      const students = parsed.students;
      const ids = students.map((s) => s.id);
      await setDoc(doc(db, 'rooms', pin), {
        pin,
        createdBy: user.uid,
        title: title.trim(),
        criteria: criteria.map((c) => c.trim()),
        mode,
        peerCount: mode === 'peer' ? Math.min(peerCount, students.length - 1) : 0,
        students,
        studentIds: ids,
        assignments: mode === 'peer' ? buildRoundRobin(ids, peerCount) : {},
        absent: {},
        status: 'open',
        evalId: `${Date.now()}_${pin}`,
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'rooms', pin, 'private', 'teacher'), { manualScores: {} });
      navigate(`/teacher/room/${pin}`);
    } catch (e) {
      console.error(e);
      setError(`방을 만들지 못했어요: ${e.message}`);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Steps step={step} />
      {msg && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-3 text-white shadow-lg">{msg}</div>}

      {step === 1 && (
        <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
          <div className="card space-y-4">
            <div>
              <label className="label">저장된 학급 명단 불러오기</label>
              <select className="input" defaultValue="" onChange={(e) => loadClass(e.target.value)}>
                <option value="" disabled>
                  {(classes || []).length ? '학급을 선택하세요' : '저장된 명단이 없어요'}
                </option>
                {(classes || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.students?.length || 0}명)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">학생 명단 (한 줄에 한 명: 이름 성별)</label>
              <textarea
                className="input h-72 font-mono"
                placeholder={'다온 여\n규아 여\n민구 남'}
                value={rosterText}
                onChange={(e) => setRosterText(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <input className="input" placeholder="학급 이름 (예: 6학년 2반)" value={className} onChange={(e) => setClassName(e.target.value)} />
              <button type="button" className="btn-secondary shrink-0" onClick={saveClass}>
                명단 저장
              </button>
            </div>
          </div>

          <div className="card">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold">미리보기</h3>
              <span className="text-sm text-slate-500">
                총 {parsed.students.length}명 (남 {boys} · 여 {parsed.students.length - boys})
              </span>
            </div>
            {parsed.errors.length > 0 && (
              <ul className="mb-3 space-y-1 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {parsed.errors.map((e) => (
                  <li key={e}>⚠️ {e}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              {parsed.students.map((s) => (
                <span key={s.id} className={`rounded-full px-3 py-1 text-sm font-medium ${s.gender === 'M' ? 'bg-sky-100 text-sky-800' : 'bg-rose-100 text-rose-800'}`}>
                  {s.name} <span className="opacity-60">{genderLabel(s.gender)}</span>
                </span>
              ))}
            </div>
            {parsed.students.length === 0 && <p className="text-slate-400">왼쪽에 명단을 입력하면 여기에 표시됩니다. 같은 이름은 자동으로 민준1, 민준2처럼 구분돼요.</p>}
          </div>

          <div className="flex justify-end md:col-span-2">
            <button type="button" className="btn-primary px-8 py-3 text-lg" disabled={parsed.students.length < 2 || parsed.errors.length > 0} onClick={() => setStep(2)}>
              다음 단계 →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="card space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-60 flex-1">
                <label className="label">평가 템플릿 불러오기</label>
                <select className="input" defaultValue="" onChange={(e) => loadTemplate(e.target.value)}>
                  <option value="" disabled>
                    템플릿 선택
                  </option>
                  {(templates || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                  <option value="__example">(예시) 피구 평가</option>
                </select>
              </div>
              <button type="button" className="btn-secondary" onClick={saveTemplate}>
                현재 기준을 템플릿으로 저장
              </button>
            </div>
            <div>
              <label className="label">평가 제목</label>
              <input className="input text-lg" placeholder="예: 피구 평가" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            {[4, 3, 2, 1].map((score) => (
              <div key={score} className="flex items-center gap-3">
                <span className="flex h-11 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-600 font-bold text-white">{score}점</span>
                <input
                  className="input"
                  placeholder={`${score}점 기준`}
                  value={criteria[score - 1]}
                  onChange={(e) => {
                    const next = [...criteria];
                    next[score - 1] = e.target.value;
                    setCriteria(next);
                  }}
                />
              </div>
            ))}
          </div>

          <div className="card">
            <h3 className="mb-3 font-bold">평가 방식</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                { key: 'self', icon: '🙋', name: '개별 평가 (자기 평가)', desc: '학생이 자기 이름을 누르고 본인 점수를 선택해요.' },
                { key: 'peer', icon: '🤝', name: '동료 평가', desc: '순환 배정된 친구들을 평가하고, 리더십 투표(2명)를 해요.' },
              ].map((m) => (
                <button
                  type="button"
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  className={`rounded-2xl p-4 text-left ring-2 transition ${mode === m.key ? 'bg-blue-50 ring-blue-500' : 'bg-white ring-slate-200 hover:ring-slate-300'}`}
                >
                  <div className="text-lg font-bold">
                    {m.icon} {m.name}
                  </div>
                  <div className="text-sm text-slate-500">{m.desc}</div>
                </button>
              ))}
            </div>
            {mode === 'peer' && (
              <div className="mt-4 flex items-center gap-3">
                <label className="font-semibold">학생 1명이 평가할(받을) 친구 수</label>
                <select className="input w-28" value={peerCount} onChange={(e) => setPeerCount(Number(e.target.value))}>
                  {[3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}명
                    </option>
                  ))}
                </select>
                <span className="text-sm text-slate-500">모든 학생이 똑같은 횟수로 평가받아요.</span>
              </div>
            )}
          </div>

          {error && <p className="text-red-600">{error}</p>}
          <div className="flex justify-between">
            <button type="button" className="btn-secondary" onClick={() => setStep(1)}>
              ← 명단 수정
            </button>
            <button type="button" className="btn-primary px-8 py-3 text-lg" disabled={busy} onClick={createRoom}>
              {busy ? '방 만드는 중...' : '평가 방 만들기 (QR 생성)'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
