import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { doc } from 'firebase/firestore';
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { db } from '../../firebase.js';
import { useDocument } from '../../lib/useFirestore.js';
import { splitBalanced, makePairs, pickCaptain, teamStats } from '../../lib/teams.js';
import { TEAM_COLORS, colorByKey, MODE_LABEL } from '../../lib/constants.js';
import { genderLabel } from '../../lib/roster.js';
import { exportTeamsToExcel } from '../../lib/excel.js';
import Spinner from '../../components/Spinner.jsx';
import ProjectionView from '../../components/ProjectionView.jsx';

const MODES = [
  { key: 'half', label: '⚖️ 학생 반으로 나누기' },
  { key: 'gender', label: '🚹🚺 남자팀 · 여자팀' },
  { key: 'pair', label: '🤝 짝 만들기' },
];

export function teamLabel(team, index) {
  if (team.kind === 'pair') return `${index + 1}조`;
  const color = colorByKey(team.colorKey);
  const group = team.group === 'M' ? ' (남자)' : team.group === 'F' ? ' (여자)' : '';
  return `${color.name}팀${group}`;
}

// ── 드래그 가능한 학생 한 줄 ──
function MemberRow({ student, isCaptain, onToggleCaptain, showCaptain }) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: student.id });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `student:${student.id}` });
  return (
    <li
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      {...listeners}
      {...attributes}
      style={{ touchAction: 'manipulation' }}
      className={`flex cursor-grab items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 transition active:cursor-grabbing ${isDragging ? 'opacity-30' : ''} ${isOver ? 'ring-2 ring-blue-500' : 'ring-slate-200'}`}
    >
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${student.gender === 'M' ? 'bg-sky-500' : 'bg-rose-400'}`} title={genderLabel(student.gender)} />
      <span className="flex-1 font-semibold">{student.name}</span>
      {isCaptain && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-white">주장</span>}
      <span className="w-10 text-right text-sm text-slate-500">{student.score}점</span>
      {showCaptain && (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={() => onToggleCaptain(student.id)}
          className={`text-lg leading-none ${isCaptain ? 'text-amber-400' : 'text-slate-200 hover:text-amber-300'}`}
          title="주장 지정"
        >
          ★
        </button>
      )}
    </li>
  );
}

// ── 팀 카드 (드롭 영역) ──
function TeamCard({ team, index, byId, onColorChange, onToggleCaptain }) {
  const { setNodeRef, isOver } = useDroppable({ id: `team:${team.key}` });
  const [palette, setPalette] = useState(false);
  const stats = teamStats(team.members, byId);
  const color = colorByKey(team.colorKey);
  const isPair = team.kind === 'pair';

  return (
    <div ref={setNodeRef} className={`rounded-2xl border-2 p-3 transition ${isPair ? 'border-slate-200 bg-slate-50' : `${color.border} ${color.soft}`} ${isOver ? 'scale-[1.01] shadow-lg' : ''}`}>
      <div className="relative mb-2 flex items-center justify-between gap-2">
        {isPair ? (
          <span className="rounded-xl bg-slate-700 px-3 py-1 font-bold text-white">{teamLabel(team, index)}</span>
        ) : (
          <button type="button" onClick={() => setPalette((v) => !v)} className={`rounded-xl px-3 py-1 font-bold text-white ${color.bg}`} title="눌러서 색상 변경">
            {teamLabel(team, index)} ▾
          </button>
        )}
        <span className="text-xs text-slate-600">
          {stats.count}명 · 남{stats.boys} 여{stats.girls}
        </span>
        {palette && (
          <div className="absolute top-10 left-0 z-20 grid grid-cols-4 gap-2 rounded-xl bg-white p-2 shadow-xl ring-1 ring-slate-200">
            {TEAM_COLORS.map((c) => (
              <button
                type="button"
                key={c.key}
                onClick={() => {
                  onColorChange(team.key, c.key);
                  setPalette(false);
                }}
                className={`h-8 w-14 rounded-lg text-xs font-bold text-white ${c.bg}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="mb-2 flex gap-3 rounded-lg bg-white/70 px-2 py-1 text-sm">
        <span>
          평균 <b>{stats.avg}</b>점
        </span>
        <span>
          4점(에이스) <b>{stats.aces}</b>명
        </span>
      </div>
      <ul className="min-h-12 space-y-1.5">
        {team.members.map((id) =>
          byId[id] ? (
            <MemberRow key={id} student={byId[id]} isCaptain={team.captainId === id} showCaptain={!isPair} onToggleCaptain={(sid) => onToggleCaptain(team.key, sid)} />
          ) : null,
        )}
      </ul>
    </div>
  );
}

