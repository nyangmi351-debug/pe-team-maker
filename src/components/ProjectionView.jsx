import { useEffect, useRef } from 'react';
import { colorByKey } from '../lib/constants.js';

/**
 * 학생 공개용(칠판 투사) 모드
 * 개인 점수·팀 평균을 숨기고 '팀 색상, 팀원 이름, 주장 뱃지'만 크게 보여줍니다.
 */
export default function ProjectionView({ title, teams, byId, teamLabel, onClose }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    const onKey = (e) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  const many = teams.length > 4;
  const cols = teams.length <= 2 ? 'grid-cols-2' : teams.length <= 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-3 lg:grid-cols-5';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900 p-6 text-white">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold lg:text-4xl">{title}</h1>
        <button type="button" onClick={onClose} className="rounded-xl bg-white/10 px-4 py-2 text-lg font-semibold hover:bg-white/20">
          ✕ 닫기
        </button>
      </div>
      <div className={`grid gap-5 ${cols}`}>
        {teams.map((team, i) => {
          const color = colorByKey(team.colorKey);
          const isPair = team.kind === 'pair';
          return (
            <div key={team.key} className="overflow-hidden rounded-3xl bg-white/5 ring-2 ring-white/10">
              <div className={`px-5 py-4 text-center font-extrabold ${isPair ? 'bg-slate-600' : color.bg} ${many ? 'text-2xl' : 'text-4xl'}`}>{teamLabel(team, i)}</div>
              <ul className={`space-y-2 p-5 ${many ? 'text-2xl' : 'text-3xl lg:text-4xl'}`}>
                {team.members.map((id) => {
                  const s = byId[id];
                  if (!s) return null;
                  return (
                    <li key={id} className="flex items-center gap-3 font-bold">
                      <span>{s.name}</span>
                      {team.captainId === id && <span className="rounded-full bg-amber-400 px-3 py-0.5 text-lg text-slate-900">👑 주장</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
