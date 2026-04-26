import { useEffect, useState, useRef } from 'react';
import { CheckCircle2, Circle, Plus, X, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Draggable from 'react-draggable';

interface Task {
  id: string;
  title: string;
  completed: boolean;
  completed_at?: string | null;
  priority: number;
  created_at: string;
}

interface FloatingTasksProps {
  isVisible: boolean;
  onClose: () => void;
}

export const FloatingTasks = ({ isVisible, onClose }: FloatingTasksProps) => {
  const nodeRef = useRef(null);
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('tasksExpanded');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [showCompleted, setShowCompleted] = useState(() => {
    const saved = localStorage.getItem('tasksShowCompleted');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isVisible && user) {
      loadTasks();
    }
  }, [isVisible, user]);

  const loadTasks = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const addTask = async () => {
    if (!newTaskTitle.trim() || !user) return;

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([
          {
            user_id: user.id,
            title: newTaskTitle.trim(),
            completed: false,
            priority: 2,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setTasks([data, ...tasks]);
        setNewTaskTitle('');
      }
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };

  const toggleTask = async (taskId: string, completed: boolean) => {
    try {
      const nextCompleted = !completed;
      const completedAt = nextCompleted ? new Date().toISOString() : null;
      const { error } = await supabase
        .from('tasks')
        .update({ completed: nextCompleted, completed_at: completedAt })
        .eq('id', taskId);

      if (error) throw error;
      setTasks(tasks.map(t => t.id === taskId ? { ...t, completed: nextCompleted, completed_at: completedAt } : t));
    } catch (error) {
      console.error('Error toggling task:', error);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      setTasks(tasks.filter(t => t.id !== taskId));
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const toggleExpanded = () => {
    const newValue = !isExpanded;
    setIsExpanded(newValue);
    localStorage.setItem('tasksExpanded', JSON.stringify(newValue));
  };

  const toggleShowCompleted = () => {
    const newValue = !showCompleted;
    setShowCompleted(newValue);
    localStorage.setItem('tasksShowCompleted', JSON.stringify(newValue));
  };

  if (!isVisible) return null;

  const incompleteTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  return (
    <Draggable handle=".drag-handle" bounds="parent" nodeRef={nodeRef}>
      <div ref={nodeRef} className="fixed bottom-6 left-6 z-[9999]">
        <div
          className="drag-handle relative rounded-2xl text-sm shadow-2xl transition-all cursor-move"
        style={{
          backdropFilter: 'blur(16px)',
          background:
            'radial-gradient(circle at top left, rgba(167, 139, 250, 0.18), transparent 55%), rgba(12,12,15,0.94)',
          border: '1px solid rgba(248, 250, 252, 0.12)',
          boxShadow:
            '0 18px 45px rgba(0,0,0,0.85), 0 0 0 1px rgba(248,250,252,0.04)',
          width: isExpanded ? '320px' : 'auto',
          maxHeight: isExpanded ? '500px' : 'auto',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-3"
          style={{ borderBottom: isExpanded ? '1px solid rgba(248, 250, 252, 0.08)' : 'none' }}
        >
          <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={toggleExpanded}>
            <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <span className="font-semibold text-white">Tasks</span>
            <span className="text-xs text-gray-400">
              {incompleteTasks.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {isExpanded && completedTasks.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleShowCompleted();
                }}
                className="p-1 hover:bg-white/10 rounded transition-colors text-xs text-gray-400"
                title={showCompleted ? 'Hide completed' : 'Show completed'}
              >
                {showCompleted ? '👁️' : '👁️‍🗨️'}
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1 hover:bg-white/10 rounded transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="flex flex-col max-h-[420px]">
            {/* Add Task Input */}
            <div className="p-3" style={{ borderBottom: '1px solid rgba(248, 250, 252, 0.08)' }}>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTask();
                    }
                  }}
                  placeholder="Add a task..."
                  className="flex-1 px-3 py-1.5 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none transition-colors"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(248, 250, 252, 0.1)',
                  }}
                />
                <button
                  onClick={addTask}
                  disabled={!newTaskTitle.trim()}
                  className="p-1.5 rounded-lg transition-all disabled:opacity-40"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: '#fff',
                  }}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tasks List */}
            <div className="overflow-y-auto custom-scrollbar flex-1 p-3">
              {loading ? (
                <div className="text-center text-gray-400 text-xs py-4">Loading...</div>
              ) : tasks.length === 0 ? (
                <div className="text-center text-gray-400 text-xs py-4">
                  No tasks yet. Add one above!
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Incomplete Tasks */}
                  {incompleteTasks.map((task) => (
                    <div
                      key={task.id}
                      className="group flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <button
                        onClick={() => toggleTask(task.id, task.completed)}
                        className="flex-shrink-0"
                      >
                        <Circle className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                      </button>
                      <span className="flex-1 text-sm text-white truncate">
                        {task.title}
                      </span>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                      >
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  ))}

                  {/* Completed Tasks */}
                  {showCompleted && completedTasks.length > 0 && (
                    <>
                      {incompleteTasks.length > 0 && (
                        <div className="h-px bg-white/10 my-2" />
                      )}
                      {completedTasks.map((task) => (
                        <div
                          key={task.id}
                          className="group flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors opacity-60"
                        >
                          <button
                            onClick={() => toggleTask(task.id, task.completed)}
                            className="flex-shrink-0"
                          >
                            <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                          </button>
                          <span className="flex-1 text-sm text-gray-400 line-through truncate">
                            {task.title}
                          </span>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                          >
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
    </Draggable>
  );
};
