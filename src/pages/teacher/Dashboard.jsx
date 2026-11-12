import { Link, useNavigate } from 'react-router-dom';
import { collection, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useCollection, formatDate } from '../../lib/useFirestore.js';
import { MODE_LABEL } from '../../lib/constants.js';

function sortByTime(list, field) {
  return [...(list || [])].sort((a, b) => (b[field]?.seconds || 0) - (a[field]?.seconds || 0));
}

export default function Dashboard() {
  const navigate = useNavigate();

  const { data: evaluations } = useCollection(() => collection(db, 'evaluations'), []);
  const { data: rooms } = useCollection(() => collection(db, 'rooms'), []);
  const { data: classes } = useCollection(() => collection(db, 'classes'), []);
  const { data: templates } = useCollection(() => collection(db, 'templates'), []);

  const confirmDelete = async (ref, name) => {
    if (window.confirm(`'${name}'을(를) 삭제할까요? 되돌릴 수 없습니다.`)) await deleteDoc(ref);
  };

  const openRooms = sortByTime(rooms, 'createdAt').filter((r) => r.status === 'open');

  return (
    <div className="space-y-8">
      {/* 수업 시작 방식 */}
      <section className="grid gap-4 md:grid-cols-2">
        <Link to="/teacher/new" className="card flex items-center gap-5 py-8 transition hover:-translate-y-0.5 hover:shadow-md">
          <span className="text-5xl">📝</span>
          <div>
            <div className="text-2xl font-bold">새 평가 시작</div>
            <div className="text-slate-500">명단 등록 → 평가 기준 → 방 코드·QR 생성</div>
          </div>
        </Link>
        <a href="#history" className="card flex items-center gap-5 py-8 transition hover:-translate-y-0.5 hover:shadow-md">
          <span className="text-5xl">📂</span>
          <div>
            <div className="text-2xl font-bold">이전 평가 불러오기</div>
            <div className="text-slate-500">학생 설문 없이 바로 새 팀 편성</div>
          </div>
        </a>
      </section>

      {openRooms.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">🔴 진행 중인 평가 방</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {openRooms.map((r) => (
              <div key={r.id} className="card flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold">{r.title}</div>
                  <div className="text-sm text-slate-500">
                    방 코드 <b className="text-slate-800">{r.pin}</b> · {MODE_LABEL[r.mode]} · {formatDate(r.createdAt)}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" className="btn-primary px-3 py-1.5 text-sm" onClick={() => navigate(`/teacher/room/${r.pin}`)}>
                    열기
                  </button>
                  <button type="button" className="btn-danger px-3 py-1.5 text-sm" onClick={() => confirmDelete(doc(db, 'rooms', r.id), `${r.title} 방`)}>
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section id="history">
        <h2 className="mb-3 text-lg font-bold">📂 이전 평가 기록 (재평가 없이 팀 편성)</h2>
        {evaluations === null ? (
          <p className="text-slate-400">불러오는 중...</p>
        ) : evaluations.length === 0 ? (
          <div className="card text-slate-500">아직 완료된 평가가 없어요. 평가를 마치면 여기에 자동으로 저장됩니다.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {sortByTime(evaluations, 'savedAt').map((ev) => {
              const present = (ev.students || []).filter((s) => !s.absent).length;
              return (
                <div key={ev.id} className="card flex flex-col gap-3">
                  <div>
                    <div className="text-lg font-bold">{ev.title}</div>
                    <div className="text-sm text-slate-500">
                      {MODE_LABEL[ev.mode]} · {present}명 · {formatDate(ev.savedAt)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="btn-primary flex-1 py-2 text-sm" onClick={() => navigate(`/teacher/teams/${ev.id}`)}>
                      이 기록으로 팀 편성
                    </button>
                    <button type="button" className="btn-danger px-3 py-2 text-sm" onClick={() => confirmDelete(doc(db, 'evaluations', ev.id), ev.title)}>
                      삭제
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-bold">👥 저장된 학급 명단</h2>
          <div className="card divide-y divide-slate-100 p-0">
            {(classes || []).length === 0 && <p className="p-4 text-slate-400">새 평가 시작 1단계에서 명단을 저장할 수 있어요.</p>}
            {(classes || []).map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3">
                <span>
                  <b>{c.name}</b> <span className="text-sm text-slate-500">({c.students?.length || 0}명)</span>
                </span>
                <button type="button" className="text-sm text-red-500 hover:underline" onClick={() => confirmDelete(doc(db, 'classes', c.id), c.name)}>
                  삭제
                </button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-3 text-lg font-bold">📋 종목별 평가 템플릿</h2>
          <div className="card divide-y divide-slate-100 p-0">
            {(templates || []).length === 0 && <p className="p-4 text-slate-400">새 평가 시작 2단계에서 템플릿을 저장할 수 있어요.</p>}
            {(templates || []).map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3">
                <b>{t.title}</b>
                <button type="button" className="text-sm text-red-500 hover:underline" onClick={() => confirmDelete(doc(db, 'templates', t.id), t.title)}>
                  삭제
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
