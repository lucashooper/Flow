import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { CheckCircle, Calendar, Flag, X, ChevronDown, Inbox } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Task } from '../types';
import { AppLayout } from '../components/AppLayout';
import { useDashboardData } from '../hooks/useDashboardData';
import { TaskCard } from '../components/TaskCard';

type TaskPriority = 1 | 2 | 3;

const TASK_LISTS = ['Inbox', 'Personal', 'Work'];

export const Tasks = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  // Use shared dashboard data hook
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
    handleTabReorder,
  } = useDashboardData();
  
  // Composer state - ALWAYS expanded on Tasks page
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [quickAddPriority, setQuickAddPriority] = useState<TaskPriority>(2);
  const [quickAddDueDate, setQuickAddDueDate] = useState<string | null>(null);
  const [quickAddList, setQuickAddList] = useState<string>('Inbox');
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showDateMenu, setShowDateMenu] = useState(false);
  const [showListMenu, setShowListMenu] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const priorityMenuRef = useRef<HTMLDivElement>(null);
  const dateMenuRef = useRef<HTMLDivElement>(null);
  const listMenuRef = useRef<HTMLDivElement>(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
      if (listMenuRef.current && !listMenuRef.current.contains(e.target as Node)) {
        setShowListMenu(false);
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
        .order('position', { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setTasksLoading(false);
    }
  };

  const handleNoteSelect = (noteId: string) => {
    dashboardHandleNoteSelect(noteId);
    navigate(`/dashboard?note=${noteId}`);
  };

  const addTask = async () => {
    if (!newTaskTitle.trim() || !user) return;

    const maxPosition = tasks.length > 0 ? Math.max(...tasks.map(t => t.position)) : 0;

    const newTask = {
      user_id: user.id,
      title: newTaskTitle.trim(),
      description: null,
      due_date: quickAddDueDate,
      priority: quickAddPriority,
      completed: false,
      position: maxPosition + 1,
      list: quickAddList,
    };

    const tempId = crypto.randomUUID();
    const optimisticTask: Task = {
      ...newTask,
      id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    setTasks(prev => [...prev, optimisticTask]);
    
    // Reset form (keep expanded)
    setNewTaskTitle('');
    setQuickAddPriority(2);
    setQuickAddDueDate(null);
    setQuickAddList('Inbox');

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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = tasks.findIndex(t => t.id === active.id);
    const newIndex = tasks.findIndex(t => t.id === over.id);

    const reorderedTasks = arrayMove(tasks, oldIndex, newIndex);
    setTasks(reorderedTasks);

    try {
      const updates = reorderedTasks.map((task, index) => ({
        id: task.id,
        position: index,
      }));

      for (const update of updates) {
        await supabase
          .from('tasks')
          .update({ position: update.position })
          .eq('id', update.id);
      }
    } catch (error) {
      console.error('Error updating task positions:', error);
      fetchTasks();
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

  const getPriorityColor = (priority: 1 | 2 | 3) => {
    switch (priority) {
      case 1: return '#ef4444';
      case 2: return '#ff7a18';
      case 3: return '#22c55e';
    }
  };

  const getPriorityLabel = (priority: TaskPriority) => {
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
      setNewTaskTitle('');
      setQuickAddPriority(2);
      setQuickAddDueDate(null);
      setQuickAddList('Inbox');
      inputRef.current?.blur();
    }
  };

  const handleCancel = () => {
    setNewTaskTitle('');
    setQuickAddPriority(2);
    setQuickAddDueDate(null);
    setQuickAddList('Inbox');
  };

  const tasksByList = tasks.reduce((acc, task) => {
    const list = task.list || 'Inbox';
    if (!acc[list]) acc[list] = [];
    acc[list].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;


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
      showHeader={true}
      openNotes={openNotes}
      tabsEnabled={tabsEnabled}
      onTabClick={handleNoteSelect}
      onTabClose={handleTabClose}
      onTabReorder={handleTabReorder}
    >
      <div className="max-w-4xl mx-auto px-8 py-12 select-none">
        {/* Header - No subtitle */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-[#ff7a18]" style={{ userSelect: 'none' }} />
            <h1 className="text-4xl font-bold">Tasks</h1>
          </div>
        </div>

        {/* Always-Expanded Composer */}
        <div className="mb-8">
          <div
            className="rounded-xl"
            style={{
              background: 'rgba(18, 18, 18, 0.7)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 122, 24, 0.05)',
              boxShadow: '0 12px 35px rgba(0, 0, 0, 0.6)',
            }}
          >
            {/* Row 1: Task Name Input */}
            <div className="p-4 pb-3">
              <input
                ref={inputRef}
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a new task..."
                className="w-full bg-transparent border-none outline-none text-[#e5e5e5] placeholder-[#666666] text-base"
                style={{ userSelect: 'text', cursor: 'text' }}
              />
            </div>

            {/* Row 2 & 3: Meta + Actions (always visible) */}
            <div>
                  {/* Row 2: Meta Pills */}
                  <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
                    {/* List Selector */}
                    <div className="relative" ref={listMenuRef}>
                      <button
                        onClick={() => {
                          setShowListMenu(!showListMenu);
                          setShowPriorityMenu(false);
                          setShowDateMenu(false);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-[#2a2a2a]/50 text-[#888888] border border-[#3a3a3a] hover:border-[#4a4a4a] transition-colors"
                        style={{ cursor: 'pointer' }}
                      >
                        <Inbox className="w-3.5 h-3.5" />
                        <span>{quickAddList}</span>
                        <ChevronDown className="w-3 h-3" />
                      </button>

                      {showListMenu && (
                        <div className="absolute top-full left-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl py-1 z-10 min-w-[140px]">
                          {TASK_LISTS.map(list => (
                            <button
                              key={list}
                              onClick={() => {
                                setQuickAddList(list);
                                setShowListMenu(false);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#2a2a2a] transition-colors"
                              style={{ cursor: 'pointer' }}
                            >
                              {list}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Due Date Chip */}
                    <div className="relative" ref={dateMenuRef}>
                      <button
                        onClick={() => {
                          setShowDateMenu(!showDateMenu);
                          setShowPriorityMenu(false);
                          setShowListMenu(false);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          quickAddDueDate
                            ? 'bg-[#ff7a18]/20 text-[#ff7a18] border border-[#ff7a18]/30'
                            : 'bg-[#2a2a2a]/50 text-[#888888] border border-[#3a3a3a] hover:border-[#4a4a4a]'
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
                        <div className="absolute top-full left-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl py-1 z-10 min-w-[140px]">
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
                        </div>
                      )}
                    </div>

                    {/* Priority Chip */}
                    <div className="relative" ref={priorityMenuRef}>
                      <button
                        onClick={() => {
                          setShowPriorityMenu(!showPriorityMenu);
                          setShowDateMenu(false);
                          setShowListMenu(false);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-[#2a2a2a]/50 text-[#888888] border border-[#3a3a3a] hover:border-[#4a4a4a] transition-colors"
                        style={{ cursor: 'pointer' }}
                      >
                        <Flag className="w-3.5 h-3.5" />
                        <span>{getPriorityLabel(quickAddPriority)}</span>
                      </button>

                      {showPriorityMenu && (
                        <div className="absolute top-full left-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl py-1 z-10 min-w-[140px]">
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
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 3: Actions */}
                  <div className="px-4 pb-4 flex items-center justify-end gap-2">
                    <button
                      onClick={handleCancel}
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
            </div>
          </div>
        </div>

        {/* Task Lists - No redundant headings */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {Object.entries(tasksByList).map(([listName, listTasks]) => (
            <div key={listName} className="mb-8">
              <SortableContext
                items={listTasks.map(t => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {listTasks.map(task => (
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
              </SortableContext>
            </div>
          ))}

          <DragOverlay>
            {activeTask && (
              <div
                className="rounded-xl p-4"
                style={{
                  background: 'rgba(18, 18, 18, 0.95)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 122, 24, 0.2)',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
                  transform: 'scale(1.02)',
                  cursor: 'grabbing',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getPriorityColor(activeTask.priority) }} />
                  <p className="text-[#e5e5e5]">{activeTask.title}</p>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {/* Empty State */}
        {tasks.length === 0 && !tasksLoading && (
          <div className="text-center py-20">
            <CheckCircle className="w-16 h-16 text-[#2a2a2a] mx-auto mb-4" style={{ userSelect: 'none' }} />
            <p className="text-[#888888] text-lg">No tasks yet. Add one above to get started!</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};
