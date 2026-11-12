// ─────────────────────────────────────────────────────────────
// 팀/짝 편성 알고리즘
//  · 최우선 원칙: 점수 등급(4→3→2→1점)별 인원을 팀마다 똑같이 나눔 (층화 배분)
//  · 그다음: 남녀 인원, 팀 점수 합(스네이크 드래프트처럼 약한 팀이 먼저 받음)
// ─────────────────────────────────────────────────────────────
import { shuffle } from './peer.js';

/** 점수 → 등급(1~4). 동료평가의 소수점 점수는 반올림 */
export function tierOf(score) {
  return Math.min(4, Math.max(1, Math.round(Number(score) || 1)));
}

/** 점수가 높은 순, 같은 점수는 무작위 순서 */
function sortByScoreDesc(list) {
  return shuffle(list).sort((a, b) => b.score - a.score);
}

function spread(values) {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

/** 팀 구성이 얼마나 불균형한지 점수로 계산 (낮을수록 좋음) */
function imbalance(teams, targets) {
  if (teams.length < 2) return 0;
  let cost = 0;
  for (let t = 1; t <= 4; t += 1) {
    const tierCounts = teams.map((tm) => tm.filter((s) => s.tier === t).length);
    cost += spread(tierCounts) * (t === 4 ? 2000 : 1000); // 1순위: 등급별 인원 (에이스 쏠림이 가장 나쁨)
    ['M', 'F'].forEach((g) => {
      const cell = teams.map((tm) => tm.filter((s) => s.tier === t && s.gender === g).length);
      cost += spread(cell) * 100; // 3순위: 같은 등급 안의 남녀 분배
    });
  }
  teams.forEach((tm, i) => {
    const boys = tm.filter((s) => s.gender === 'M').length;
    cost += Math.abs(boys - targets[i].M) * 300; // 2순위: 팀별 남녀 인원
  });
  const avgs = teams.filter((tm) => tm.length > 0).map((tm) => tm.reduce((a, s) => a + s.score, 0) / tm.length);
  cost += spread(avgs) * 10; // 4순위: 팀 평균 점수
  return cost;
}

/** 팀별 인원 목표, 성별 인원 목표 계산 */
function buildTargets(students, k) {
  const n = students.length;
  const base = Math.floor(n / k);
  const extra = n % k;
  // 앞쪽 팀이 1명 더 많음 → 뒤쪽 팀이 '인원이 적은 팀'
  const sizes = Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
  const boys = Array(k).fill(0);
  const totalBoys = students.filter((s) => s.gender === 'M').length;

  for (let b = 0; b < totalBoys; b += 1) {
    let best = -1;
    for (let i = 0; i < k; i += 1) {
      if (boys[i] >= sizes[i]) continue;
      if (best === -1) { best = i; continue; }
      if (boys[i] < boys[best]) best = i;
      // 남학생 수가 같으면 인원이 적은 팀에 먼저 (홀수 인원 규칙)
      else if (boys[i] === boys[best] && sizes[i] < sizes[best]) best = i;
    }
    boys[best] += 1;
  }
  return sizes.map((size, i) => ({ size, M: boys[i], F: size - boys[i] }));
}

/**
 * 실력·성별 균형 팀 나누기
 * @param {{id,name,gender,score}[]} students
 * @param {number} numTeams
 * @returns {string[][]} 팀별 학생 id 배열
 */
export function splitBalanced(students, numTeams) {
  const list = students.map((s) => ({ ...s, tier: tierOf(s.score) }));
  const k = Math.max(1, Math.min(numTeams, Math.max(list.length, 1)));
  const targets = buildTargets(list, k);
  const teams = Array.from({ length: k }, () => []);

  // 1) 4점 → 1점 순서로 (같은 등급 안에서는 점수 높은 순)
  const ordered = [];
  for (let t = 4; t >= 1; t -= 1) {
    ordered.push(...sortByScoreDesc(list.filter((s) => s.tier === t)));
  }

  // 2) 한 명씩, 가장 '부족한' 팀에 배치
  ordered.forEach((s) => {
    const candidates = teams
      .map((tm, i) => ({ tm, i, rand: Math.random() }))
      .filter(({ tm, i }) => tm.length < targets[i].size);
    const genderRoom = (c) => (c.tm.filter((x) => x.gender === s.gender).length < targets[c.i][s.gender] ? 0 : 1);
    candidates.sort((a, b) => {
      const tierA = a.tm.filter((x) => x.tier === s.tier).length;
      const tierB = b.tm.filter((x) => x.tier === s.tier).length;
      if (tierA !== tierB) return tierA - tierB; // 같은 등급 인원이 적은 팀
      if (genderRoom(a) !== genderRoom(b)) return genderRoom(a) - genderRoom(b); // 이 성별 자리가 남은 팀
      const cellA = a.tm.filter((x) => x.tier === s.tier && x.gender === s.gender).length;
      const cellB = b.tm.filter((x) => x.tier === s.tier && x.gender === s.gender).length;
      if (cellA !== cellB) return cellA - cellB; // 같은 등급·같은 성별이 적은 팀
      const fillA = a.tm.length / targets[a.i].size;
      const fillB = b.tm.length / targets[b.i].size;
      if (fillA !== fillB) return fillA - fillB; // 덜 찬 팀
      const sumA = a.tm.reduce((acc, x) => acc + x.score, 0);
      const sumB = b.tm.reduce((acc, x) => acc + x.score, 0);
      if (sumA !== sumB) return sumA - sumB; // 점수 합이 낮은 팀 (스네이크 효과)
      return a.rand - b.rand;
    });
    teams[candidates[0].i].push(s);
  });

  // 3) 두 학생을 맞바꿔 보며 균형 다듬기 (팀 인원수는 그대로 유지됨)
  let current = imbalance(teams, targets);
  for (let round = 0; round < 50; round += 1) {
    let improved = false;
    for (let a = 0; a < k; a += 1) {
      for (let b = a + 1; b < k; b += 1) {
        for (let i = 0; i < teams[a].length; i += 1) {
          for (let j = 0; j < teams[b].length; j += 1) {
            const x = teams[a][i];
            const y = teams[b][j];
            if (x.gender === y.gender && x.score === y.score) continue;
            teams[a][i] = y;
            teams[b][j] = x;
            const next = imbalance(teams, targets);
            if (next < current - 1e-9) {
              current = next;
              improved = true;
            } else {
              teams[a][i] = x;
              teams[b][j] = y;
            }
          }
        }
      }
    }
    if (!improved) break;
  }

  return teams.map((tm) => sortByScoreDesc(tm).map((s) => s.id));
}

/**
 * 짝 만들기 (2인 1조, 남는 1명은 가장 비슷한 조에 합류해 3인 1조)
 * @param {'same'|'mixed'} genderOption 같은 성별끼리 / 다른 성별끼리
 * @returns {string[][]}
 */
export function makePairs(students, genderOption = 'same') {
  const boys = sortByScoreDesc(students.filter((s) => s.gender === 'M'));
  const girls = sortByScoreDesc(students.filter((s) => s.gender === 'F'));
  const groups = [];
  const leftovers = [];

  const pairSequential = (list) => {
    for (let i = 0; i + 1 < list.length; i += 2) groups.push([list[i], list[i + 1]]);
    if (list.length % 2 === 1) leftovers.push(list[list.length - 1]);
  };

  if (genderOption === 'mixed') {
    // 다른 성별끼리: 점수 차이 합이 가장 작게 남녀를 짝지음 (동적 계획법)
    const [big, small] = boys.length >= girls.length ? [boys, girls] : [girls, boys];
    const m = big.length;
    const f = small.length;
    const INF = Number.MAX_SAFE_INTEGER;
    // dp[i][j] = big 앞 i명, small 앞 j명을 사용했을 때 최소 비용
    const dp = Array.from({ length: m + 1 }, () => Array(f + 1).fill(INF));
    const take = Array.from({ length: m + 1 }, () => Array(f + 1).fill(false));
    for (let i = 0; i <= m; i += 1) dp[i][0] = 0;
    for (let i = 1; i <= m; i += 1) {
      for (let j = 1; j <= Math.min(i, f); j += 1) {
        const skip = dp[i - 1][j];
        const match = dp[i - 1][j - 1] + Math.abs(big[i - 1].score - small[j - 1].score);
        if (match <= skip) { dp[i][j] = match; take[i][j] = true; } else { dp[i][j] = skip; }
      }
    }
    const used = new Set();
    let i = m;
    let j = f;
    const mixedPairs = [];
    while (i > 0 && j > 0) {
      if (take[i][j]) {
        mixedPairs.push([big[i - 1], small[j - 1]]);
        used.add(big[i - 1].id);
        i -= 1; j -= 1;
      } else {
        i -= 1;
      }
    }
    groups.push(...mixedPairs.reverse());
    // 짝을 못 찾은 같은 성별 학생들끼리 묶기
    pairSequential(big.filter((s) => !used.has(s.id)));
  } else {
    pairSequential(boys);
    pairSequential(girls);
  }

  // 남는 학생: 평균 점수가 가장 비슷한 조에 합류 (같은 성별끼리 옵션이면 같은 성별 조 우선)
  const closestGroup = (s, sameGenderOnly) => {
    let best = -1;
    let bestCost = Infinity;
    groups.forEach((g, idx) => {
      if (g.length !== 2) return; // 2인 조에만 합류 (3인 조가 4인이 되지 않도록)
      if (sameGenderOnly && g.some((x) => x.gender !== s.gender)) return;
      const avg = g.reduce((a, x) => a + x.score, 0) / g.length;
      const cost = Math.abs(avg - s.score);
      if (cost < bestCost) { bestCost = cost; best = idx; }
    });
    return best;
  };

  const solo = [];
  // 남는 학생이 2명인데 한 명이 같은 성별 조를 찾을 수 없으면 → 둘이 짝
  if (leftovers.length === 2 && leftovers.some((s) => closestGroup(s, genderOption === 'same') === -1)) {
    groups.push([...leftovers]);
    leftovers.length = 0;
  }
  leftovers.forEach((s) => {
    const idx = closestGroup(s, genderOption === 'same');
    if (idx === -1) solo.push(s);
    else groups[idx].push(s);
  });
  // 같은 성별 조가 없어 합류하지 못한 학생 처리
  if (solo.length >= 2) {
    groups.push(solo);
  } else if (solo.length === 1) {
    const idx = closestGroup(solo[0], false);
    if (idx === -1) groups.push(solo);
    else groups[idx].push(solo[0]);
  }

  return groups
    .sort((a, b) => b.reduce((x, s) => x + s.score, 0) / b.length - a.reduce((x, s) => x + s.score, 0) / a.length)
    .map((g) => g.map((s) => s.id));
}

/** 팀별 리더십 득표 1위를 주장으로 (득표가 없으면 주장 없음) */
export function pickCaptain(memberIds, byId) {
  let best = null;
  memberIds.forEach((id) => {
    const s = byId[id];
    if (!s || !s.votes) return;
    if (!best || s.votes > best.votes || (s.votes === best.votes && s.score > best.score)) best = s;
  });
  return best ? best.id : null;
}

/** 팀 통계: 인원, 남/여, 평균 점수, 4점(에이스) 인원 */
export function teamStats(memberIds, byId) {
  const members = memberIds.map((id) => byId[id]).filter(Boolean);
  const total = members.reduce((a, s) => a + s.score, 0);
  return {
    count: members.length,
    boys: members.filter((s) => s.gender === 'M').length,
    girls: members.filter((s) => s.gender === 'F').length,
    avg: members.length ? Math.round((total / members.length) * 100) / 100 : 0,
    aces: members.filter((s) => tierOf(s.score) === 4).length,
  };
}
