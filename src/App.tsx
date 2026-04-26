import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { NewDashboard } from './pages/NewDashboard';
import { Settings } from './pages/Settings';
import { Tasks } from './pages/Tasks';
import { Calendar } from './pages/Calendar';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  // Apply saved theme and accent color on load
  useEffect(() => {
    const root = document.documentElement;
    
    // Apply theme
    const savedTheme = localStorage.getItem('theme') || 'default';
    root.classList.add(`theme-${savedTheme}`);
    
    // Apply accent color
    const savedAccent = localStorage.getItem('accentColor') || 'orange';
    root.classList.add(`accent-${savedAccent}`);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <NewDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks"
          element={
            <ProtectedRoute>
              <Tasks />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <Calendar />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
