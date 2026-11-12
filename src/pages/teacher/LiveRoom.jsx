import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, deleteField, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { db } from '../../firebase.js';
import { useCollection, useDocument } from '../../lib/useFirestore.js';
import { computeResults } from '../../lib/peer.js';
import { genderLabel } from '../../lib/roster.js';
import { MODE_LABEL } from '../../lib/constants.js';
import Modal from '../../components/Modal.jsx';
import Spinner from '../../components/Spinner.jsx';

const STATUS_STYLE = {
  pending: { label: '미제출', cls: 'bg-white ring-slate-200 text-slate-700' },
  done: { label: '제출 완료', cls: 'bg-emerald-50 ring-emerald-300 text-emerald-800' },
  manual: { label: '교사 입력', cls: 'bg-violet-50 ring-violet-300 text-violet-800' },
  noScore: { label: '받은 평가 없음', cls: 'bg-amber-50 ring-amber-300 text-amber-800' },
  absent: { label: '결석', cls: 'bg-slate-100 ring-slate-200 text-slate-400 line-through' },
};

export default function LiveRoom() {
  const { pin } = useParams();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);
  const [bigQr, setBigQr] = useState(false);
  const [saveState, setSaveState] = useState('');
  const lastSaved = useRef('');

  const { data: room } = useDocument(() => doc(db, 'rooms', pin), [pin]);
  const isOwner = !!room; // 교사 화면은 PIN으로 이미 보호됨
  const { data: priv } = useDocument(() => (isOwner ? doc(db, 'rooms', pin, 'private', 'teacher') : null), [pin, isOwner]);
  const { data: submissions } = useCollection(() => (isOwner ? collection(db, 'rooms', pin, 'submissions') : null), [pin, isOwner]);

  const manualScores = priv?.manualScores || {};
  const results = useMemo(() => {
    if (!room || !submissions) return null;
    return computeResults({ room, submissions, manualScores });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, submissions, priv]);

  const joinUrl = `${window.location.origin}/join/${pin}`;

  // 평가 기록 저장 (모든 학생 완료 시 자동 저장)
  const saveRecord = useCallback(async () => {
    if (!room || !results) return;
    const record = {
      title: room.title,
      criteria: room.criteria,
      mode: room.mode,
      roomPin: pin,
      students: results.rows.map((r) => ({
        id: r.id,
        name: r.name,
        gender: r.gender,
        score: r.absent ? null : r.score,
        votes: r.votes || 0,
        absent: r.absent,
      })),
    };
    const json = JSON.stringify(record);
    if (json === lastSaved.current) return;
    lastSaved.current = json;
    setSaveState('saving');
    await setDoc(doc(db, 'evaluations', room.evalId), { ...record, savedAt: serverTimestamp() });
    setSaveState('saved');
  }, [room, results, pin]);

  useEffect(() => {
    if (results?.complete) saveRecord().catch((e) => { console.error(e); setSaveState('error'); });
  }, [results, saveRecord]);

  if (room === undefined) return <Spinner />;
  if (room === null) return <div className="card">방을 찾을 수 없어요. (방 코드 {pin})</div>;
  if (!results) return <Spinner />;

  const percent = results.activeCount ? Math.round((results.finishedCount / results.activeCount) * 100) : 0;
  const pendingRows = results.rows.filter((r) => !r.absent && (r.status === 'pending' || r.status === 'noScore'));
  const selectedRow = results.rows.find((r) => r.id === selected);

  // ── 교사 조작 ──
  const setManual = (id, score) =>
    setDoc(doc(db, 'rooms', pin, 'private', 'teacher'), { manualScores: { [id]: score } }, { merge: true });
  const clearManual = (id) => updateDoc(doc(db, 'rooms', pin, 'private', 'teacher'), { [`manualScores.${id}`]: deleteField() });
  const setAbsent = (id, value) => updateDoc(doc(db, 'rooms', pin), { [`absent.${id}`]: value ? true : deleteField() });
  const resetSubmission = async (id) => {
    if (!window.confirm('이 학생의 제출 내용을 지우고 다시 평가하게 할까요?')) return;
    const batch = writeBatch(db);
    batch.delete(doc(db, 'rooms', pin, 'submissions', id));
    batch.delete(doc(db, 'rooms', pin, 'done', id));
    await batch.commit();
  };
  const toggleStatus = () => updateDoc(doc(db, 'rooms', pin), { status: room.status === 'open' ? 'closed' : 'open' });

  const goTeams = async (mode) => {
    await saveRecord();
    navigate(`/teacher/teams/${room.evalId}?mode=${mode}`);
  };

  return (
    <div className="space-y-6">
      {/* 상단: 방 정보 + QR */}
      <div className="card flex flex-col gap-6 md:flex-row md:items-center">
        <button type="button" onClick={() => setBigQr(true)} className="shrink-0 self-center rounded-2xl bg-white p-3 ring-1 ring-slate-200" title="크게 보기">
          <QRCodeSVG value={joinUrl} size={150} />
        </button>
        <div className="flex-1">
          <div className="text-sm text-slate-500">{MODE_LABEL[room.mode]}{room.mode === 'peer' && ` · 1인당 ${room.peerCount}명 평가`}</div>
          <h1 className="text-2xl font-bold">{room.title}</h1>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-slate-500">방 코드</span>
            <span className="text-5xl font-extrabold tracking-[0.2em] text-blue-600">{pin}</span>
          </div>
          <div className="mt-1 text-sm text-slate-400">{joinUrl}</div>
        </div>
        <div className="flex flex-col gap-2">
          <button type="button" className="btn-secondary" onClick={() => setBigQr(true)}>
            QR 크게 띄우기
          </button>
          <button type="button" className={room.status === 'open' ? 'btn-danger' : 'btn-success'} onClick={toggleStatus}>
            {room.status === 'open' ? '평가 마감하기' : '평가 다시 열기'}
          </button>
        </div>
      </div>

      {/* 진행률 */}
      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bold">평가 진행 현황</h2>
          <span className="font-semibold">
            {results.finishedCount} / {results.activeCount}명 ({percent}%)
          </span>
        </div>
        <div className="h-4 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${percent}%` }} />
        </div>
        {pendingRows.length > 0 && (
          <p className="mt-3 text-sm text-slate-600">
            <b>미완료:</b> {pendingRows.map((r) => r.name).join(', ')}
          </p>
        )}
        <p className="mt-2 text-xs text-slate-400">결석·기기 오류 학생은 아래 이름 카드를 눌러 점수를 직접 입력하거나 결석 처리하세요.</p>
      </div>

      {results.complete && (
        <div className="card bg-emerald-50 ring-emerald-300">
          <p className="mb-1 text-xl font-bold text-emerald-800">🎉 모든 학생 평가가 완료되었습니다.</p>
          <p className="mb-4 text-sm text-emerald-700">
            {saveState === 'saved' ? '평가 기록이 자동 저장되었어요. 다음 수업에서 재평가 없이 불러올 수 있어요.' : saveState === 'error' ? '저장 중 오류가 발생했어요.' : '평가 기록 저장 중...'}
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-success px-6 py-3 text-lg" onClick={() => goTeams('half')}>
              ⚖️ 학생 반으로 나누기
            </button>
            <button type="button" className="btn-success px-6 py-3 text-lg" onClick={() => goTeams('gender')}>
              🚹🚺 남자팀·여자팀 나누기
            </button>
            <button type="button" className="btn-success px-6 py-3 text-lg" onClick={() => goTeams('pair')}>
              🤝 짝 만들기
            </button>
          </div>
        </div>
      )}

      {/* 학생 카드 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {results.rows.map((r) => {
          const st = STATUS_STYLE[r.status];
          return (
            <button type="button" key={r.id} onClick={() => setSelected(r.id)} className={`rounded-2xl p-3 text-left ring-2 transition hover:shadow ${st.cls}`}>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">{r.name}</span>
                <span className="text-xs opacity-60">{genderLabel(r.gender)}</span>
              </div>
              <div className="mt-1 text-xs font-semibold">{st.label}</div>
              {!r.absent && (
                <div className="mt-1 text-sm">
                  {r.score !== null ? `${r.score}점` : '-'}
                  {room.mode === 'peer' && <span className="ml-1 text-xs opacity-70">(받은 평가 {r.receivedCount} · 표 {r.votes})</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* 학생 처리 모달 */}
      <Modal open={!!selectedRow} onClose={() => setSelected(null)} title={selectedRow ? `${selectedRow.name} (${genderLabel(selectedRow.gender)})` : ''}>
        {selectedRow && (
          <div className="space-y-5">
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              상태: <b>{STATUS_STYLE[selectedRow.status].label}</b>
              {selectedRow.score !== null && !selectedRow.absent && <> · 현재 점수 <b>{selectedRow.score}점</b></>}
              {room.mode === 'peer' && (
                <> · 받은 평가 {selectedRow.receivedCount}개 · 리더십 {selectedRow.votes}표</>
              )}
            </div>

            {!selectedRow.absent && (
              <div>
                <p className="mb-2 font-semibold">점수 직접 입력</p>
                <div className="space-y-2">
                  {[4, 3, 2, 1].map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setManual(selectedRow.id, s)}
                      className={`flex w-full items-center gap-3 rounded-xl p-3 text-left ring-1 transition hover:bg-blue-50 ${selectedRow.manualScore === s ? 'bg-blue-50 ring-2 ring-blue-500' : 'ring-slate-200'}`}
                    >
                      <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-600 font-bold text-white">{s}점</span>
                      <span className="text-sm">{room.criteria[s - 1]}</span>
                    </button>
                  ))}
                </div>
                {selectedRow.manualScore !== null && (
                  <button type="button" className="mt-2 text-sm text-slate-500 underline" onClick={() => clearManual(selectedRow.id)}>
                    직접 입력 취소 (학생 평가 결과 사용)
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <button type="button" className={selectedRow.absent ? 'btn-success' : 'btn-danger'} onClick={() => setAbsent(selectedRow.id, !selectedRow.absent)}>
                {selectedRow.absent ? '결석 취소' : '결석 처리 (명단에서 제외)'}
              </button>
              {selectedRow.submitted && (
                <button type="button" className="btn-secondary" onClick={() => resetSubmission(selectedRow.id)}>
                  제출 취소 (다시 하기)
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* QR 크게 */}
      {bigQr && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white p-6" onClick={() => setBigQr(false)}>
          <h2 className="text-4xl font-bold">{room.title}</h2>
          <QRCodeSVG value={joinUrl} size={Math.min(window.innerWidth, window.innerHeight) * 0.55} />
          <div className="text-center">
            <div className="text-2xl text-slate-500">방 코드</div>
            <div className="text-8xl font-extrabold tracking-[0.2em] text-blue-600">{pin}</div>
          </div>
          <p className="text-slate-400">화면을 누르면 닫혀요</p>
        </div>
      )}
    </div>
  );
}
