import { useState, useEffect, useRef } from 'react';
import { TrendingUp, CheckCircle2, Clock, Target } from 'lucide-react';
import Draggable from 'react-draggable';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface FocusStatsProps {
  isVisible: boolean;
  onClose: () => void;
}

export const FocusStats = ({ isVisible, onClose }: FocusStatsProps) => {
  const nodeRef = useRef(null);
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('statsExpanded');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [todayTasks, setTodayTasks] = useState(0);
  const [weekMinutes, setWeekMinutes] = useState(0);
  const [sessionsCount, setSessionsCount] = useState(0);

  useEffect(() => {
    if (isVisible && user) {
      loadStats();
    }
  }, [isVisible, user]);

  // Listen for pomodoro completions
  useEffect(() => {
    const handlePomodoroComplete = () => {
      loadStats();
    };
    window.addEventListener('pomodoroCompleted', handlePomodoroComplete);
    return () => window.removeEventListener('pomodoroCompleted', handlePomodoroComplete);
  }, [user]);

  const loadStats = async () => {
    if (!user) return;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Get focus sessions from cards table
      const { data: sessions, error } = await supabase
        .from('cards')
        .select('minutes, created_at')
        .eq('user_id', user.id)
        .gte('created_at', weekAgo.toISOString());

      if (error) throw error;

      if (sessions) {
        const todaySessions = sessions.filter(s => 
          new Date(s.created_at) >= today
        );
        
        setTodayMinutes(todaySessions.reduce((sum, s) => sum + (s.minutes || 0), 0));
        setWeekMinutes(sessions.reduce((sum, s) => sum + (s.minutes || 0), 0));
        setSessionsCount(todaySessions.length);
      }

      // Get completed tasks today
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id')
        .eq('user_id', user.id)
        .eq('completed', true)
        .gte('updated_at', today.toISOString());

      if (tasksError) throw tasksError;
      setTodayTasks(tasks?.length || 0);
    } catch (error) {
      console.error('Error loading focus stats:', error);
    }
  };

  const toggleExpanded = () => {
    const newValue = !isExpanded;
    setIsExpanded(newValue);
    localStorage.setItem('statsExpanded', JSON.stringify(newValue));
  };

  if (!isVisible) return null;

  return (
    <Draggable handle=".drag-handle" bounds="parent" nodeRef={nodeRef}>
      <div ref={nodeRef} className="fixed top-6 right-6 z-[9999]">
        <div
          className="drag-handle relative rounded-2xl text-sm shadow-2xl transition-all cursor-move"
          style={{
            backdropFilter: 'blur(16px)',
            background:
              'radial-gradient(circle at top left, rgba(34, 197, 94, 0.18), transparent 55%), rgba(12,12,15,0.94)',
            border: '1px solid rgba(248, 250, 252, 0.12)',
            boxShadow:
              '0 18px 45px rgba(0,0,0,0.85), 0 0 0 1px rgba(248,250,252,0.04)',
            width: isExpanded ? '280px' : 'auto',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between p-3 cursor-pointer"
            onClick={toggleExpanded}
            style={{ borderBottom: isExpanded ? '1px solid rgba(248, 250, 252, 0.08)' : 'none' }}
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="font-semibold text-white">Focus Stats</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1 hover:bg-white/10 rounded transition-colors"
            >
              ×
            </button>
          </div>

          {/* Expanded Content */}
          {isExpanded && (
            <div className="p-3 space-y-3">
              {/* Today's Stats */}
              <div className="space-y-2">
                <div className="text-xs text-gray-400 font-medium">Today</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-3 h-3 text-orange-400" />
                      <span className="text-xs text-gray-400">Focus Time</span>
                    </div>
                    <div className="text-lg font-bold text-white">
                      {todayMinutes}<span className="text-sm text-gray-400">m</span>
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-3 h-3 text-green-400" />
                      <span className="text-xs text-gray-400">Tasks Done</span>
                    </div>
                    <div className="text-lg font-bold text-white">{todayTasks}</div>
                  </div>
                </div>
              </div>

              {/* Week Stats */}
              <div className="space-y-2 pt-2" style={{ borderTop: '1px solid rgba(248, 250, 252, 0.08)' }}>
                <div className="text-xs text-gray-400 font-medium">This Week</div>
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Target className="w-3 h-3 text-purple-400" />
                      <span className="text-xs text-gray-400">Total Focus</span>
                    </div>
                    <span className="text-xs text-gray-400">{sessionsCount} sessions</span>
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {Math.floor(weekMinutes / 60)}h {weekMinutes % 60}m
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Draggable>
  );
};
