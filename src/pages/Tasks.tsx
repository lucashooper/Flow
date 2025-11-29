import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, GripVertical, MoreVertical, Calendar, Trash2, Flag, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Task } from '../types';
import { AppLayout } from '../components/AppLayout';
import { useDashboardData } from '../hooks/useDashboardData';

type TaskPriority = 1 | 2 | 3 | null;

export const Tasks = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  
  // Use shared dashboard data hook
  const {
    notes,
    folders,
    dashboards,
    activeDashboard,
    loading,
    sidebarWidth,
    setSidebarWidth,
    handleNoteSelect: dashboardHandleNoteSelect,
    handleNoteCreate,
    handleNoteUpdate,
    handleNoteDelete,
    handleFolderCreate,
    handleFolderUpdate,
    handleFolderDelete,
    handleDashboardChange,
    handleDashboardsUpdate,
  } = useDashboardData();
  
  // Quick-add state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [quickAddPriority, setQuickAddPriority] = useState<TaskPriority>(null);
  const [quickAddDueDate, setQuickAddDueDate] = useState<string | null>(null);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showDateMenu, setShowDateMenu] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const priorityMenuRef = useRef<HTMLDivElement>(null);
  const dateMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (priorityMenuRef.current && !priorityMenuRef.current.contains(e.target as Node)) {
        setShowPriorityMenu(false);
      }
      if (dateMenuRef.current && !dateMenuRef.current.contains(e.target as Node)) {
        setShowDateMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('completed', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setTasksLoading(false);
    }
  };

  // Navigate to dashboard when clicking a note
  const handleNoteSelect = (noteId: string) => {
    dashboardHandleNoteSelect(noteId);
    navigate(`/dashboard?note=${noteId}`);
  };

  const addTask = async () => {
    if (!newTaskTitle.trim() || !user) return;

    const newTask = {
      user_id: user.id,
      title: newTaskTitle.trim(),
      description: null,
      due_date: quickAddDueDate,
      priority: quickAddPriority || 2,
      completed: false,
    };

    // Optimistic UI update
    const tempId = crypto.randomUUID();
    const optimisticTask: Task = {
      ...newTask,
      id: tempId,
      priority: (quickAddPriority || 2) as 1 | 2 | 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setTasks(prev => [optimisticTask, ...prev]);
    
    // Reset form
    setNewTaskTitle('');
    setQuickAddPriority(null);
    setQuickAddDueDate(null);
    setIsAddingTask(false);

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([newTask])
        .select()
        .single();

      if (error) throw error;
      setTasks(prev => prev.map(t => t.id === tempId ? data : t));
    } catch (error) {
      console.error('Error adding task:', error);
      setTasks(prev => prev.filter(t => t.id !== tempId));
    }
  };

  const toggleComplete = async (task: Task) => {
    setTasks(prev => prev.filter(t => t.id !== task.id));

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ completed: true })
        .eq('id', task.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating task:', error);
      fetchTasks();
    }
  };

  const deleteTask = async (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting task:', error);
      fetchTasks();
    }
  };

  const updateTaskPriority = async (taskId: string, priority: 1 | 2 | 3) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, priority } : t));

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ priority })
        .eq('id', taskId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating priority:', error);
      fetchTasks();
    }
  };

  const isToday = (date: string | null) => {
    if (!date) return false;
    const today = new Date().toISOString().split('T')[0];
    return date === today;
  };

  const isFuture = (date: string | null) => {
    if (!date) return false;
    const today = new Date().toISOString().split('T')[0];
    return date > today;
  };

  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };
  const getNextWeekDate = () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString().split('T')[0];
  };

  const todayTasks = tasks.filter(t => isToday(t.due_date));
  const upcomingTasks = tasks.filter(t => isFuture(t.due_date));
  const noDateTasks = tasks.filter(t => !t.due_date);

  const getPriorityColor = (priority: 1 | 2 | 3) => {
    switch (priority) {
      case 1: return '#ef4444';
      case 2: return '#ff7a18';
      case 3: return '#22c55e';
    }
  };

  const getPriorityLabel = (priority: TaskPriority) => {
    if (!priority) return 'Priority';
    switch (priority) {
      case 1: return 'P1';
      case 2: return 'P2';
      case 3: return 'P3';
    }
  };

  const getDateLabel = (date: string | null) => {
    if (!date) return 'Due date';
    const today = getTodayDate();
    const tomorrow = getTomorrowDate();
    if (date === today) return 'Today';
    if (date === tomorrow) return 'Tomorrow';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addTask();
    }
    if (e.key === 'Escape') {
      setIsAddingTask(false);
      setNewTaskTitle('');
      setQuickAddPriority(null);
      setQuickAddDueDate(null);
    }
  };

  return (
    <AppLayout
      notes={notes || []}
      folders={folders}
      dashboards={dashboards}
      activeDashboard={activeDashboard}
      sidebarWidth={sidebarWidth}
      setSidebarWidth={setSidebarWidth}
      onNoteSelect={handleNoteSelect}
      onNoteCreate={handleNoteCreate}
      onNoteUpdate={handleNoteUpdate}
      onNoteDelete={handleNoteDelete}
      onFolderCreate={handleFolderCreate}
      onFolderUpdate={handleFolderUpdate}
      onFolderDelete={handleFolderDelete}
      onDashboardChange={handleDashboardChange}
      onDashboardsUpdate={handleDashboardsUpdate}
      loading={loading}
      showHeader={false}
    >
      <div className="max-w-4xl mx-auto px-8 py-12 select-none">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-8 h-8 text-[#ff7a18]" />
            <h1 className="text-4xl font-bold">Tasks</h1>
          </div>
          <p className="text-[#888888]">Stay focused, get things done</p>
        </div>

        {/* Quick Add Task */}
        <div className="mb-12">
          {!isAddingTask ? (
            <button
              onClick={() => {
                setIsAddingTask(true);
                setTimeout(() => inputRef.current?.focus(), 0);
              }}
              className="w-full text-left bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-4 text-[#666666] hover:border-[#3a3a3a] transition-colors cursor-text"
            >
              + Add a new task...
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#1a1a1a] border border-[#ff7a18]/30 rounded-xl p-4 shadow-lg shadow-[#ff7a18]/10"
            >
              {/* Title Input */}
              <input
                ref={inputRef}
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Task name"
                className="w-full bg-transparent border-none outline-none text-[#e5e5e5] placeholder-[#666666] mb-3 text-base"
                style={{ userSelect: 'text', cursor: 'text' }}
              />

              {/* Metadata Row */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Due Date Chip */}
                <div className="relative" ref={dateMenuRef}>
                  <button
                    onClick={() => {
                      setShowDateMenu(!showDateMenu);
                      setShowPriorityMenu(false);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      quickAddDueDate
                        ? 'bg-[#ff7a18]/20 text-[#ff7a18] border border-[#ff7a18]/30'
                        : 'bg-[#2a2a2a] text-[#888888] border border-[#3a3a3a] hover:border-[#4a4a4a]'
                    }`}
                    style={{ cursor: 'pointer' }}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{getDateLabel(quickAddDueDate)}</span>
                    {quickAddDueDate && (
                      <X
                        className="w-3 h-3 ml-0.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuickAddDueDate(null);
                        }}
                      />
                    )}
                  </button>

                  {showDateMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute top-full left-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl py-1 z-10 min-w-[140px]"
                    >
                      <button
                        onClick={() => {
                          setQuickAddDueDate(getTodayDate());
                          setShowDateMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#2a2a2a] transition-colors"
                        style={{ cursor: 'pointer' }}
                      >
                        Today
                      </button>
                      <button
                        onClick={() => {
                          setQuickAddDueDate(getTomorrowDate());
                          setShowDateMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#2a2a2a] transition-colors"
                        style={{ cursor: 'pointer' }}
                      >
                        Tomorrow
                      </button>
                      <button
                        onClick={() => {
                          setQuickAddDueDate(getNextWeekDate());
                          setShowDateMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#2a2a2a] transition-colors"
                        style={{ cursor: 'pointer' }}
                      >
                        Next week
                      </button>
                    </motion.div>
                  )}
                </div>

                {/* Priority Chip */}
                <div className="relative" ref={priorityMenuRef}>
                  <button
                    onClick={() => {
                      setShowPriorityMenu(!showPriorityMenu);
                      setShowDateMenu(false);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      quickAddPriority
                        ? 'bg-[#ff7a18]/20 text-[#ff7a18] border border-[#ff7a18]/30'
                        : 'bg-[#2a2a2a] text-[#888888] border border-[#3a3a3a] hover:border-[#4a4a4a]'
                    }`}
                    style={{ cursor: 'pointer' }}
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>{getPriorityLabel(quickAddPriority)}</span>
                    {quickAddPriority && (
                      <X
                        className="w-3 h-3 ml-0.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuickAddPriority(null);
                        }}
                      />
                    )}
                  </button>

                  {showPriorityMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute top-full left-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl py-1 z-10 min-w-[140px]"
                    >
                      <button
                        onClick={() => {
                          setQuickAddPriority(1);
                          setShowPriorityMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="w-2 h-2 rounded-full bg-[#ef4444]" />
                        P1 (High)
                      </button>
                      <button
                        onClick={() => {
                          setQuickAddPriority(2);
                          setShowPriorityMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="w-2 h-2 rounded-full bg-[#ff7a18]" />
                        P2 (Medium)
                      </button>
                      <button
                        onClick={() => {
                          setQuickAddPriority(3);
                          setShowPriorityMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
                        P3 (Low)
                      </button>
                    </motion.div>
                  )}
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Action Buttons */}
                <button
                  onClick={() => {
                    setIsAddingTask(false);
                    setNewTaskTitle('');
                    setQuickAddPriority(null);
                    setQuickAddDueDate(null);
                  }}
                  className="px-3 py-1.5 text-sm text-[#888888] hover:text-[#e5e5e5] transition-colors"
                  style={{ cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={addTask}
                  disabled={!newTaskTitle.trim()}
                  className="px-4 py-1.5 bg-[#ff7a18] text-white rounded-lg text-sm font-medium hover:bg-[#ff8c3a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ cursor: newTaskTitle.trim() ? 'pointer' : 'not-allowed' }}
                >
                  Add task
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Today Section */}
        {todayTasks.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold mb-6 text-[#ff7a18]">Today</h2>
            <div className="space-y-2">
              <AnimatePresence>
                {todayTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggleComplete={toggleComplete}
                    onDelete={deleteTask}
                    onUpdatePriority={updateTaskPriority}
                    getPriorityColor={getPriorityColor}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Upcoming Section */}
        {upcomingTasks.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold mb-6">Upcoming</h2>
            <div className="space-y-2">
              <AnimatePresence>
                {upcomingTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggleComplete={toggleComplete}
                    onDelete={deleteTask}
                    onUpdatePriority={updateTaskPriority}
                    getPriorityColor={getPriorityColor}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Inbox Section */}
        {noDateTasks.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold mb-6">Inbox</h2>
            <div className="space-y-2">
              <AnimatePresence>
                {noDateTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggleComplete={toggleComplete}
                    onDelete={deleteTask}
                    onUpdatePriority={updateTaskPriority}
                    getPriorityColor={getPriorityColor}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Empty State */}
        {tasks.length === 0 && !tasksLoading && (
          <div className="text-center py-20">
            <CheckCircle className="w-16 h-16 text-[#2a2a2a] mx-auto mb-4" />
            <p className="text-[#888888] text-lg">No tasks yet. Add one above to get started!</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

interface TaskCardProps {
  task: Task;
  onToggleComplete: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onUpdatePriority: (taskId: string, priority: 1 | 2 | 3) => void;
  getPriorityColor: (priority: 1 | 2 | 3) => string;
}

const TaskCard = ({ task, onToggleComplete, onDelete, onUpdatePriority, getPriorityColor }: TaskCardProps) => {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      className="group relative bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 hover:border-[#3a3a3a] transition-colors"
      style={{ userSelect: 'none', cursor: 'default' }}
    >
      <div className="flex items-center gap-3">
        {/* Drag Handle */}
        <GripVertical className="w-4 h-4 text-[#666666] opacity-0 group-hover:opacity-100 transition-opacity" style={{ cursor: 'grab' }} />

        {/* Checkbox */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onToggleComplete(task)}
          className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-[#666666] hover:border-[#ff7a18] transition-colors flex items-center justify-center"
          style={{ cursor: 'pointer' }}
        />

        {/* Priority Dot */}
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: getPriorityColor(task.priority) }}
        />

        {/* Title */}
        <div className="flex-1 min-w-0">
          <p className="text-[#e5e5e5]">{task.title}</p>
        </div>

        {/* Due Date */}
        {task.due_date && (
          <div className="flex items-center gap-1 text-xs text-[#888888] bg-[#2a2a2a] px-2 py-1 rounded-lg">
            <Calendar className="w-3 h-3" />
            {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        )}

        {/* Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-[#2a2a2a] rounded transition-colors opacity-0 group-hover:opacity-100"
            style={{ cursor: 'pointer' }}
          >
            <MoreVertical className="w-4 h-4 text-[#888888]" />
          </button>

          {showMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute right-0 top-full mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl py-1 z-10 min-w-[160px]"
            >
              <button
                onClick={() => {
                  onUpdatePriority(task.id, 1);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                style={{ cursor: 'pointer' }}
              >
                <div className="w-2 h-2 rounded-full bg-[#ef4444]" />
                High Priority
              </button>
              <button
                onClick={() => {
                  onUpdatePriority(task.id, 2);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                style={{ cursor: 'pointer' }}
              >
                <div className="w-2 h-2 rounded-full bg-[#ff7a18]" />
                Medium Priority
              </button>
              <button
                onClick={() => {
                  onUpdatePriority(task.id, 3);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                style={{ cursor: 'pointer' }}
              >
                <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
                Low Priority
              </button>
              <div className="border-t border-[#2a2a2a] my-1" />
              <button
                onClick={() => {
                  onDelete(task.id);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-[#ef4444] hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                style={{ cursor: 'pointer' }}
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
