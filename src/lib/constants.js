// 팀 조끼 색상 (생성 순서대로 부여: 빨강 → 파랑 → 초록 → 노랑 → ...)
export const TEAM_COLORS = [
  { key: 'red', name: '빨강', bg: 'bg-red-500', soft: 'bg-red-50', border: 'border-red-400', text: 'text-red-700', hex: 'FFEF4444' },
  { key: 'blue', name: '파랑', bg: 'bg-blue-500', soft: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-700', hex: 'FF3B82F6' },
  { key: 'green', name: '초록', bg: 'bg-green-500', soft: 'bg-green-50', border: 'border-green-400', text: 'text-green-700', hex: 'FF22C55E' },
  { key: 'yellow', name: '노랑', bg: 'bg-yellow-400', soft: 'bg-yellow-50', border: 'border-yellow-400', text: 'text-yellow-700', hex: 'FFFACC15' },
  { key: 'orange', name: '주황', bg: 'bg-orange-500', soft: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-700', hex: 'FFF97316' },
  { key: 'purple', name: '보라', bg: 'bg-purple-500', soft: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-700', hex: 'FFA855F7' },
  { key: 'pink', name: '분홍', bg: 'bg-pink-400', soft: 'bg-pink-50', border: 'border-pink-400', text: 'text-pink-700', hex: 'FFF472B6' },
  { key: 'gray', name: '회색', bg: 'bg-gray-500', soft: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-700', hex: 'FF6B7280' },
];

export function colorByKey(key) {
  return TEAM_COLORS.find((c) => c.key === key) || TEAM_COLORS[0];
}

export const DEFAULT_CRITERIA = ['', '', '', ''];

export const EXAMPLE_TEMPLATE = {
  title: '피구 평가',
  criteria: [
    '나는 살아남기에 급했다.',
    '나는 마지막까지 살아남거나 한 경기에서 1명 이상 아웃시킨 적이 있다.',
    '나는 6학년에 한 경기에서 2명 이상 아웃시킨 적이 있다.',
    '피구부',
  ],
};

export const MODE_LABEL = { self: '개별 평가(자기 평가)', peer: '동료 평가' };
