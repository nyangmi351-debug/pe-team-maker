// 학생 명단 텍스트를 해석하고 동명이인에 번호를 붙입니다.

const GENDER_MAP = {
  남: 'M', 남자: 'M', 남학생: 'M', m: 'M', male: 'M', boy: 'M',
  여: 'F', 여자: 'F', 여학생: 'F', f: 'F', female: 'F', girl: 'F',
};

export function genderLabel(g) {
  return g === 'M' ? '남' : '여';
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * "다온 여" 형식의 여러 줄 텍스트를 학생 배열로 변환
 * @returns {{ students: {id,name,gender}[], errors: string[] }}
 */
export function parseRoster(text) {
  const rows = [];
  const errors = [];

  text.split(/\r?\n/).forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;
    const parts = line.split(/[\s,\t]+/).filter(Boolean);
    if (parts.length < 2) {
      errors.push(`${idx + 1}번째 줄 "${line}" : 성별이 없습니다. (예: 민구 남)`);
      return;
    }
    const genderRaw = parts[parts.length - 1].toLowerCase();
    const gender = GENDER_MAP[genderRaw];
    if (!gender) {
      errors.push(`${idx + 1}번째 줄 "${line}" : 성별은 '남' 또는 '여'로 적어 주세요.`);
      return;
    }
    const name = parts.slice(0, -1).join(' ');
    rows.push({ name, gender });
  });

  return { students: dedupeNames(rows), errors };
}

/**
 * 이름이 겹치는 학생에게 1, 2, 3... 번호를 붙여 구분합니다.
 * 예) 민준, 민준 → 민준1, 민준2
 */
export function dedupeNames(rows) {
  const count = {};
  rows.forEach((r) => {
    count[r.name] = (count[r.name] || 0) + 1;
  });
  const seen = {};
  const used = new Set();
  return rows.map((r) => {
    let name = r.name;
    if (count[r.name] > 1) {
      seen[r.name] = (seen[r.name] || 0) + 1;
      name = `${r.name}${seen[r.name]}`;
    }
    // 혹시 '민준1'이라는 이름이 원래 있었던 경우 등 충돌 방지
    while (used.has(name)) name = `${name}*`;
    used.add(name);
    return { id: r.id || makeId(), name, gender: r.gender };
  });
}

/** 학생 배열을 다시 텍스트로 (불러온 명단 수정용) */
export function rosterToText(students) {
  return students.map((s) => `${s.name} ${genderLabel(s.gender)}`).join('\n');
}
