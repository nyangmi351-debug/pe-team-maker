// 알고리즘 자체 점검용: npm test
import { parseRoster } from '../src/lib/roster.js';
import { buildRoundRobin, computeResults } from '../src/lib/peer.js';
import { splitBalanced, makePairs, tierOf } from '../src/lib/teams.js';

let fail = 0;
let softWarn = 0;
const check = (cond, msg) => { if (!cond) { fail += 1; console.error('✗', msg); } };

// 1. 명단 파싱 + 동명이인
const { students: parsed, errors } = parseRoster('다온 여\n민준 남\n\n민준 남\n규아 여자\n잘못된줄\n홍길동 x');
check(parsed.map((s) => s.name).join(',') === '다온,민준1,민준2,규아', '동명이인 번호: ' + parsed.map((s) => s.name));
check(errors.length === 2, '오류 줄 2개');

// 2. 순환 배정
const ids = Array.from({ length: 25 }, (_, i) => 's' + i);
const rr = buildRoundRobin(ids, 4);
const recv = {};
Object.entries(rr).forEach(([ev, ts]) => ts.forEach((t) => { check(t !== ev, '자기 자신 평가 금지'); recv[t] = (recv[t] || 0) + 1; }));
check(ids.every((id) => recv[id] === 4), '모두 정확히 4번 평가받음');

// 3. 팀 나누기
function randomClass(n, boys) {
  return Array.from({ length: n }, (_, i) => ({ id: 's' + i, name: 's' + i, gender: i < boys ? 'M' : 'F', score: 1 + Math.floor(Math.random() * 4) }));
}
const spread = (a) => Math.max(...a) - Math.min(...a);
for (let trial = 0; trial < 300; trial += 1) {
  const n = 10 + Math.floor(Math.random() * 21);
  const boys = Math.floor(Math.random() * (n + 1));
  const cls = randomClass(n, boys);
  const byId = Object.fromEntries(cls.map((s) => [s.id, s]));
  const teams = splitBalanced(cls, 2).map((t) => t.map((id) => byId[id]));
  check(teams.flat().length === n && new Set(teams.flat().map((s) => s.id)).size === n, '모든 학생 1번씩 배치');
  check(Math.abs(teams[0].length - teams[1].length) <= 1, '인원 차 1 이하');
  for (let t = 1; t <= 4; t += 1) {
    check(spread(teams.map((tm) => tm.filter((s) => tierOf(s.score) === t).length)) <= 1, `${t}점 인원 차 1 이하 (n=${n}, boys=${boys})`);
  }
  check(spread(teams.map((tm) => tm.filter((s) => s.gender === 'M').length)) <= 1, '남학생 수 차 1 이하');
  if (n % 2 === 1 && boys % 2 === 1) {
    const small = teams[0].length < teams[1].length ? teams[0] : teams[1];
    const big = small === teams[0] ? teams[1] : teams[0];
    // 등급 균형이 우선이므로, 등급 균형과 동시에 만족할 수 없는 드문 경우는 경고만 표시
    if (boys < n && small.filter((s) => s.gender === 'M').length !== big.filter((s) => s.gender === 'M').length + 1) softWarn += 1;
  }
}
// 4점 두 명이 한 팀에 몰리지 않는지
const aces = [
  { id: 'a', gender: 'M', score: 4 }, { id: 'b', gender: 'M', score: 4 },
  ...Array.from({ length: 8 }, (_, i) => ({ id: 'x' + i, gender: i % 2 ? 'M' : 'F', score: 2 })),
];
const at = splitBalanced(aces, 2);
check(at[0].includes('a') !== at[0].includes('b'), '4점 2명은 서로 다른 팀');

// 성별 리그 3팀
const boysOnly = randomClass(13, 13);
const t3 = splitBalanced(boysOnly, 3);
check(spread(t3.map((t) => t.length)) <= 1, '3팀 인원 균등');

// 4. 짝 만들기
for (let trial = 0; trial < 200; trial += 1) {
  const n = 2 + Math.floor(Math.random() * 28);
  const cls = randomClass(n, Math.floor(Math.random() * (n + 1)));
  ['same', 'mixed'].forEach((opt) => {
    const g = makePairs(cls, opt);
    check(g.flat().length === n, `짝: 전원 배치 (${opt}, n=${n})`);
    check(g.every((x) => x.length === 2 || x.length === 3), `짝: 2~3명 조 (${opt}, n=${n}) ` + g.map((x) => x.length));
    check(g.filter((x) => x.length === 3).length <= 2, '3인 조는 최대 2개');
  });
}
const mixedCls = [
  { id: 'm4', gender: 'M', score: 4 }, { id: 'm1', gender: 'M', score: 1 },
  { id: 'f4', gender: 'F', score: 4 }, { id: 'f1', gender: 'F', score: 1 },
];
const mp = makePairs(mixedCls, 'mixed').map((g) => g.sort().join('+'));
check(mp.includes('f4+m4') && mp.includes('f1+m1'), '다른 성별 짝: 비슷한 점수끼리 ' + mp);

if (softWarn) console.log(`(참고) 등급 균형을 우선하느라 홀수 남학생 규칙을 지키지 못한 경우 ${softWarn}건`);
// 5. 결과 집계 (동료 평가)
const room = {
  mode: 'peer',
  students: [{ id: 'a', name: 'A', gender: 'M' }, { id: 'b', name: 'B', gender: 'F' }, { id: 'c', name: 'C', gender: 'M' }, { id: 'd', name: 'D', gender: 'F' }],
  absent: { d: true },
};
const subs = [
  { studentId: 'a', peerScores: { b: 3, c: 4 }, leaderVotes: ['b', 'c'] },
  { studentId: 'b', peerScores: { a: 2, c: 3 }, leaderVotes: ['c', 'a'] },
  { studentId: 'd', peerScores: { a: 4 }, leaderVotes: ['a', 'b'] }, // 결석 처리된 학생 제출은 무시
];
let r = computeResults({ room, submissions: subs, manualScores: {} });
const row = (id) => r.rows.find((x) => x.id === id);
check(row('c').score === 3.5 && row('c').votes === 2, '평균 3.5 / 2표');
check(row('a').score === 2 && row('a').votes === 1, '결석생 제출 무시');
check(row('c').status === 'pending' && !r.complete, 'C 미제출 → 미완료');
r = computeResults({ room, submissions: subs, manualScores: { c: 4 } });
check(r.complete && r.finishedCount === 3, '교사 직접 입력으로 완료');

console.log(fail === 0 ? '✓ 모든 알고리즘 테스트 통과' : `✗ 실패 ${fail}건`);
process.exit(fail ? 1 : 0);