export default function TeamBuilder() {
  const { evalId } = useParams();
  const [searchParams] = useSearchParams();
  const { data: evaluation } = useDocument(() => doc(db, 'evaluations', evalId), [evalId]);

  const [mode, setMode] = useState(searchParams.get('mode') || 'half');
  const [boyTeams, setBoyTeams] = useState(2);
  const [girlTeams, setGirlTeams] = useState(2);
  const [pairOption, setPairOption] = useState('same');
  const [excluded, setExcluded] = useState(null); // 오늘 빠지는 학생 id Set
  const [extraScores, setExtraScores] = useState({}); // 점수 없는 학생에게 임시 점수
  const [teams, setTeams] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [projection, setProjection] = useState(false);
  const [showRoster, setShowRoster] = useState(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  // 평가 기록의 학생 (점수 포함)
  const allStudents = useMemo(() => {
    if (!evaluation) return [];
    return (evaluation.students || []).map((s) => {
      const score = typeof s.score === 'number' ? s.score : extraScores[s.id] ?? null;
      return { ...s, score };
    });
  }, [evaluation, extraScores]);

  useEffect(() => {
    if (evaluation && excluded === null) {
      setExcluded(new Set((evaluation.students || []).filter((s) => s.absent || typeof s.score !== 'number').map((s) => s.id)));
    }
  }, [evaluation, excluded]);

  const participants = useMemo(
    () => allStudents.filter((s) => excluded && !excluded.has(s.id) && typeof s.score === 'number'),
    [allStudents, excluded],
  );
  const byId = useMemo(() => Object.fromEntries(allStudents.map((s) => [s.id, s])), [allStudents]);
  const boys = participants.filter((s) => s.gender === 'M').length;
  const girls = participants.length - boys;
  const usePeerVotes = evaluation?.mode === 'peer';

  const generate = useCallback(() => {
    if (participants.length === 0) return;
    const pById = Object.fromEntries(participants.map((s) => [s.id, s]));
    let next = [];
    if (mode === 'half') {
      next = splitBalanced(participants, 2).map((members, i) => ({ key: `t${i}`, kind: 'team', colorKey: TEAM_COLORS[i].key, members }));
    } else if (mode === 'gender') {
      const b = participants.filter((s) => s.gender === 'M');
      const g = participants.filter((s) => s.gender === 'F');
      const bTeams = b.length ? splitBalanced(b, Math.max(1, boyTeams)) : [];
      const gTeams = g.length ? splitBalanced(g, Math.max(1, girlTeams)) : [];
      next = [
        ...bTeams.map((members) => ({ kind: 'team', group: 'M', members })),
        ...gTeams.map((members) => ({ kind: 'team', group: 'F', members })),
      ].map((t, i) => ({ ...t, key: `t${i}`, colorKey: TEAM_COLORS[i % TEAM_COLORS.length].key }));
    } else {
      next = makePairs(participants, pairOption).map((members, i) => ({ key: `p${i}`, kind: 'pair', colorKey: 'gray', members }));
    }
    next = next.map((t) => ({ ...t, captainId: t.kind === 'team' && usePeerVotes ? pickCaptain(t.members, pById) : null }));
    setTeams(next);
  }, [participants, mode, boyTeams, girlTeams, pairOption, usePeerVotes]);

  // 처음 들어왔을 때 자동 편성
  const [autoDone, setAutoDone] = useState(false);
  useEffect(() => {
    if (!autoDone && excluded && participants.length > 0) {
      generate();
      setAutoDone(true);
    }
  }, [autoDone, excluded, participants, generate]);

  // 편성 방식·옵션을 바꾸면 바로 다시 편성
  const generateRef = useRef(generate);
  generateRef.current = generate;
  useEffect(() => {
    if (autoDone) generateRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pairOption, boyTeams, girlTeams]);

  if (evaluation === undefined) return <Spinner />;
  if (evaluation === null) return <div className="card">평가 기록을 찾을 수 없어요.</div>;

  // ── 결과 수정 ──
  const findTeamOf = (sid) => teams.find((t) => t.members.includes(sid));

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over || !teams) return;
    const sid = active.id;
    const from = findTeamOf(sid);
    if (!from) return;
    const overId = String(over.id);

    setTeams((prev) => {
      const copy = prev.map((t) => ({ ...t, members: [...t.members] }));
      const src = copy.find((t) => t.key === from.key);
      if (overId.startsWith('student:')) {
        // 다른 학생 위에 놓으면 → 서로 자리 바꾸기
        const otherId = overId.slice(8);
        if (otherId === sid) return prev;
        const dst = copy.find((t) => t.members.includes(otherId));
        if (!dst) return prev;
        if (dst.key === src.key) {
          const a = src.members.indexOf(sid);
          const b = src.members.indexOf(otherId);
          [src.members[a], src.members[b]] = [src.members[b], src.members[a]];
        } else {
          src.members[src.members.indexOf(sid)] = otherId;
          dst.members[dst.members.indexOf(otherId)] = sid;
          if (src.captainId === sid) src.captainId = null;
          if (dst.captainId === otherId) dst.captainId = null;
        }
      } else if (overId.startsWith('team:')) {
        // 팀 빈 곳에 놓으면 → 그 팀으로 이동
        const dst = copy.find((t) => t.key === overId.slice(5));
        if (!dst || dst.key === src.key) return prev;
        src.members = src.members.filter((m) => m !== sid);
        dst.members.push(sid);
        if (src.captainId === sid) src.captainId = null;
      }
      return copy;
    });
  };

  const changeColor = (teamKey, colorKey) => {
    setTeams((prev) => {
      const target = prev.find((t) => t.key === teamKey);
      return prev.map((t) => {
        if (t.key === teamKey) return { ...t, colorKey };
        if (t.colorKey === colorKey && t.kind === 'team') return { ...t, colorKey: target.colorKey }; // 겹치면 색 교환
        return t;
      });
    });
  };

  const toggleCaptain = (teamKey, sid) => {
    setTeams((prev) => prev.map((t) => (t.key === teamKey ? { ...t, captainId: t.captainId === sid ? null : sid } : t)));
  };

  const downloadExcel = () => {
    const indexOf = (team) => teams.indexOf(team);
    exportTeamsToExcel({ title: evaluation.title, teams, byId, teamLabel: (team) => teamLabel(team, indexOf(team)) });
  };

  const toggleExclude = (id) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">{MODE_LABEL[evaluation.mode]} 결과</div>
          <h1 className="text-2xl font-bold">{evaluation.title} · 팀 편성</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => setShowRoster((v) => !v)}>
            👥 참여 학생 ({participants.length}명)
          </button>
          <button type="button" className="btn-secondary" disabled={!teams} onClick={() => setProjection(true)}>
            📺 학생 공개 모드
          </button>
          <button type="button" className="btn-success" disabled={!teams} onClick={downloadExcel}>
            📥 엑셀 다운로드
          </button>
        </div>
      </div>

      {/* 참여 학생 선택 (결석생 제외, 점수 없는 학생 점수 입력) */}
      {showRoster && excluded && (
        <div className="card">
          <p className="mb-3 text-sm text-slate-500">오늘 빠지는 학생은 눌러서 제외하세요. 점수가 없는 학생(지난 평가 결석)은 점수를 정하면 포함할 수 있어요. 바꾼 뒤에는 <b>[편성하기]</b>를 다시 눌러 주세요.</p>
          <div className="flex flex-wrap gap-2">
            {allStudents.map((s) => {
              const out = excluded.has(s.id);
              if (typeof s.score !== 'number') {
                return (
                  <span key={s.id} className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-sm ring-1 ring-amber-300">
                    {s.name} 점수:
                    {[1, 2, 3, 4].map((n) => (
                      <button
                        type="button"
                        key={n}
                        className="rounded-md bg-white px-1.5 font-bold ring-1 ring-amber-300 hover:bg-amber-100"
                        onClick={() => {
                          setExtraScores((p) => ({ ...p, [s.id]: n }));
                          setExcluded((p) => {
                            const next = new Set(p);
                            next.delete(s.id);
                            return next;
                          });
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </span>
                );
              }
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => toggleExclude(s.id)}
                  className={`rounded-full px-3 py-1 text-sm font-medium ring-1 ${out ? 'bg-slate-100 text-slate-400 line-through ring-slate-200' : s.gender === 'M' ? 'bg-sky-50 text-sky-800 ring-sky-200' : 'bg-rose-50 text-rose-800 ring-rose-200'}`}
                >
                  {s.name} {s.score}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 편성 방식 */}
      <div className="card space-y-4">
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              type="button"
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`rounded-xl px-4 py-2 font-semibold ring-2 transition ${mode === m.key ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white ring-slate-200 hover:ring-slate-300'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {mode === 'half' && <span className="text-slate-600">점수 등급(4→1점)과 남녀 비율을 맞춰 2팀으로 나눠요.</span>}
          {mode === 'gender' && (
            <>
              <label className="flex items-center gap-2">
                남자 ({boys}명)
                <input type="number" min={1} max={8} className="input w-20" value={boyTeams} onChange={(e) => setBoyTeams(Math.max(1, Number(e.target.value) || 1))} />팀
              </label>
              <label className="flex items-center gap-2">
                여자 ({girls}명)
                <input type="number" min={1} max={8} className="input w-20" value={girlTeams} onChange={(e) => setGirlTeams(Math.max(1, Number(e.target.value) || 1))} />팀
              </label>
            </>
          )}
          {mode === 'pair' && (
            <div className="flex gap-2">
              {[
                { key: 'same', label: '같은 성별끼리' },
                { key: 'mixed', label: '다른 성별끼리' },
              ].map((o) => (
                <button
                  type="button"
                  key={o.key}
                  onClick={() => setPairOption(o.key)}
                  className={`rounded-xl px-4 py-2 font-semibold ring-1 ${pairOption === o.key ? 'bg-slate-800 text-white ring-slate-800' : 'bg-white ring-slate-300'}`}
                >
                  {o.label}
                </button>
              ))}
              <span className="self-center text-sm text-slate-500">점수가 비슷한 학생끼리 짝지어요. 홀수면 3인 1조가 생겨요.</span>
            </div>
          )}
          <button type="button" className="btn-primary ml-auto px-6" onClick={generate} disabled={participants.length < 2}>
            {teams ? '🔀 다시 편성하기' : '편성하기'}
          </button>
        </div>
      </div>

      {/* 결과 */}
      {teams && (
        <DndContext sensors={sensors} onDragStart={({ active }) => setActiveId(active.id)} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
          <p className="text-sm text-slate-500">💡 학생을 끌어서 다른 학생 위에 놓으면 서로 바뀌고, 팀 빈 곳에 놓으면 이동해요. ★을 누르면 주장이 바뀌어요.</p>
          <div className={`grid gap-4 ${teams.length <= 2 ? 'md:grid-cols-2' : teams.length <= 4 ? 'md:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'}`}>
            {teams.map((team, i) => (
              <TeamCard key={team.key} team={team} index={i} byId={byId} onColorChange={changeColor} onToggleCaptain={toggleCaptain} />
            ))}
          </div>
          <DragOverlay>
            {activeId && byId[activeId] ? (
              <div className="rounded-xl bg-white px-4 py-2 font-bold shadow-2xl ring-2 ring-blue-500">{byId[activeId].name}</div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {projection && teams && <ProjectionView title={evaluation.title} teams={teams} byId={byId} teamLabel={teamLabel} onClose={() => setProjection(false)} />}
    </div>
  );
}
