import * as XLSX from 'xlsx';
import { genderLabel } from './roster.js';
import { teamStats } from './teams.js';

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function safeFileName(s) {
  return s.replace(/[\\/:*?"<>|]/g, '').trim() || '평가';
}

/**
 * 팀 편성 결과를 엑셀로 저장
 * 파일명: 날짜_평가제목_팀편성결과.xlsx
 * 컬럼: 팀명(색상) | 이름 | 성별 | 역할(주장 여부) | 평가점수 | 팀 평균점수
 */
export function exportTeamsToExcel({ title, teams, byId, teamLabel }) {
  const header = ['팀명(색상)', '이름', '성별', '역할(주장 여부)', '평가점수', '팀 평균점수'];
  const rows = [header];
  const merges = [];

  teams.forEach((team) => {
    const stats = teamStats(team.members, byId);
    const start = rows.length;
    team.members.forEach((id, idx) => {
      const s = byId[id];
      if (!s) return;
      rows.push([
        idx === 0 ? teamLabel(team) : '',
        s.name,
        genderLabel(s.gender),
        team.captainId === id ? '주장' : '',
        s.score,
        idx === 0 ? stats.avg : '',
      ]);
    });
    const end = rows.length - 1;
    if (end > start) {
      merges.push({ s: { r: start, c: 0 }, e: { r: end, c: 0 } });
      merges.push({ s: { r: start, c: 5 }, e: { r: end, c: 5 } });
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!merges'] = merges;
  ws['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 6 }, { wch: 14 }, { wch: 10 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '팀편성결과');
  XLSX.writeFile(wb, `${today()}_${safeFileName(title)}_팀편성결과.xlsx`);
}
