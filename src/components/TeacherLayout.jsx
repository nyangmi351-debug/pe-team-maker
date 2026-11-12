import { Link, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import Spinner from './Spinner.jsx';
import ConfigWarning from './ConfigWarning.jsx';
import Modal from './Modal.jsx';

const isPin = (v) => /^\d{4}$/.test(v);

function PinInput({ value, onChange, autoFocus }) {
  return (
    <input
      type="password"
      inputMode="numeric"
      autoComplete="off"
      autoFocus={autoFocus}
      maxLength={4}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
      placeholder="● ● ● ●"
      className="input py-3 text-center text-4xl font-bold tracking-[0.5em]"
    />
  );
}

/** 처음 1번: 교사 PIN 만들기 */
function SetupPin() {
  const { setupPin } = useAuth();
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!isPin(pin)) return setError('숫자 4자리를 입력해 주세요.');
    if (pin !== pin2) return setError('두 번 입력한 PIN이 서로 달라요.');
    setBusy(true);
    setError('');
    try {
      await setupPin(pin);
    } catch (err) {
      console.error(err);
      setError('PIN을 만들지 못했어요. 이미 다른 기기에서 PIN을 만들었다면 새로고침 후 PIN을 입력해 주세요.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-4 text-center">
      <div className="text-5xl">🔐</div>
      <h1 className="text-2xl font-bold">교사 PIN 만들기 (처음 1번)</h1>
      <p className="text-slate-500">
        교사 화면에 들어갈 때 쓸 <b>숫자 4자리</b>를 정해 주세요.
        <br />
        학생들이 모르는 번호로 정하고, 잊지 않도록 메모해 두세요.
      </p>
      <PinInput value={pin} onChange={setPin} autoFocus />
      <PinInput value={pin2} onChange={setPin2} />
      <p className="text-sm text-slate-400">확인을 위해 한 번 더 입력</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="btn-primary w-full py-3 text-lg" disabled={busy}>
        {busy ? '만드는 중...' : 'PIN 만들고 시작하기'}
      </button>
    </form>
  );
}

/** PIN 입력해서 교사 화면 열기 */
function UnlockPin() {
  const { unlock } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!isPin(pin)) return setError('숫자 4자리를 입력해 주세요.');
    setBusy(true);
    setError('');
    try {
      await unlock(pin);
    } catch (err) {
      console.error(err);
      setError('PIN이 맞지 않아요.');
      setPin('');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-4 text-center">
      <div className="text-5xl">🧑‍🏫</div>
      <h1 className="text-2xl font-bold">교사 PIN 입력</h1>
      <p className="text-slate-500">한 번 입력하면 이 기기에서는 [잠그기]를 누르기 전까지 다시 묻지 않아요.</p>
      <PinInput value={pin} onChange={setPin} autoFocus />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="btn-primary w-full py-3 text-lg" disabled={busy || pin.length !== 4}>
        {busy ? '확인 중...' : '교사 화면 열기'}
      </button>
    </form>
  );
}

function ChangePinModal({ open, onClose }) {
  const { changePin } = useAuth();
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [msg, setMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!isPin(pin)) return setMsg('숫자 4자리를 입력해 주세요.');
    if (pin !== pin2) return setMsg('두 번 입력한 PIN이 서로 달라요.');
    try {
      await changePin(pin);
      setMsg('PIN을 바꿨어요. 다른 기기에서 새로 들어올 때 새 PIN을 쓰세요.');
      setPin('');
      setPin2('');
    } catch (err) {
      console.error(err);
      setMsg('PIN을 바꾸지 못했어요.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="교사 PIN 바꾸기">
      <form onSubmit={submit} className="space-y-3">
        <PinInput value={pin} onChange={setPin} autoFocus />
        <PinInput value={pin2} onChange={setPin2} />
        <p className="text-sm text-slate-500">새 PIN을 두 번 입력해 주세요.</p>
        {msg && <p className="text-sm text-blue-700">{msg}</p>}
        <button type="submit" className="btn-primary w-full">
          바꾸기
        </button>
      </form>
    </Modal>
  );
}

export default function TeacherLayout() {
  const { loading, authError, isTeacher, pinReady, lock } = useAuth();
  const [changeOpen, setChangeOpen] = useState(false);

  if (authError) return <div className="mx-auto max-w-md p-6"><div className="card text-red-600">{authError}</div></div>;
  if (loading) return <Spinner />;

  if (!isTeacher) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
        <ConfigWarning />
        {pinReady ? <UnlockPin /> : <SetupPin />}
        <Link to="/" className="mt-6 text-center text-sm text-slate-500 underline">
          처음 화면으로
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/teacher" className="flex items-center gap-2 text-lg font-bold">
            <span className="text-2xl">🏃</span> 체육 팀 편성 도우미
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <button type="button" className="btn-secondary px-3 py-1.5 text-sm" onClick={() => setChangeOpen(true)}>
              PIN 바꾸기
            </button>
            <button
              type="button"
              className="btn-secondary px-3 py-1.5 text-sm"
              onClick={() => {
                if (window.confirm('이 기기의 교사 화면을 잠글까요? 다시 열 때 PIN이 필요해요.')) lock();
              }}
            >
              🔒 잠그기
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 sm:p-6">
        <ConfigWarning />
        <Outlet />
      </main>
      <ChangePinModal open={changeOpen} onClose={() => setChangeOpen(false)} />
    </div>
  );
}
