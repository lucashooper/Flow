import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from '@dnd-kit/core';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, CheckCircle, ArrowLeft, Clock3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Task } from '../types';
import { AppLayout } from '../components/AppLayout';
import { useDashboardData } from '../hooks/useDashboardData';
import { SettingsModal } from '../components/SettingsModal';

type TaskPriority = 1 | 2 | 3;

function startOfWeekMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function TimeSlot({
  date,
  startMinutes,
  height,
  onClick,
}: {
  date: string;
  startMinutes: number;
  height: number;
  onClick?: (e: React.MouseEvent, date: string, startMinutes: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${date}-${startMinutes}`,
    data: { type: 'slot', date, startMinutes },
  });

  return (
    <div
      ref={setNodeRef}
      onClick={(e) => onClick?.(e, date, startMinutes)}
      style={{
        height,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: isOver ? 'color-mix(in srgb, var(--accent) 7%, transparent)' : 'transparent',
      }}
    />
  );
}

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

function DraggableTimeboxBlock({
  timebox,
  task,
  pxPer15,
  dayStartMinutes,
  onContextMenu,
  onResizeStart,
}: {
  timebox: Timebox;
  task: Task | undefined;
  pxPer15: number;
  dayStartMinutes: number;
  onContextMenu: (e: React.MouseEvent, timeboxId: string) => void;
  onResizeStart: (e: React.PointerEvent, timeboxId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `tb-${timebox.id}`,
    data: { type: 'timebox', timeboxId: timebox.id },
  });

  const top = ((timebox.startMinutes - dayStartMinutes) / 15) * pxPer15;
  const height = (timebox.durationMinutes / 15) * pxPer15;

  const start = minutesToTimeLabel(timebox.startMinutes);
  const end = minutesToTimeLabel(timebox.startMinutes + timebox.durationMinutes);

  const isDeep = timebox.kind === 'deep_work';
  const title = timebox.titleOverride || task?.title || 'Task';
  const dotColor = priorityColor((task?.priority ?? 2) as TaskPriority);
  const compact = timebox.durationMinutes <= 15;
  const short = timebox.durationMinutes <= 30;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onContextMenu={(e) => onContextMenu(e, timebox.id)}
      className="absolute left-[72px] right-3 rounded-xl px-3 py-2 text-xs flex flex-col gap-1 group"
      style={{
        top,
        height,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.7 : 1,
        cursor: 'grab',
        userSelect: 'none',
        touchAction: 'none',
        overflow: 'hidden',
        background: isDeep
          ? 'color-mix(in srgb, var(--accent) 14%, rgba(0,0,0,0.1))'
          : 'rgba(255,255,255,0.04)',
        border: isDeep
          ? '1px solid color-mix(in srgb, var(--accent) 55%, transparent)'
          : '1px solid rgba(255,255,255,0.10)',
        boxShadow: isDeep
          ? '0 10px 30px rgba(0,0,0,0.35)'
          : '0 8px 24px rgba(0,0,0,0.28)',
      }}
      title={title}
    >
      {compact ? (
        <div className="flex items-center gap-2 h-full">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
          <div
            className="font-semibold"
            style={{
              color: 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </div>
        </div>
      ) : short ? (
        <div className="flex items-center justify-between gap-2 h-full min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
            <div
              className="font-semibold min-w-0"
              style={{
                color: 'var(--text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </div>
          </div>
          <div
            className="text-[10px] flex-shrink-0"
            style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}
          >
            {start} - {end}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
              <div
                className="font-semibold"
                style={{
                  color: 'var(--text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {title}
              </div>
            </div>
            <div className="text-[10px]" style={{ color: 'var(--muted)' }}>
              {timebox.durationMinutes}m
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div style={{ color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {start} – {end}
            </div>
            <div
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                color: isDeep ? 'var(--accent)' : 'var(--muted)',
                border: isDeep
                  ? '1px solid color-mix(in srgb, var(--accent) 40%, transparent)'
                  : '1px solid rgba(255,255,255,0.10)',
                background: isDeep
                  ? 'color-mix(in srgb, var(--accent) 10%, transparent)'
                  : 'transparent',
              }}
            >
              {isDeep ? 'Focus' : 'Light'}
            </div>
          </div>
        </>
      )}

      <div
        onPointerDown={(e) => onResizeStart(e, timebox.id)}
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          borderBottomLeftRadius: 12,
          borderBottomRightRadius: 12,
          background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.08))',
        }}
      />
    </div>
  );
}

function isoDate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(d: Date, days: number) {
  const n = new Date(d);
  n.setDate(n.getDate() + days);
  return n;
}

function formatDayLabel(d: Date) {
  return d.toLocaleDateString('en-GB', { weekday: 'short' });
}

function formatDayNumber(d: Date) {
  return d.toLocaleDateString('en-GB', { day: '2-digit' });
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

function localNowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function snapTo15(minutesFromMidnight: number) {
  return Math.round(minutesFromMidnight / 15) * 15;
}

function priorityColor(priority: TaskPriority) {
  switch (priority) {
    case 1:
      return '#ef4444';
    case 2:
      return '#ff7a18';
    case 3:
      return '#22c55e';
    default:
      return 'var(--muted)';
  }
}

function DraggableTaskPill({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { type: 'task', task },
  });

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.6 : 1,
    cursor: 'grab',
    userSelect: 'none',
    touchAction: 'none',
    border: '1px solid var(--border)',
    background: 'var(--bg-elev)',
    backdropFilter: 'blur(16px)',
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="rounded-xl px-3 py-2 text-sm flex items-center gap-2"
      style={style}
      title={task.title}
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: priorityColor(task.priority as TaskPriority) }}
      />
      <span className="truncate" style={{ color: 'var(--text)' }}>
        {task.title}
      </span>
    </div>
  );
}

function UnscheduledDropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'unscheduled',
    data: { type: 'unscheduled' },
  });

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col gap-2"
      style={{
        borderRadius: 16,
        padding: 8,
        border: isOver ? '1px solid var(--accent)' : '1px solid transparent',
        background: isOver ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
      }}
    >
      {children}
    </div>
  );
}

function DayDropZone({
  date,
  title,
  isToday,
  onOpen,
  children,
}: {
  date: string;
  title: string;
  isToday: boolean;
  onOpen?: (date: string) => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${date}`,
    data: { type: 'day', date },
  });

  return (
    <div
      ref={setNodeRef}
      className="rounded-2xl p-3 min-h-[240px] flex flex-col gap-3"
      style={{
        background: 'var(--bg-panel)',
        border: isOver ? '1px solid var(--accent)' : '1px solid var(--border)',
        boxShadow: isToday ? '0 0 0 1px rgba(79,195,247,0.25), 0 16px 40px rgba(0,0,0,0.25)' : '0 10px 30px rgba(0,0,0,0.2)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            {title}
          </div>
          {isToday && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                color: 'var(--accent)',
                border: '1px solid color-mix(in srgb, var(--accent) 45%, transparent)',
                background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
              }}
            >
              Today
            </span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen?.(date);
          }}
          className="text-[10px] px-2 py-0.5 rounded-lg"
          style={{
            color: 'var(--muted)',
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'rgba(0,0,0,0.10)',
          }}
        >
          Timebox
        </button>
      </div>
      {isToday && typeof window !== 'undefined' && (() => {
        try {
          const raw = localStorage.getItem(`calendar_intentions_${date}`);
          if (!raw) return false;
          const parsed = JSON.parse(raw) as string[];
          const items = (Array.isArray(parsed) ? parsed : [])
            .map(s => String(s || '').trim())
            .filter(Boolean);
          return items.length > 0;
        } catch {
          return false;
        }
      })() && (
        <div
          className="text-xs rounded-xl px-3 py-2"
          style={{
            border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
            background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
            color: 'var(--text)',
          }}
          title="Today's intentions"
        >
          {(() => {
            try {
              const raw = localStorage.getItem(`calendar_intentions_${date}`);
              if (!raw) return null;
              const parsed = JSON.parse(raw) as string[];
              const items = (Array.isArray(parsed) ? parsed : [])
                .map(s => String(s || '').trim())
                .filter(Boolean)
                .slice(0, 3);
              if (items.length === 0) return null;
              return (
                <div className="flex flex-col gap-2">
                  <div className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                    Intentions
                  </div>
                  <ul className="pl-4" style={{ listStyleType: 'disc' }}>
                    {items.map((it, idx) => (
                      <li key={idx} className="truncate">
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            } catch {
              return null;
            }
          })()}
        </div>
      )}
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

export const Calendar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [intentionJustSubmitted, setIntentionJustSubmitted] = useState(false);
  const [intentionDraft, setIntentionDraft] = useState('');
  const [intentions, setIntentions] = useState<string[]>([]);
  const [deepDiveDayKey, setDeepDiveDayKey] = useState<string | null>(null);
  const [deepDiveZen, setDeepDiveZen] = useState(false);
  const [timeboxes, setTimeboxes] = useState<Timebox[]>([]);
  const timeboxesKey = deepDiveDayKey ? `calendar_timeboxes_${deepDiveDayKey}` : null;
  const [deepDiveTitle, setDeepDiveTitle] = useState('');
  const timelineRef = useRef<HTMLDivElement>(null);

  const [slotComposer, setSlotComposer] = useState<{
    x: number;
    y: number;
    date: string;
    startMinutes: number;
  } | null>(null);
  const [slotDraft, setSlotDraft] = useState('');
  const [slotDuration, setSlotDuration] = useState<number>(30);
  const [slotStartTimeInput, setSlotStartTimeInput] = useState('');

  const [showTodayOnly, setShowTodayOnly] = useState(false);

  const [deepDiveTaskDraft, setDeepDiveTaskDraft] = useState('');
  const [deepDiveTaskPriority, setDeepDiveTaskPriority] = useState<TaskPriority>(2);
  const [deepDivePriorityMenu, setDeepDivePriorityMenu] = useState<{ x: number; y: number } | null>(null);
  const [deepDiveDurationMenu, setDeepDiveDurationMenu] = useState<{ x: number; y: number } | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    timeboxId: string;
  } | null>(null);

  const [resizing, setResizing] = useState<{
    timeboxId: string;
    startY: number;
    startDuration: number;
  } | null>(null);

  const DAY_START_MINUTES = 8 * 60;
  const DAY_END_MINUTES = 24 * 60;
  const SLOT_MINUTES = 15;
  const DEFAULT_DURATION = 30;
  const PX_PER_15 = 20;

  const slots = useMemo(() => {
    if (!deepDiveDayKey) return [] as number[];
    const res: number[] = [];
    for (let m = DAY_START_MINUTES; m < DAY_END_MINUTES; m += SLOT_MINUTES) res.push(m);
    return res;
  }, [deepDiveDayKey]);

  const timeboxesById = useMemo(() => {
    const map = new Map<string, Timebox>();
    for (const tb of timeboxes) map.set(tb.id, tb);
    return map;
  }, [timeboxes]);

  const {
    notes,
    folders,
    dashboards,
    activeDashboard,
    loading,
    sidebarWidth,
    setSidebarWidth,
    openNotes,
    tabsEnabled,
    handleNoteSelect: dashboardHandleNoteSelect,
    handleNoteCreate,
    handleNoteUpdate,
    handleNoteDelete,
    handleFolderCreate,
    handleFolderUpdate,
    handleFolderDelete,
    handleDashboardChange,
    handleDashboardsUpdate,
    handleTabClose,
  } = useDashboardData();

  useEffect(() => {
    const handleOpenSettings = () => {
      setIsSettingsOpen(true);
    };
    window.addEventListener('openSettings', handleOpenSettings);
    return () => window.removeEventListener('openSettings', handleOpenSettings);
  }, []);

  useEffect(() => {
    if (!slotComposer) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!slotComposer) return;
      if (e.key === 'Enter') {
        if (!slotDraft.trim()) return;
        const parsedStart = parseTimeInput(slotStartTimeInput);
        if (parsedStart === null) return;
        e.preventDefault();
        createTaskAndTimebox({
          title: slotDraft,
          date: slotComposer.date,
          startMinutes: parsedStart,
          durationMinutes: slotDuration,
        });
        setSlotComposer(null);
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [slotComposer, slotDraft, slotDuration, slotStartTimeInput]);

  const handleNoteSelect = (noteId: string) => {
    dashboardHandleNoteSelect(noteId);
    navigate(`/dashboard?note=${noteId}`);
  };

  const fetchTasks = async () => {
    if (!user) return;
    setTasksLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('completed', false)
        .order('position', { ascending: true });

      if (error) throw error;
      setTasks(data || []);

      const { data: completedData, error: completedError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('completed', true)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false });

      if (completedError) throw completedError;
      setCompletedTasks(completedData || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setTasksLoading(false);
    }
  };

  const createTaskAndTimebox = async ({
    title,
    date,
    startMinutes,
    durationMinutes,
    priority = 2,
  }: {
    title: string;
    date: string;
    startMinutes: number;
    durationMinutes: number;
    priority?: TaskPriority;
  }) => {
    if (!user) return;

    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          title: cleanTitle,
          description: '',
          due_date: null,
          priority,
          completed: false,
          in_progress: false,
          list: 'Inbox',
        })
        .select('*')
        .single();

      if (error) throw error;

      const created = data as Task;
      setTasks(prev => [created, ...prev]);

      const newTb: Timebox = {
        id: crypto.randomUUID(),
        taskId: created.id,
        date,
        startMinutes: clamp(Math.round(startMinutes), DAY_START_MINUTES, DAY_END_MINUTES - durationMinutes),
        durationMinutes,
        kind: 'admin',
      };
      setDeepDiveDayKey(date);
      setTimeboxes(prev => [...prev, newTb]);
    } catch (e) {
      console.error('Error creating task:', e);
      fetchTasks();
    }
  };

  const resolveQuickAddStartMinutes = (date: string, durationMinutes: number) => {
    const target = new Date(`${date}T00:00:00`);
    const now = new Date();
    const isSameLocalDay =
      target.getFullYear() === now.getFullYear() &&
      target.getMonth() === now.getMonth() &&
      target.getDate() === now.getDate();

    if (isSameLocalDay) {
      return clamp(localNowMinutes(), DAY_START_MINUTES, DAY_END_MINUTES - durationMinutes);
    }

    return DAY_START_MINUTES;
  };

  useEffect(() => {
    if (user) fetchTasks();
  }, [user]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      return {
        date: d,
        key: isoDate(d),
        label: `${formatDayLabel(d)} ${formatDayNumber(d)}`,
      };
    });
  }, [weekStart]);

  const todayKey = isoDate(new Date());

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const day of days) map.set(day.key, []);

    for (const t of tasks) {
      if (!t.due_date) continue;
      const key = t.due_date.split('T')[0];
      if (!map.has(key)) continue;
      map.get(key)!.push(t);
    }

    for (const [k, arr] of map) {
      arr.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      map.set(k, arr);
    }

    return map;
  }, [tasks, days]);

  const unscheduledTasks = useMemo(() => {
    return tasks.filter(t => !t.due_date);
  }, [tasks]);

  const completedTasksForDeepDiveDay = useMemo(() => {
    if (!deepDiveDayKey) return [] as Task[];
    return completedTasks.filter((task) => {
      if (!task.completed_at) return false;
      return isoDate(new Date(task.completed_at)) === deepDiveDayKey;
    });
  }, [completedTasks, deepDiveDayKey]);

  const deleteCompletedTask = async (taskId: string) => {
    const previousCompletedTasks = completedTasks;
    setCompletedTasks(prev => prev.filter(task => task.id !== taskId));
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting completed task:', error);
      setCompletedTasks(previousCompletedTasks);
    }
  };

  const intentionsKey = `calendar_intentions_${todayKey}`;
  const [intention, setIntention] = useState(() => {
    return localStorage.getItem(`calendar_intention_${todayKey}`) || '';
  });

  useEffect(() => {
    setIntentions(() => {
      try {
        const raw = localStorage.getItem(intentionsKey);
        if (raw) {
          const parsed = JSON.parse(raw) as string[];
          return (Array.isArray(parsed) ? parsed : []).map(s => String(s || '').trim()).filter(Boolean);
        }
      } catch {
        // ignore
      }
      const legacy = (localStorage.getItem(`calendar_intention_${todayKey}`) || '').trim();
      return legacy ? [legacy] : [];
    });
  }, [intentionsKey, todayKey]);

  useEffect(() => {
    if (!deepDiveDayKey) return;
    const d = new Date(`${deepDiveDayKey}T00:00:00`);
    const label = d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short' });
    setDeepDiveTitle(label);
  }, [deepDiveDayKey]);

  useEffect(() => {
    if (!timeboxesKey) return;
    try {
      const raw = localStorage.getItem(timeboxesKey);
      const parsed = raw ? (JSON.parse(raw) as Timebox[]) : [];
      setTimeboxes(Array.isArray(parsed) ? parsed : []);
    } catch {
      setTimeboxes([]);
    }
  }, [timeboxesKey]);

  useEffect(() => {
    if (!timeboxesKey) return;
    localStorage.setItem(timeboxesKey, JSON.stringify(timeboxes));
  }, [timeboxesKey, timeboxes]);

  useEffect(() => {
    localStorage.setItem(`calendar_intention_${todayKey}`, intention);
  }, [todayKey, intention]);

  useEffect(() => {
    localStorage.setItem(intentionsKey, JSON.stringify(intentions));
  }, [intentionsKey, intentions]);

  useEffect(() => {
    if (!deepDiveDayKey) {
      setDeepDiveZen(false);
    }
  }, [deepDiveDayKey]);

  useEffect(() => {
    const onMouseDown = () => {
      setContextMenu(null);
      setSlotComposer(null);
      setDeepDivePriorityMenu(null);
      setDeepDiveDurationMenu(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setSlotComposer(null);
        setDeepDivePriorityMenu(null);
        setDeepDiveDurationMenu(null);
      }
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!resizing) return;
    const handleMove = (e: PointerEvent) => {
      const deltaY = e.clientY - resizing.startY;
      const steps = Math.round(deltaY / PX_PER_15);
      const nextDuration = clamp(resizing.startDuration + steps * SLOT_MINUTES, SLOT_MINUTES, DAY_END_MINUTES - DAY_START_MINUTES);
      setTimeboxes(prev => prev.map(tb => (tb.id === resizing.timeboxId ? { ...tb, durationMinutes: nextDuration } : tb)));
    };
    const handleUp = () => setResizing(null);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [resizing, DAY_END_MINUTES, DAY_START_MINUTES, PX_PER_15, SLOT_MINUTES]);

  useEffect(() => {
    if (!intentionJustSubmitted) return;
    const t = window.setTimeout(() => setIntentionJustSubmitted(false), 1200);
    return () => window.clearTimeout(t);
  }, [intentionJustSubmitted]);

  const setTaskDueDate = async (taskId: string, dueDate: string | null) => {
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, due_date: dueDate } : t)));
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ due_date: dueDate })
        .eq('id', taskId);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating task due_date:', error);
      fetchTasks();
    }
  };

  const handleDragEnd = (event: any) => {
    const active = event.active;
    const over = event.over;
    if (!over) return;

    const activeType = (active.data.current as any)?.type;
    const overType = (over.data.current as any)?.type;

    if (activeType === 'task') {
      const taskId = String(active.id);

      if (overType === 'day') {
        const date = (over.data.current as any)?.date as string | undefined;
        if (!date) return;
        setTaskDueDate(taskId, date);
        return;
      }

      if (overType === 'unscheduled') {
        setTaskDueDate(taskId, null);
        return;
      }

      if (overType === 'slot') {
        const date = (over.data.current as any)?.date as string | undefined;
        const startMinutes = (over.data.current as any)?.startMinutes as number | undefined;
        if (!date || typeof startMinutes !== 'number') return;

        const kind: TimeboxKind = (tasks.find(t => t.id === taskId)?.list || '') === 'Work' ? 'deep_work' : 'admin';
        const newTb: Timebox = {
          id: crypto.randomUUID(),
          taskId,
          date,
          startMinutes: clamp(snapTo15(startMinutes), DAY_START_MINUTES, DAY_END_MINUTES - DEFAULT_DURATION),
          durationMinutes: DEFAULT_DURATION,
          kind,
        };

        setDeepDiveDayKey(date);
        setTimeboxes(prev => {
          const next = prev.filter(x => !(x.taskId === taskId && x.startMinutes === newTb.startMinutes));
          next.push(newTb);
          return next;
        });
        return;
      }
    }

    if (activeType === 'timebox' && overType === 'slot') {
      const date = (over.data.current as any)?.date as string | undefined;
      const startMinutes = (over.data.current as any)?.startMinutes as number | undefined;
      const timeboxIdRaw = (active.data.current as any)?.timeboxId as string | undefined;
      if (!date || typeof startMinutes !== 'number' || !timeboxIdRaw) return;

      const tb = timeboxesById.get(timeboxIdRaw);
      if (!tb) return;

      const duration = tb.durationMinutes;
      const nextStart = clamp(snapTo15(startMinutes), DAY_START_MINUTES, DAY_END_MINUTES - duration);
      setDeepDiveDayKey(date);
      setTimeboxes(prev => prev.map(x => (x.id === tb.id ? { ...x, date, startMinutes: nextStart } : x)));
    }
  };

  return (
    <AppLayout
      notes={notes || []}
      folders={folders}
      dashboards={dashboards}
      activeDashboard={activeDashboard}
      selectedNoteId={null}
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
      showHeader={true}
      openNotes={openNotes}
      tabsEnabled={tabsEnabled}
      onTabClick={handleNoteSelect}
      onTabClose={handleTabClose}
      isTimerVisible={false}
      setIsTimerVisible={() => {}}
      isTasksVisible={false}
      setIsTasksVisible={() => {}}
      isAmbientVisible={false}
      setIsAmbientVisible={() => {}}
      isStatsVisible={false}
      setIsStatsVisible={() => {}}
    >
      <div className="p-6" style={{ background: 'var(--bg-panel)', minHeight: '100%' }}>
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 rounded-xl hover:bg-[#252525] transition-colors"
                title="Back to dashboard"
              >
                <ArrowLeft className="w-4 h-4" style={{ color: 'var(--muted)' }} />
              </button>
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'radial-gradient(circle at top left, rgba(79, 195, 247, 0.16), transparent 60%), var(--bg-elev)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 18px 45px rgba(0,0,0,0.35)',
                }}
              >
                <CalendarIcon className="w-5 h-5" style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <div className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>
                  Routine Calendar
                </div>
                <div className="text-sm" style={{ color: 'var(--muted)' }}>
                  Plan your week. Drag tasks onto days.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setWeekStart(prev => addDays(prev, -7))}
                className="p-2 rounded-xl hover:bg-[#252525] transition-colors"
                title="Previous week"
              >
                <ChevronLeft className="w-4 h-4" style={{ color: 'var(--muted)' }} />
              </button>
              <button
                onClick={() => setWeekStart(startOfWeekMonday(new Date()))}
                className="px-3 py-2 rounded-xl text-sm transition-colors"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--bg-elev)',
                  color: 'var(--text)',
                }}
              >
                This week
              </button>

              <button
                onClick={() => {
                  setShowTodayOnly(v => {
                    const next = !v;
                    if (next) setWeekStart(startOfWeekMonday(new Date()));
                    return next;
                  });
                }}
                className="px-3 py-2 rounded-xl text-sm transition-colors"
                style={{
                  border: '1px solid var(--border)',
                  background: showTodayOnly ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--bg-elev)',
                  color: showTodayOnly ? 'var(--accent)' : 'var(--text)',
                }}
                title="Toggle day-only view"
              >
                Today
              </button>
              <button
                onClick={() => setWeekStart(prev => addDays(prev, 7))}
                className="p-2 rounded-xl hover:bg-[#252525] transition-colors"
                title="Next week"
              >
                <ChevronRight className="w-4 h-4" style={{ color: 'var(--muted)' }} />
              </button>

              <button
                onClick={() => navigate('/tasks')}
                className="px-3 py-2 rounded-xl text-sm transition-colors flex items-center gap-2"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--bg-elev)',
                  color: 'var(--text)',
                }}
                title="Open tasks"
              >
                <CheckCircle className="w-4 h-4" style={{ color: 'var(--muted)' }} />
                Tasks
              </button>

              <button
                onClick={() => setDeepDiveDayKey(todayKey)}
                className="px-3 py-2 rounded-xl text-sm transition-colors"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--bg-elev)',
                  color: 'var(--text)',
                }}
                title="Open today's Deep Dive"
              >
                Deep Dive
              </button>
            </div>
          </div>

          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-12 gap-6">
            <div className={deepDiveDayKey ? 'hidden' : 'col-span-12 lg:col-span-3 flex flex-col gap-6'}>
              <div
                className="rounded-2xl p-4"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--bg-elev)',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                }}
              >
                <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>
                  Today's intention
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={intentionDraft}
                    onChange={(e) => setIntentionDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      const next = intentionDraft.trim();
                      if (!next) return;
                      setIntentions(prev => [...prev, next]);
                      setIntention(next);
                      setIntentionDraft('');
                      setIntentionJustSubmitted(true);
                    }}
                    placeholder="Add intention (Enter)"
                    className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                    style={{
                      color: 'var(--text)',
                      background: 'var(--bg-panel)',
                      border: '1px solid var(--border)',
                      caretColor: 'var(--accent)',
                    }}
                  />
                </div>

                <div className="mt-2 flex flex-col gap-2">
                  {intentions.length === 0 ? (
                    <div className="text-xs" style={{ color: 'var(--muted)' }}>
                      Add up to 3 core intentions for today.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {intentions.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2">
                          <div className="text-xs truncate" style={{ color: 'var(--text)' }}>
                            {it}
                          </div>
                          <button
                            onClick={() => setIntentions(prev => prev.filter((_, i) => i !== idx))}
                            className="text-[10px] px-2 py-0.5 rounded-lg"
                            style={{
                              color: 'var(--muted)',
                              border: '1px solid rgba(255,255,255,0.10)',
                              background: 'rgba(0,0,0,0.10)',
                            }}
                            title="Remove"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                </div>

                <div className="mt-2 text-xs" style={{ color: intentionJustSubmitted ? 'var(--accent)' : 'var(--muted)' }}>
                  {intentionJustSubmitted ? 'Saved' : 'Rule of 3: Enter adds an intention'}
                </div>
              </div>

              <div
                className="rounded-2xl p-4"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--bg-elev)',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    Unscheduled
                  </div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>
                    {unscheduledTasks.length}
                  </div>
                </div>

                {tasksLoading ? (
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>
                    Loading...
                  </div>
                ) : unscheduledTasks.length === 0 ? (
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>
                    Everything is scheduled.
                  </div>
                ) : (
                  <UnscheduledDropZone>
                    {unscheduledTasks.map((task) => (
                      <DraggableTaskPill key={task.id} task={task} />
                    ))}
                  </UnscheduledDropZone>
                )}

                <div className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
                  Tip: drag onto a day, or into a time slot from the Deep Dive panel.
                </div>
              </div>
            </div>

            <div className={deepDiveDayKey ? (deepDiveZen ? 'hidden' : 'col-span-12 lg:col-span-6') : 'col-span-12 lg:col-span-9'}>
              <div
                className={
                  showTodayOnly
                    ? 'grid grid-cols-1 gap-4'
                    : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
                }
              >
                {(
                  showTodayOnly
                    ? (() => {
                        const inWeek = days.find(d => d.key === todayKey);
                        if (inWeek) return [inWeek];
                        const d = new Date(`${todayKey}T00:00:00`);
                        return [
                          {
                            date: d,
                            key: todayKey,
                            label: `${formatDayLabel(d)} ${formatDayNumber(d)}`,
                          },
                        ];
                      })()
                    : days
                ).map((d) => (
                  <DayDropZone
                    key={d.key}
                    date={d.key}
                    title={d.label}
                    isToday={d.key === todayKey}
                    onOpen={(dayKey) => setDeepDiveDayKey(dayKey)}
                  >
                    {(tasksByDate.get(d.key) || []).map((task) => (
                      <DraggableTaskPill key={task.id} task={task} />
                    ))}
                  </DayDropZone>
                ))}
              </div>
            </div>

            {deepDiveDayKey && (
              <div className={deepDiveZen ? 'col-span-12' : 'col-span-12 lg:col-span-3'}>
                <div
                  className="rounded-2xl p-4"
                  style={{
                    border: '1px solid var(--border)',
                    background: 'var(--bg-elev)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                    position: 'sticky',
                    top: 16,
                    maxHeight: 'calc(100vh - 140px)',
                    height: deepDiveZen ? 'calc(100vh - 140px)' : undefined,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                        Daily Deep Dive
                      </div>
                      <div className="text-xs" style={{ color: 'var(--muted)' }}>
                        {deepDiveTitle}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDeepDiveZen(z => !z)}
                        className="text-xs px-3 py-1.5 rounded-xl"
                        style={{
                          color: deepDiveZen ? 'var(--accent)' : 'var(--muted)',
                          border: deepDiveZen
                            ? '1px solid color-mix(in srgb, var(--accent) 40%, transparent)'
                            : '1px solid rgba(255,255,255,0.10)',
                          background: deepDiveZen
                            ? 'color-mix(in srgb, var(--accent) 10%, transparent)'
                            : 'rgba(0,0,0,0.10)',
                        }}
                      >
                        {deepDiveZen ? 'Exit Zen' : 'Zen'}
                      </button>
                      <button
                        onClick={() => setDeepDiveDayKey(null)}
                        className="text-xs px-3 py-1.5 rounded-xl"
                        style={{
                          color: 'var(--muted)',
                          border: '1px solid rgba(255,255,255,0.10)',
                          background: 'rgba(0,0,0,0.10)',
                        }}
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  {!deepDiveZen ? (
                    <div
                      className="rounded-xl px-2 py-2"
                      style={{
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(0,0,0,0.10)',
                        overflow: 'hidden',
                        marginBottom: 10,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDeepDivePriorityMenu({ x: e.clientX, y: e.clientY });
                          }}
                          className="text-xs px-2 h-8 rounded-lg"
                          style={{
                            color: deepDiveTaskPriority === 1 ? '#ef4444' : deepDiveTaskPriority === 2 ? '#ff7a18' : '#22c55e',
                            border: '1px solid rgba(255,255,255,0.10)',
                            background: 'rgba(0,0,0,0.10)',
                            minWidth: 44,
                          }}
                          title="Priority"
                        >
                          {deepDiveTaskPriority === 1 ? 'P1' : deepDiveTaskPriority === 2 ? 'P2' : 'P3'}
                        </button>

                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDeepDiveDurationMenu({ x: e.clientX, y: e.clientY });
                          }}
                          className="text-xs px-2 h-8 rounded-lg flex items-center gap-1"
                          style={{
                            color: slotDuration ? 'var(--accent)' : 'var(--muted)',
                            border: '1px solid rgba(255,255,255,0.10)',
                            background: 'rgba(0,0,0,0.10)',
                            minWidth: 56,
                          }}
                          title="Duration"
                        >
                          <Clock3 className="w-3.5 h-3.5" />
                          {slotDuration}m
                        </button>

                        <input
                          value={deepDiveTaskDraft}
                          onChange={(e) => setDeepDiveTaskDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            const next = deepDiveTaskDraft.trim();
                            if (!next || !deepDiveDayKey) return;
                            createTaskAndTimebox({
                              title: next,
                              date: deepDiveDayKey,
                              startMinutes: resolveQuickAddStartMinutes(deepDiveDayKey, slotDuration),
                              durationMinutes: slotDuration,
                              priority: deepDiveTaskPriority,
                            });
                            setDeepDiveTaskDraft('');
                          }}
                          placeholder="Add task"
                          className="flex-1 rounded-lg px-2 h-8 text-xs outline-none"
                          style={{
                            color: 'var(--text)',
                            background: 'rgba(0,0,0,0.10)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            minWidth: 0,
                          }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {deepDivePriorityMenu && (
                    <div
                      className="fixed rounded-xl shadow-2xl overflow-hidden"
                      style={{
                        top: Math.min(deepDivePriorityMenu.y, window.innerHeight - 140),
                        left: Math.min(deepDivePriorityMenu.x, window.innerWidth - 180),
                        width: 160,
                        zIndex: 10000,
                        background: 'var(--bg-elev)',
                        border: '1px solid var(--border)',
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {([
                        { p: 1 as TaskPriority, label: 'P1 (High)', c: '#ef4444' },
                        { p: 2 as TaskPriority, label: 'P2 (Medium)', c: '#ff7a18' },
                        { p: 3 as TaskPriority, label: 'P3 (Low)', c: '#22c55e' },
                      ] as const).map((opt) => (
                        <button
                          key={opt.p}
                          onClick={() => {
                            setDeepDiveTaskPriority(opt.p);
                            setDeepDivePriorityMenu(null);
                          }}
                          className="w-full px-3 py-2 text-left text-sm transition-colors"
                          style={{ color: 'var(--text)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: opt.c }} />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {deepDiveDurationMenu && (
                    <div
                      className="fixed rounded-xl shadow-2xl overflow-hidden"
                      style={{
                        top: Math.min(deepDiveDurationMenu.y, window.innerHeight - 220),
                        left: Math.min(deepDiveDurationMenu.x, window.innerWidth - 180),
                        width: 120,
                        zIndex: 10000,
                        background: 'var(--bg-elev)',
                        border: '1px solid var(--border)',
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {[15, 30, 45, 60, 90].map((d) => (
                        <button
                          key={d}
                          onClick={() => {
                            setSlotDuration(d);
                            setDeepDiveDurationMenu(null);
                          }}
                          className="w-full px-3 py-2 text-left text-sm transition-colors"
                          style={{
                            color: slotDuration === d ? 'var(--accent)' : 'var(--text)',
                            background: slotDuration === d ? 'rgba(255,255,255,0.04)' : 'transparent',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = slotDuration === d ? 'rgba(255,255,255,0.04)' : 'transparent')}
                        >
                          {d} min
                        </button>
                      ))}
                    </div>
                  )}

                  <div
                    ref={timelineRef}
                    className="rounded-xl overflow-y-auto custom-scrollbar"
                    style={{
                      position: 'relative',
                      background: 'var(--bg-panel)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      height: deepDiveZen ? 'auto' : 640,
                      flex: deepDiveZen ? 1 : undefined,
                      minHeight: 0,
                    }}
                  >
                    <div style={{ position: 'relative', height: ((DAY_END_MINUTES - DAY_START_MINUTES) / 15) * PX_PER_15 }}>
                      {slots.map((m: number) => (
                        <div key={m} className="flex" style={{ height: PX_PER_15 }}>
                          <div
                            className="w-[72px] pr-2 text-[10px]"
                            style={{
                              color: 'var(--muted)',
                              paddingTop: 2,
                              textAlign: 'right',
                              opacity: m % 60 === 0 ? 0.9 : 0.35,
                            }}
                          >
                            {m % 60 === 0 ? minutesToTimeLabel(m) : ''}
                          </div>
                          <div className="flex-1">
                            <TimeSlot
                              date={deepDiveDayKey}
                              startMinutes={m}
                              height={PX_PER_15}
                              onClick={(e, date) => {
                                const container = timelineRef.current;
                                if (!container) return;
                                const rect = container.getBoundingClientRect();
                                const yWithin = e.clientY - rect.top + container.scrollTop;
                                const minutesFromStart = (yWithin / PX_PER_15) * 15;
                                const raw = DAY_START_MINUTES + minutesFromStart;
                                const snapped = clamp(snapTo15(raw), DAY_START_MINUTES, DAY_END_MINUTES - SLOT_MINUTES);
                                setSlotDuration(30);
                                setSlotDraft('');
                                setSlotStartTimeInput(minutesToTimeLabel(snapped));
                                setSlotComposer({
                                  x: e.clientX,
                                  y: e.clientY,
                                  date,
                                  startMinutes: snapped,
                                });
                              }}
                            />
                          </div>
                        </div>
                      ))}

                      {timeboxes
                        .filter(tb => tb.date === deepDiveDayKey)
                        .map(tb => (
                          <DraggableTimeboxBlock
                            key={tb.id}
                            timebox={tb}
                            task={tasks.find(t => t.id === tb.taskId)}
                            pxPer15={PX_PER_15}
                            dayStartMinutes={DAY_START_MINUTES}
                            onContextMenu={(e, id) => {
                              e.preventDefault();
                              setContextMenu({ x: e.clientX, y: e.clientY, timeboxId: id });
                            }}
                            onResizeStart={(e, id) => {
                              e.stopPropagation();
                              e.preventDefault();
                              const tbNow = timeboxesById.get(id);
                              if (!tbNow) return;
                              setResizing({ timeboxId: id, startY: e.clientY, startDuration: tbNow.durationMinutes });
                            }}
                          />
                        ))}

                      {slotComposer && (
                        <div
                          className="fixed rounded-xl shadow-2xl overflow-hidden"
                          style={{
                            top: slotComposer.y,
                            left: slotComposer.x,
                            width: 260,
                            zIndex: 10000,
                            background: 'var(--bg-elev)',
                            border: '1px solid var(--border)',
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <div className="p-3 flex flex-col gap-2">
                            <input
                              autoFocus
                              value={slotDraft}
                              onChange={(e) => setSlotDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  e.preventDefault();
                                  setSlotComposer(null);
                                  return;
                                }
                                if (e.key !== 'Enter') return;
                                const parsedStart = parseTimeInput(slotStartTimeInput);
                                if (parsedStart === null) return;
                                e.preventDefault();
                                createTaskAndTimebox({
                                  title: slotDraft,
                                  date: slotComposer.date,
                                  startMinutes: parsedStart,
                                  durationMinutes: slotDuration,
                                });
                                setSlotComposer(null);
                              }}
                              placeholder="New task"
                              className="w-full rounded-lg px-2 h-9 text-sm outline-none"
                              style={{
                                color: 'var(--text)',
                                background: 'rgba(0,0,0,0.10)',
                                border: '1px solid rgba(255,255,255,0.10)',
                              }}
                            />
                            <div className="flex items-center gap-2">
                              <input
                                value={slotStartTimeInput}
                                onChange={(e) => setSlotStartTimeInput(e.target.value)}
                                placeholder="HH:MM"
                                className="rounded-lg px-2 h-9 text-sm outline-none"
                                style={{
                                  width: 88,
                                  color: 'var(--text)',
                                  background: 'rgba(0,0,0,0.10)',
                                  border: `1px solid ${parseTimeInput(slotStartTimeInput) === null ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.10)'}`,
                                }}
                              />
                              <button
                                onClick={() => setSlotStartTimeInput(minutesToTimeLabel(resolveQuickAddStartMinutes(slotComposer.date, slotDuration)))}
                                className="text-xs px-2 py-1 rounded-lg"
                                style={{
                                  color: 'var(--muted)',
                                  border: '1px solid rgba(255,255,255,0.10)',
                                  background: 'rgba(0,0,0,0.10)',
                                }}
                              >
                                Set to now
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              {[15, 30, 45, 60].map((d) => (
                                <button
                                  key={d}
                                  onClick={() => setSlotDuration(d)}
                                  className="text-xs px-2 py-1 rounded-lg"
                                  style={{
                                    color: slotDuration === d ? 'var(--accent)' : 'var(--muted)',
                                    border:
                                      slotDuration === d
                                        ? '1px solid color-mix(in srgb, var(--accent) 40%, transparent)'
                                        : '1px solid rgba(255,255,255,0.10)',
                                    background:
                                      slotDuration === d
                                        ? 'color-mix(in srgb, var(--accent) 10%, transparent)'
                                        : 'rgba(0,0,0,0.10)',
                                  }}
                                >
                                  {d}m
                                </button>
                              ))}
                            </div>
                            <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
                              Enter to create • Esc to cancel • exact HH:MM supported
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
                    Drag tasks into the timeline. Snaps to 15m, defaults to 30m.
                  </div>

                  {contextMenu && (
                    <div
                      className="fixed rounded-xl shadow-2xl overflow-hidden"
                      style={{
                        top: contextMenu.y,
                        left: contextMenu.x,
                        width: 200,
                        zIndex: 10000,
                        background: 'var(--bg-elev)',
                        border: '1px solid var(--border)',
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {(() => {
                        const tb = timeboxesById.get(contextMenu.timeboxId);
                        if (!tb) return null;
                        const applyDuration = (minutes: number) => {
                          const next = clamp(snapTo15(minutes), SLOT_MINUTES, DAY_END_MINUTES - DAY_START_MINUTES);
                          setTimeboxes(prev => prev.map(x => (x.id === tb.id ? { ...x, durationMinutes: next } : x)));
                          setContextMenu(null);
                        };
                        const setToNow = () => {
                          const nextStart = resolveQuickAddStartMinutes(tb.date, tb.durationMinutes);
                          setTimeboxes(prev => prev.map(x => (x.id === tb.id ? { ...x, startMinutes: nextStart } : x)));
                          setContextMenu(null);
                        };
                        const bump = (delta: number) => applyDuration(tb.durationMinutes + delta);
                        const remove = () => {
                          setTimeboxes(prev => prev.filter(x => x.id !== tb.id));
                          setContextMenu(null);
                        };
                        const rename = () => {
                          const next = window.prompt('Rename timebox', tb.titleOverride || tasks.find(t => t.id === tb.taskId)?.title || '')?.trim();
                          if (next === undefined) return;
                          setTimeboxes(prev => prev.map(x => (x.id === tb.id ? { ...x, titleOverride: next || undefined } : x)));
                          setContextMenu(null);
                        };
                        const MenuItem = ({ label, onClick }: { label: string; onClick: () => void }) => (
                          <button
                            onClick={onClick}
                            className="w-full px-3 py-2 text-left text-sm transition-colors"
                            style={{ color: 'var(--text)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            {label}
                          </button>
                        );
                        return (
                          <div>
                            <MenuItem label="Rename" onClick={rename} />
                            <MenuItem label="Set to now" onClick={setToNow} />
                            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
                            <MenuItem label="- 15 min" onClick={() => bump(-15)} />
                            <MenuItem label="+ 15 min" onClick={() => bump(15)} />
                            <MenuItem label="Set 30 min" onClick={() => applyDuration(30)} />
                            <MenuItem label="Set 60 min" onClick={() => applyDuration(60)} />
                            <MenuItem label="Set 90 min" onClick={() => applyDuration(90)} />
                            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
                            <MenuItem label="Delete" onClick={remove} />
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <div className="mt-3 rounded-xl p-3" style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div>
                        <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Completed</div>
                        <div className="text-xs" style={{ color: 'var(--muted)' }}>
                          {completedTasksForDeepDiveDay.length === 0
                            ? 'Nothing completed for this day yet.'
                            : `${completedTasksForDeepDiveDay.length} task${completedTasksForDeepDiveDay.length === 1 ? '' : 's'} finished`}
                        </div>
                      </div>
                      <div
                        className="px-2 py-1 rounded-lg text-[11px]"
                        style={{
                          color: completedTasksForDeepDiveDay.length > 0 ? '#22c55e' : 'var(--muted)',
                          border: '1px solid rgba(255,255,255,0.10)',
                          background: completedTasksForDeepDiveDay.length > 0 ? 'rgba(34,197,94,0.08)' : 'transparent',
                        }}
                      >
                        {completedTasksForDeepDiveDay.length} done
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {completedTasksForDeepDiveDay.length === 0 ? (
                        <div className="text-xs" style={{ color: 'var(--muted)' }}>
                          At the end of the day, your completed tasks will show up here as a small recap.
                        </div>
                      ) : (
                        completedTasksForDeepDiveDay.map((task) => (
                          <div key={task.id} className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#22c55e' }} />
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: task.priority === 1 ? '#ef4444' : task.priority === 2 ? '#ff7a18' : '#22c55e' }} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm truncate" style={{ color: 'var(--text)' }}>{task.title}</div>
                              <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
                                {task.completed_at ? `Done at ${new Date(task.completed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'Completed'}
                              </div>
                            </div>
                            <button
                              onClick={() => deleteCompletedTask(task.id)}
                              className="text-[11px] px-2 py-1 rounded-lg"
                              style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.22)' }}
                            >
                              Delete
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          </DndContext>
        </div>
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </AppLayout>
  );
};
