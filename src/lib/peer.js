// 동료 평가: 균등 순환 배정 + 점수 집계

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 균등 순환 배정(Round-Robin)
 * 학생 순서를 무작위로 섞은 뒤 원형으로 세우고,
 * 각 학생이 자기 다음 k명을 평가합니다.
 * → 모든 학생이 정확히 k번 평가하고, 정확히 k번 평가받습니다.
 * @returns {Record<string, string[]>} 평가자 id → 평가 대상 id 목록
 */
export function buildRoundRobin(studentIds, k) {
  const n = studentIds.length;
  const per = Math.max(0, Math.min(k, n - 1));
  const order = shuffle(studentIds);
  const result = {};
  order.forEach((id, i) => {
    const targets = [];
    for (let step = 1; step <= per; step += 1) {
      targets.push(order[(i + step) % n]);
    }
    result[id] = targets;
  });
  return result;
}

/**
 * 방 정보 + 제출 목록 + 교사 직접 입력 → 학생별 최종 상태 계산
 */
export function computeResults({ room, submissions, manualScores = {} }) {
  const absent = room.absent || {};
  const subMap = {};
  submissions.forEach((s) => {
    subMap[s.studentId] = s;
  });

  const received = {};
  const votes = {};
  room.students.forEach((s) => {
    received[s.id] = [];
    votes[s.id] = 0;
  });

  if (room.mode === 'peer') {
    submissions.forEach((sub) => {
      if (absent[sub.studentId]) return;
      Object.entries(sub.peerScores || {}).forEach(([target, score]) => {
        if (received[target] && typeof score === 'number') received[target].push(score);
      });
      (sub.leaderVotes || []).forEach((target) => {
        if (votes[target] !== undefined) votes[target] += 1;
      });
    });
  }

  const rows = room.students.map((s) => {
    const isAbsent = !!absent[s.id];
    const submitted = !!subMap[s.id];
    const manual = manualScores[s.id];
    let autoScore = null;
    if (room.mode === 'self') {
      autoScore = submitted ? subMap[s.id].selfScore : null;
    } else if (received[s.id].length > 0) {
      const sum = received[s.id].reduce((a, b) => a + b, 0);
      autoScore = Math.round((sum / received[s.id].length) * 100) / 100;
    }
    const score = typeof manual === 'number' ? manual : autoScore;

    let status;
    if (isAbsent) status = 'absent';
    else if (typeof manual === 'number') status = 'manual';
    else if (submitted && score !== null) status = 'done';
    else if (submitted) status = 'noScore'; // 동료평가: 제출했지만 받은 평가가 없음
    else status = 'pending';

    return {
      ...s,
      absent: isAbsent,
      submitted,
      manualScore: typeof manual === 'number' ? manual : null,
      receivedCount: received[s.id].length,
      score,
      votes: votes[s.id],
      status,
    };
  });

  const active = rows.filter((r) => !r.absent);
  const finished = active.filter((r) => r.status === 'done' || r.status === 'manual');
  return {
    rows,
    activeCount: active.length,
    finishedCount: finished.length,
    complete: active.length > 0 && finished.length === active.length,
  };
}
