import { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Circle, Clock3, Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Task } from '../types';

type PlannerTab = 'tasks' | 'deep-dive';
type TaskPriority = 1 | 2 | 3;
type TimeboxKind = 'deep_work' | 'admin';

type Timebox = {
  id: string;
  taskId: string;
  date: string;
  startMinutes: number;
  durationMinutes: number;
  kind: TimeboxKind;
  titleOverride?: string;
};

type PlannerEditorState = {
  taskId: string;
  timeboxId: string | null;
};

interface PlannerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function minutesToTimeLabel(minutesFromMidnight: number) {
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${hh}:${mm}`;
}

function parseTimeInput(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function priorityColor(priority: TaskPriority) {
  if (priority === 1) return '#ef4444';
  if (priority === 2) return '#ff7a18';
  return '#22c55e';
}

function nowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

const DURATION_OPTIONS = [5, 10, 15, 30, 45, 60, 90];

export const PlannerDrawer = ({ isOpen, onClose }: PlannerDrawerProps) => {
  const { user } = useAuth();
  const [tab, setTab] = useState<PlannerTab>('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completedToday, setCompletedToday] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [taskDraft, setTaskDraft] = useState('');
  const [deepDiveDraft, setDeepDiveDraft] = useState('');
  const [deepDivePriority, setDeepDivePriority] = useState<TaskPriority>(2);
  const [deepDiveDuration, setDeepDiveDuration] = useState(30);
  const [timeboxes, setTimeboxes] = useState<Timebox[]>([]);
  const [showTimelineOnly, setShowTimelineOnly] = useState(false);
  const [timelineMenu, setTimelineMenu] = useState<{ x: number; y: number; timeboxId: string } | null>(null);
  const [unscheduledMenu, setUnscheduledMenu] = useState<{ x: number; y: number; taskId: string } | null>(null);
  const [editingItem, setEditingItem] = useState<PlannerEditorState | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editDuration, setEditDuration] = useState(30);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [timelineDropActive, setTimelineDropActive] = useState(false);
  const [showDeepDiveDurationPicker, setShowDeepDiveDurationPicker] = useState(false);
  const [showCompletedToday, setShowCompletedToday] = useState(true);

  const today = new Date();
  const todayKey = isoDate(today);
  const timeboxesKey = `calendar_timeboxes_${todayKey}`;

  const getDayRangeIso = (dateKey: string) => {
    const start = new Date(`${dateKey}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
    };
  };

  const loadTasks = async () => {
    if (!user || !isOpen) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('completed', false)
        .order('position', { ascending: true });
      if (error) throw error;
      setTasks((data || []) as Task[]);

      const { startIso, endIso } = getDayRangeIso(todayKey);
      const { data: completedData, error: completedError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('completed', true)
        .gte('completed_at', startIso)
        .lt('completed_at', endIso)
        .order('completed_at', { ascending: false });
      if (completedError) throw completedError;
      setCompletedToday((completedData || []) as Task[]);
    } catch (error) {
      console.error('Error loading planner tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteTask = async (taskId: string) => {
    const previousTasks = tasks;
    const previousCompleted = completedToday;
    const previousTimeboxes = timeboxes;
    setTasks(prev => prev.filter(task => task.id !== taskId));
    setCompletedToday(prev => prev.filter(task => task.id !== taskId));
    const nextTimeboxes = timeboxes.filter(tb => tb.taskId !== taskId);
    persistTimeboxes(nextTimeboxes);
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting planner task:', error);
      setTasks(previousTasks);
      setCompletedToday(previousCompleted);
      persistTimeboxes(previousTimeboxes);
    }
  };

  const renameTask = async (taskId: string, title: string) => {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    const previousTasks = tasks;
    setTasks(prev => prev.map(task => task.id === taskId ? { ...task, title: nextTitle } : task));
    try {
      const { error } = await supabase.from('tasks').update({ title: nextTitle }).eq('id', taskId);
      if (error) throw error;
    } catch (error) {
      console.error('Error renaming planner task:', error);
      setTasks(previousTasks);
    }
  };

  const updateTimebox = (timeboxId: string, updates: Partial<Timebox>) => {
    const next = timeboxes
      .map(tb => tb.id === timeboxId ? { ...tb, ...updates } : tb)
      .sort((a, b) => a.startMinutes - b.startMinutes);
    persistTimeboxes(next);
  };

  const openTimelineEditor = (tb: Timebox, task: Task) => {
    setEditingItem({ taskId: task.id, timeboxId: tb.id });
    setEditTitle(task.title);
    setEditStartTime(minutesToTimeLabel(tb.startMinutes));
    setEditDuration(tb.durationMinutes);
    setTimelineMenu(null);
    setUnscheduledMenu(null);
    setShowDeepDiveDurationPicker(false);
  };

  const openUnscheduledEditor = (task: Task) => {
    const suggestedStart = clamp(nowMinutes(), 8 * 60, 24 * 60 - deepDiveDuration);
    setEditingItem({ taskId: task.id, timeboxId: null });
    setEditTitle(task.title);
    setEditStartTime(minutesToTimeLabel(suggestedStart));
    setEditDuration(deepDiveDuration);
    setTimelineMenu(null);
    setUnscheduledMenu(null);
    setShowDeepDiveDurationPicker(false);
  };

  const saveTimelineEditor = async () => {
    if (!editingItem) return;
    const task = tasks.find(item => item.id === editingItem.taskId);
    if (!task) return;
    const parsed = parseTimeInput(editStartTime);
    const nextDuration = clamp(editDuration, 15, 180);
    const maxStart = 24 * 60 - nextDuration;
    const currentStart = editingItem.timeboxId
      ? (timeboxes.find(item => item.id === editingItem.timeboxId)?.startMinutes ?? clamp(nowMinutes(), 8 * 60, maxStart))
      : clamp(nowMinutes(), 8 * 60, maxStart);
    const nextStart = clamp(parsed ?? currentStart, 8 * 60, maxStart);
    await renameTask(task.id, editTitle);
    if (editingItem.timeboxId) {
      updateTimebox(editingItem.timeboxId, { startMinutes: nextStart, durationMinutes: nextDuration });
    } else {
      const next = [
        ...timeboxes,
        {
          id: crypto.randomUUID(),
          taskId: task.id,
          date: todayKey,
          startMinutes: nextStart,
          durationMinutes: nextDuration,
          kind: 'admin' as const,
        },
      ].sort((a, b) => a.startMinutes - b.startMinutes);
      persistTimeboxes(next);
    }
    setEditingItem(null);
    setTimelineDropActive(false);
  };

  const scheduleTaskForToday = (task: Task, options?: { openEditor?: boolean }) => {
    const existing = timeboxes.find(tb => tb.taskId === task.id);
    if (existing) {
      if (options?.openEditor) openTimelineEditor(existing, task);
      return;
    }
    const duration = deepDiveDuration;
    const defaultStart = clamp(nowMinutes(), 8 * 60, 24 * 60 - duration);
    if (options?.openEditor) {
      setEditingItem({ taskId: task.id, timeboxId: null });
      setEditTitle(task.title);
      setEditStartTime(minutesToTimeLabel(defaultStart));
      setEditDuration(duration);
      setTimelineDropActive(true);
      setTimelineMenu(null);
      setUnscheduledMenu(null);
      setShowDeepDiveDurationPicker(false);
      return;
    }
    const next = [
      ...timeboxes,
      {
        id: crypto.randomUUID(),
        taskId: task.id,
        date: todayKey,
        startMinutes: defaultStart,
        durationMinutes: duration,
        kind: 'admin' as const,
      },
    ].sort((a, b) => a.startMinutes - b.startMinutes);
    persistTimeboxes(next);
  };

  useEffect(() => {
    loadTasks();
  }, [user, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    try {
      const raw = localStorage.getItem(timeboxesKey);
      const parsed = raw ? (JSON.parse(raw) as Timebox[]) : [];
      setTimeboxes(Array.isArray(parsed) ? parsed : []);
    } catch {
      setTimeboxes([]);
    }
  }, [isOpen, timeboxesKey]);

  useEffect(() => {
    if (!isOpen) return;
    const onFocus = () => {
      loadTasks();
      try {
        const raw = localStorage.getItem(timeboxesKey);
        const parsed = raw ? (JSON.parse(raw) as Timebox[]) : [];
        setTimeboxes(Array.isArray(parsed) ? parsed : []);
      } catch {
        setTimeboxes([]);
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [isOpen, timeboxesKey]);

  useEffect(() => {
    if (!isOpen) return;
    const handleCloseMenus = () => {
      setTimelineMenu(null);
      setUnscheduledMenu(null);
      setShowDeepDiveDurationPicker(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTimelineMenu(null);
        setUnscheduledMenu(null);
        setEditingItem(null);
        setTimelineDropActive(false);
        setShowDeepDiveDurationPicker(false);
      }
    };
    window.addEventListener('mousedown', handleCloseMenus);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handleCloseMenus);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const persistTimeboxes = (next: Timebox[]) => {
    setTimeboxes(next);
    localStorage.setItem(timeboxesKey, JSON.stringify(next));
  };

  const addTask = async () => {
    if (!user) return;
    const title = taskDraft.trim();
    if (!title) return;
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          title,
          description: '',
          due_date: null,
          priority: 2,
          completed: false,
          in_progress: false,
          list: 'Inbox',
        })
        .select('*')
        .single();
      if (error) throw error;
      setTasks(prev => [data as Task, ...prev]);
      setTaskDraft('');
    } catch (error) {
      console.error('Error adding planner task:', error);
    }
  };

  const toggleComplete = async (taskId: string, completed: boolean) => {
    try {
      const nextCompleted = !completed;
      const completedAt = nextCompleted ? new Date().toISOString() : null;
      const { error } = await supabase
        .from('tasks')
        .update({ completed: nextCompleted, completed_at: completedAt })
        .eq('id', taskId);
      if (error) throw error;
      const task = tasks.find(item => item.id === taskId) ?? completedToday.find(item => item.id === taskId);
      if (nextCompleted) {
        setTasks(prev => prev.filter(item => item.id !== taskId));
        setTimeboxes(prev => prev.filter(tb => tb.taskId !== taskId));
        if (task) {
          setCompletedToday(prev => [{ ...task, completed: true, completed_at: completedAt }, ...prev.filter(item => item.id !== taskId)]);
        }
      } else {
        setCompletedToday(prev => prev.filter(item => item.id !== taskId));
      }
      loadTasks();
    } catch (error) {
      console.error('Error toggling planner task:', error);
    }
  };

  const addDeepDiveTask = async () => {
    if (!user) return;
    const title = deepDiveDraft.trim();
    if (!title) return;
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          title,
          description: '',
          due_date: null,
          priority: deepDivePriority,
          completed: false,
          in_progress: false,
          list: 'Inbox',
        })
        .select('*')
        .single();
      if (error) throw error;
      const created = data as Task;
      setTasks(prev => [created, ...prev]);
      const startMinutes = clamp(nowMinutes(), 8 * 60, 24 * 60 - deepDiveDuration);
      const next = [
        ...timeboxes,
        {
          id: crypto.randomUUID(),
          taskId: created.id,
          date: todayKey,
          startMinutes,
          durationMinutes: deepDiveDuration,
          kind: 'admin' as const,
        },
      ].sort((a, b) => a.startMinutes - b.startMinutes);
      persistTimeboxes(next);
      setDeepDiveDraft('');
    } catch (error) {
      console.error('Error adding deep dive task:', error);
    }
  };

  const todaysTimeboxes = useMemo(() => {
    return [...timeboxes]
      .sort((a, b) => a.startMinutes - b.startMinutes)
      .map(tb => ({ tb, task: tasks.find(task => task.id === tb.taskId) }))
      .filter(entry => entry.task);
  }, [tasks, timeboxes]);

  const unscheduledTasks = useMemo(() => {
    const scheduledIds = new Set(timeboxes.map(tb => tb.taskId));
    return tasks.filter(task => !task.due_date && !scheduledIds.has(task.id)).slice(0, 8);
  }, [tasks, timeboxes]);

  const completedTimeboxedCount = useMemo(() => {
    const scheduledIds = new Set(timeboxes.map(tb => tb.taskId));
    return completedToday.filter(task => scheduledIds.has(task.id)).length;
  }, [completedToday, timeboxes]);

  const renderCheckbox = (task: Task) => (
    <button onClick={() => toggleComplete(task.id, !!task.completed)} className="flex-shrink-0">
      {task.completed ? (
        <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
      ) : (
        <Circle className="w-4 h-4" style={{ color: 'var(--muted)' }} />
      )}
    </button>
  );

  const editingTask = editingItem ? tasks.find(task => task.id === editingItem.taskId) ?? null : null;

  if (!isOpen) return null;

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg-elev)', borderLeft: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('tasks')}
            className="px-3 py-1.5 rounded-lg text-xs"
            style={{
              color: tab === 'tasks' ? 'var(--accent)' : 'var(--muted)',
              background: tab === 'tasks' ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            Tasks
          </button>
          <button
            onClick={() => setTab('deep-dive')}
            className="px-3 py-1.5 rounded-lg text-xs"
            style={{
              color: tab === 'deep-dive' ? 'var(--accent)' : 'var(--muted)',
              background: tab === 'deep-dive' ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            Deep Dive
          </button>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg" style={{ color: 'var(--muted)' }}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4">
        {tab === 'tasks' ? (
          <>
            <div className="rounded-xl p-3" style={{ border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Quick Tasks</div>
              </div>
              <div className="flex gap-2">
                <input
                  value={taskDraft}
                  onChange={(e) => setTaskDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    addTask();
                  }}
                  placeholder="Add task"
                  className="flex-1 rounded-lg px-3 h-9 text-sm outline-none"
                  style={{ color: 'var(--text)', background: 'rgba(0,0,0,0.10)', border: '1px solid rgba(255,255,255,0.10)' }}
                />
                <button onClick={addTask} className="px-3 rounded-lg" style={{ background: 'var(--accent)', color: '#fff' }}>
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="rounded-xl p-3" style={{ border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <div className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
                {loading ? 'Loading…' : `${tasks.length} open tasks`}
              </div>
              <div className="flex flex-col gap-2">
                {tasks.slice(0, 20).map((task) => (
                  <div key={task.id} className="flex items-center gap-2 rounded-lg px-2 py-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    {renderCheckbox(task)}
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: priorityColor((task.priority ?? 2) as TaskPriority) }} />
                    <div className="text-sm truncate" style={{ color: 'var(--text)' }}>{task.title}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl p-3" style={{ border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Today</div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>{today.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short' })}</div>
                </div>
                <button
                  onClick={() => setShowTimelineOnly(v => !v)}
                  className="ml-auto px-2 py-1 rounded-lg text-[11px]"
                  style={{
                    color: showTimelineOnly ? 'var(--accent)' : 'var(--muted)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    background: showTimelineOnly ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                  }}
                >
                  {showTimelineOnly ? 'Show all' : 'Timeline only'}
                </button>
              </div>
              {!showTimelineOnly ? (
                <>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => setDeepDivePriority(1)}
                      className="px-2 rounded-lg text-xs"
                      style={{ color: deepDivePriority === 1 ? '#ef4444' : 'var(--muted)', border: '1px solid rgba(255,255,255,0.10)' }}
                    >P1</button>
                    <button
                      onClick={() => setDeepDivePriority(2)}
                      className="px-2 rounded-lg text-xs"
                      style={{ color: deepDivePriority === 2 ? '#ff7a18' : 'var(--muted)', border: '1px solid rgba(255,255,255,0.10)' }}
                    >P2</button>
                    <button
                      onClick={() => setDeepDivePriority(3)}
                      className="px-2 rounded-lg text-xs"
                      style={{ color: deepDivePriority === 3 ? '#22c55e' : 'var(--muted)', border: '1px solid rgba(255,255,255,0.10)' }}
                    >P3</button>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <input
                      value={deepDiveDraft}
                      onChange={(e) => setDeepDiveDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        addDeepDiveTask();
                      }}
                      placeholder="Add task for now"
                      className="flex-1 rounded-lg px-3 h-9 text-sm outline-none"
                      style={{ color: 'var(--text)', background: 'rgba(0,0,0,0.10)', border: '1px solid rgba(255,255,255,0.10)' }}
                    />
                    <button onClick={addDeepDiveTask} className="px-3 rounded-lg" style={{ background: 'var(--accent)', color: '#fff' }}>
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="relative flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeepDiveDurationPicker(v => !v);
                      }}
                      className="h-9 px-3 rounded-lg text-xs flex items-center gap-2"
                      style={{
                        color: 'var(--muted)',
                        border: '1px solid rgba(255,255,255,0.10)',
                        background: showDeepDiveDurationPicker ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                      }}
                    >
                      <Clock3 className="w-4 h-4" style={{ color: deepDiveDuration ? 'var(--accent)' : 'var(--muted)' }} />
                      <span>{deepDiveDuration}m</span>
                    </button>
                    <div className="ml-auto text-[11px]" style={{ color: 'var(--muted)' }}>
                      Starts at {minutesToTimeLabel(clamp(nowMinutes(), 8 * 60, 24 * 60 - deepDiveDuration))}
                    </div>
                    {showDeepDiveDurationPicker ? (
                      <div
                        className="absolute left-0 top-full mt-2 z-20 rounded-xl p-2 min-w-[220px]"
                        style={{
                          background: 'var(--bg-panel)',
                          border: '1px solid var(--border)',
                          boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <div className="grid grid-cols-3 gap-2">
                          {DURATION_OPTIONS.map((minutes) => (
                            <button
                              key={minutes}
                              onClick={() => {
                                setDeepDiveDuration(minutes);
                                setShowDeepDiveDurationPicker(false);
                              }}
                              className="px-2 py-2 rounded-lg text-xs"
                              style={{
                                color: deepDiveDuration === minutes ? 'var(--accent)' : 'var(--text)',
                                border: '1px solid rgba(255,255,255,0.10)',
                                background: deepDiveDuration === minutes ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'rgba(255,255,255,0.03)',
                              }}
                            >
                              {minutes}m
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>

            <div className="rounded-xl p-3" style={{ border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Clock3 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Today’s timeline</div>
              </div>
              <div
                className="flex flex-col gap-2 rounded-lg transition-colors"
                style={{
                  minHeight: 64,
                  border: timelineDropActive ? '1px dashed var(--accent)' : '1px dashed transparent',
                  background: timelineDropActive ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
                  padding: timelineDropActive ? 8 : 0,
                }}
                onDragOver={(e) => {
                  if (!draggedTaskId) return;
                  e.preventDefault();
                  setTimelineDropActive(true);
                }}
                onDragLeave={() => {
                  if (!draggedTaskId) return;
                  setTimelineDropActive(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const taskId = e.dataTransfer.getData('text/planner-task-id') || draggedTaskId;
                  const task = taskId ? tasks.find(item => item.id === taskId) : null;
                  if (task) scheduleTaskForToday(task, { openEditor: true });
                  setDraggedTaskId(null);
                }}
              >
                {todaysTimeboxes.length === 0 ? (
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>Nothing scheduled yet.</div>
                ) : (
                  todaysTimeboxes.map(({ tb, task }) => (
                    <div
                      key={tb.id}
                      className="rounded-lg px-3 py-2"
                      style={{ background: 'rgba(255,255,255,0.03)' }}
                      onContextMenu={(e) => {
                        if (!task) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setTimelineMenu({ x: e.clientX, y: e.clientY, timeboxId: tb.id });
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {task ? renderCheckbox(task) : null}
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: priorityColor(((task?.priority ?? 2) as TaskPriority)) }} />
                        <div className="text-sm truncate flex-1 min-w-0" style={{ color: 'var(--text)' }}>{tb.titleOverride || task?.title}</div>
                        <div className="ml-auto text-[11px]" style={{ color: 'var(--muted)' }}>
                          {minutesToTimeLabel(tb.startMinutes)} - {minutesToTimeLabel(tb.startMinutes + tb.durationMinutes)}
                        </div>
                      </div>
                    </div>
                    ))
                  )}
              </div>
            </div>

            {!showTimelineOnly ? (
              <div className="rounded-xl p-3" style={{ border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
                <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Unscheduled</div>
                <div className="flex flex-col gap-2">
                  {unscheduledTasks.length === 0 ? (
                    <div className="text-xs" style={{ color: 'var(--muted)' }}>Everything has a place.</div>
                  ) : (
                    unscheduledTasks.map(task => (
                      <div key={task.id} className="rounded-lg px-3 py-2 text-xs flex items-center gap-2" style={{ border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text)' }}>
                        <div
                          className="flex items-center gap-2 w-full"
                          draggable
                          onDragStart={(e) => {
                            setDraggedTaskId(task.id);
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/planner-task-id', task.id);
                          }}
                          onDragEnd={() => {
                            setDraggedTaskId(null);
                            setTimelineDropActive(false);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setUnscheduledMenu({ x: e.clientX, y: e.clientY, taskId: task.id });
                          }}
                        >
                          {renderCheckbox(task)}
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: priorityColor((task.priority ?? 2) as TaskPriority) }} />
                          <span className="truncate flex-1 min-w-0">{task.title}</span>
                          <span className="text-[10px]" style={{ color: 'var(--muted)' }}>Drag to timeline</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            <div className="rounded-xl p-3" style={{ border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <button
                onClick={() => setShowCompletedToday(v => !v)}
                className="w-full flex items-center justify-between gap-3 text-left"
              >
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Completed today</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                    {completedToday.length === 0
                      ? 'Finish a few tasks to see your day review here.'
                      : `Nice — you finished ${completedToday.length} task${completedToday.length === 1 ? '' : 's'} today`}
                  </div>
                </div>
                <div
                  className="px-2 py-1 rounded-lg text-[11px]"
                  style={{
                    color: completedToday.length > 0 ? '#22c55e' : 'var(--muted)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    background: completedToday.length > 0 ? 'rgba(34,197,94,0.08)' : 'transparent',
                  }}
                >
                  {showCompletedToday ? 'Hide' : `${completedToday.length} done`}
                </div>
              </button>

              {showCompletedToday ? (
                <div className="mt-3 flex flex-col gap-2">
                  {completedToday.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)' }}>
                        <div className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Total done</div>
                        <div className="text-base font-semibold" style={{ color: 'var(--text)' }}>{completedToday.length}</div>
                      </div>
                      <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Scheduled wins</div>
                        <div className="text-base font-semibold" style={{ color: 'var(--text)' }}>{completedTimeboxedCount}</div>
                      </div>
                    </div>
                  ) : null}

                  {completedToday.length === 0 ? (
                    <div className="text-xs" style={{ color: 'var(--muted)' }}>Completed tasks from today will appear here.</div>
                  ) : (
                    completedToday.map((task) => (
                      <div key={task.id} className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <button onClick={() => toggleComplete(task.id, true)} className="flex-shrink-0">
                          <CheckCircle2 className="w-4 h-4" style={{ color: '#22c55e' }} />
                        </button>
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: priorityColor((task.priority ?? 2) as TaskPriority) }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate" style={{ color: 'var(--text)' }}>{task.title}</div>
                          <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
                            {task.completed_at ? `Done at ${new Date(task.completed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'Completed today'}
                          </div>
                        </div>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="text-[11px] px-2 py-1 rounded-lg"
                          style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.22)' }}
                        >
                          Delete
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>

      {timelineMenu ? (() => {
        const tb = timeboxes.find(item => item.id === timelineMenu.timeboxId);
        const task = tb ? tasks.find(item => item.id === tb.taskId) : null;
        if (!tb || !task) return null;
        return (
          <div
            className="fixed rounded-lg shadow-2xl py-1 min-w-[180px]"
            style={{
              left: Math.min(timelineMenu.x, window.innerWidth - 200),
              top: Math.min(timelineMenu.y, window.innerHeight - 260),
              zIndex: 99999,
              background: 'var(--bg-panel)',
              border: '1px solid var(--border)',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => openTimelineEditor(tb, task)}
              className="w-full px-4 py-2 text-left text-sm transition-colors"
              style={{ color: 'var(--text)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elev)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Edit details
            </button>
            <button
              onClick={() => {
                updateTimebox(tb.id, { startMinutes: clamp(tb.startMinutes - 15, 8 * 60, 24 * 60 - tb.durationMinutes) });
                setTimelineMenu(null);
              }}
              className="w-full px-4 py-2 text-left text-sm transition-colors"
              style={{ color: 'var(--text)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elev)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Start 15 min earlier
            </button>
            <button
              onClick={() => {
                updateTimebox(tb.id, { startMinutes: clamp(tb.startMinutes + 15, 8 * 60, 24 * 60 - tb.durationMinutes) });
                setTimelineMenu(null);
              }}
              className="w-full px-4 py-2 text-left text-sm transition-colors"
              style={{ color: 'var(--text)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elev)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Start 15 min later
            </button>
            <button
              onClick={() => {
                updateTimebox(tb.id, { startMinutes: clamp(nowMinutes(), 8 * 60, 24 * 60 - tb.durationMinutes) });
                setTimelineMenu(null);
              }}
              className="w-full px-4 py-2 text-left text-sm transition-colors"
              style={{ color: 'var(--text)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elev)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Set to now
            </button>
            <div className="border-t my-1" style={{ borderColor: 'var(--border)' }} />
            {DURATION_OPTIONS.map((duration) => (
              <button
                key={duration}
                onClick={() => {
                  updateTimebox(tb.id, {
                    durationMinutes: duration,
                    startMinutes: clamp(tb.startMinutes, 8 * 60, 24 * 60 - duration),
                  });
                  setTimelineMenu(null);
                }}
                className="w-full px-4 py-2 text-left text-sm transition-colors"
                style={{ color: tb.durationMinutes === duration ? 'var(--accent)' : 'var(--text)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elev)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Set duration to {duration}m
              </button>
            ))}
            <div className="border-t my-1" style={{ borderColor: 'var(--border)' }} />
            <button
              onClick={() => {
                deleteTask(task.id);
                setTimelineMenu(null);
              }}
              className="w-full px-4 py-2 text-left text-sm transition-colors"
              style={{ color: '#ef4444' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elev)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Delete task
            </button>
          </div>
        );
      })() : null}

      {unscheduledMenu ? (() => {
        const task = tasks.find(item => item.id === unscheduledMenu.taskId);
        if (!task) return null;
        return (
          <div
            className="fixed rounded-lg shadow-2xl py-1 min-w-[190px]"
            style={{
              left: Math.min(unscheduledMenu.x, window.innerWidth - 210),
              top: Math.min(unscheduledMenu.y, window.innerHeight - 220),
              zIndex: 99999,
              background: 'var(--bg-panel)',
              border: '1px solid var(--border)',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => openUnscheduledEditor(task)}
              className="w-full px-4 py-2 text-left text-sm transition-colors"
              style={{ color: 'var(--text)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elev)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Edit details
            </button>
            <button
              onClick={() => scheduleTaskForToday(task, { openEditor: true })}
              className="w-full px-4 py-2 text-left text-sm transition-colors"
              style={{ color: 'var(--text)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elev)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Schedule on timeline
            </button>
            <button
              onClick={() => {
                deleteTask(task.id);
                setUnscheduledMenu(null);
              }}
              className="w-full px-4 py-2 text-left text-sm transition-colors"
              style={{ color: '#ef4444' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elev)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Delete task
            </button>
          </div>
        );
      })() : null}

      {editingTask ? (
        <div className="fixed inset-0 z-[99998] bg-black/40" onMouseDown={() => { setEditingItem(null); setTimelineDropActive(false); }}>
          <div
            className="absolute top-1/2 left-1/2 w-[320px] max-w-[92vw] rounded-xl p-4"
            style={{
              transform: 'translate(-50%, -50%)',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border)',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Edit timeline task</div>
            <div className="flex flex-col gap-3">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Task name"
                className="rounded-lg px-3 h-10 text-sm outline-none"
                style={{ color: 'var(--text)', background: 'rgba(0,0,0,0.10)', border: '1px solid rgba(255,255,255,0.10)' }}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  placeholder="HH:MM"
                  className="rounded-lg px-3 h-10 text-sm outline-none"
                  style={{ color: 'var(--text)', background: 'rgba(0,0,0,0.10)', border: '1px solid rgba(255,255,255,0.10)' }}
                />
                <div
                  className="rounded-lg px-3 min-h-10 flex items-center"
                  style={{ background: 'rgba(0,0,0,0.10)', border: '1px solid rgba(255,255,255,0.10)' }}
                >
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>{editDuration} min</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {DURATION_OPTIONS.map((duration) => (
                  <button
                    key={duration}
                    onClick={() => setEditDuration(duration)}
                    className="px-2 py-2 rounded-lg text-xs"
                    style={{
                      color: editDuration === duration ? 'var(--accent)' : 'var(--text)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      background: editDuration === duration ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    {duration}m
                  </button>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => { setEditingItem(null); setTimelineDropActive(false); }}
                  className="px-3 h-9 rounded-lg text-sm"
                  style={{ color: 'var(--muted)', border: '1px solid rgba(255,255,255,0.10)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveTimelineEditor}
                  className="px-3 h-9 rounded-lg text-sm"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
