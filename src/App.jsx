import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Dashboard from './pages/teacher/Dashboard.jsx';
import NewRoom from './pages/teacher/NewRoom.jsx';
import LiveRoom from './pages/teacher/LiveRoom.jsx';
import TeamBuilder from './pages/teacher/TeamBuilder.jsx';
import JoinRoom from './pages/student/JoinRoom.jsx';
import StudentRoom from './pages/student/StudentRoom.jsx';
import TeacherLayout from './components/TeacherLayout.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />

      {/* 교사 화면 (Google 로그인 필요) */}
      <Route path="/teacher" element={<TeacherLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="new" element={<NewRoom />} />
        <Route path="room/:pin" element={<LiveRoom />} />
        <Route path="teams/:evalId" element={<TeamBuilder />} />
      </Route>

      {/* 학생 화면 (익명 자동 로그인) */}
      <Route path="/join" element={<JoinRoom />} />
      <Route path="/join/:pin" element={<StudentRoom />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
