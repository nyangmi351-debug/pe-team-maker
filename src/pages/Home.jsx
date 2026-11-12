import { Link } from 'react-router-dom';
import ConfigWarning from '../components/ConfigWarning.jsx';

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center p-6">
      <ConfigWarning />
      <div className="mb-10 text-center">
        <div className="mb-3 text-6xl">🏃‍♀️🏃</div>
        <h1 className="text-3xl font-extrabold sm:text-4xl">체육 팀 편성 도우미</h1>
        <p className="mt-3 text-slate-500">실력과 성별 균형을 맞춘 팀·짝을 자동으로 만들어 드려요.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/teacher" className="card flex flex-col items-center gap-3 py-10 text-center transition hover:-translate-y-1 hover:shadow-md">
          <span className="text-5xl">🧑‍🏫</span>
          <span className="text-2xl font-bold">선생님</span>
          <span className="text-slate-500">평가 방 만들기 · 팀 편성</span>
        </Link>
        <Link to="/join" className="card flex flex-col items-center gap-3 py-10 text-center transition hover:-translate-y-1 hover:shadow-md">
          <span className="text-5xl">🙋</span>
          <span className="text-2xl font-bold">학생 입장</span>
          <span className="text-slate-500">방 코드 입력하기</span>
        </Link>
      </div>
    </div>
  );
}
