import { isConfigured } from '../firebase.js';

export default function ConfigWarning() {
  if (isConfigured) return null;
  return (
    <div className="mb-6 rounded-2xl bg-amber-50 p-4 text-amber-900 ring-1 ring-amber-300">
      <b>Firebase 설정이 아직 안 되어 있어요.</b> <code className="rounded bg-amber-100 px-1">src/firebaseConfig.js</code> 파일에
      Firebase 콘솔의 설정값을 붙여 넣어 주세요. (README.md 3단계 참고)
    </div>
  );
}
