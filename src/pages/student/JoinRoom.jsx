import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function JoinRoom() {
  const [pin, setPin] = useState('');
  const navigate = useNavigate();

  const submit = (e) => {
    e.preventDefault();
    if (pin.length === 6) navigate(`/join/${pin}`);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-b from-blue-50 to-white p-6">
      <form onSubmit={submit} className="card w-full max-w-md text-center">
        <div className="mb-2 text-6xl">🙋</div>
        <h1 className="mb-6 text-3xl font-extrabold">방 코드 입력</h1>
        <input
          inputMode="numeric"
          autoFocus
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          className="input mb-6 py-4 text-center text-5xl font-bold tracking-[0.3em]"
        />
        <button type="submit" disabled={pin.length !== 6} className="btn-primary w-full py-4 text-2xl">
          입장하기
        </button>
        <p className="mt-4 text-slate-400">선생님 화면의 QR 코드를 찍어도 들어갈 수 있어요.</p>
        <Link to="/" className="mt-2 inline-block text-sm text-slate-400 underline">
          처음으로
        </Link>
      </form>
    </div>
  );
}
