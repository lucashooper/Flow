import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MoreVertical, Calendar, Trash2, Check } from 'lucide-react';
import type { Task } from '../types';
import { useTimerStore } from '../stores/timerStore';

interface TaskCardProps {
  task: Task;
  onToggleComplete: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onUpdatePriority: (taskId: string, priority: 1 | 2 | 3) => void;
  getPriorityColor: (priority: 1 | 2 | 3) => string;
}

export const TaskCard = ({ task, onToggleComplete, onDelete, onUpdatePriority, getPriorityColor }: TaskCardProps) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  
  const { attachedTaskId, isRunning } = useTimerStore();
  const isAttached = attachedTaskId === task.id;
  const shouldDim = isRunning && attachedTaskId && !isAttached;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const cardStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: isDragging 
      ? 'rgba(26, 26, 26, 0.6)' 
      : isAttached 
        ? 'rgba(255, 122, 24, 0.08)'
        : 'rgba(26, 26, 26, 0.4)',
    backdropFilter: 'blur(16px)',
    border: isAttached 
      ? '1px solid rgba(255, 122, 24, 0.3)'
      : '1px solid rgba(255, 255, 255, 0.05)',
    boxShadow: isDragging 
      ? '0 20px 50px rgba(255, 140, 0, 0.15)' 
      : isAttached
        ? '0 0 30px rgba(255, 122, 24, 0.2), 0 10px 30px rgba(255, 140, 0, 0.1)'
        : '0 10px 30px rgba(255, 140, 0, 0.05)',
    userSelect: 'none' as const,
    cursor: 'default' as const,
    opacity: isDragging ? 0.5 : shouldDim ? 0.4 : 1,
    pointerEvents: 'auto' as const,
  };

  const handleComplete = () => {
    setIsCompleting(true);
    setTimeout(() => {
      onToggleComplete(task);
    }, 220);
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={cardStyle}
      initial={{ opacity: 0, y: 6 }}
      animate={{ 
        opacity: isCompleting ? 0 : 1, 
        y: isCompleting ? 6 : 0,
        scale: isCompleting ? 0.98 : 1
      }}
      exit={{ opacity: 0, y: 6, scale: 0.98, transition: { duration: 0.22 } }}
      whileHover={{ y: shouldDim ? 0 : -1, background: shouldDim ? undefined : 'rgba(255, 255, 255, 0.07)' }}
      className="group relative rounded-xl p-4"
    >
      <div className="flex items-center gap-3">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ cursor: 'grab', touchAction: 'none' }}
        >
          <GripVertical className="w-4 h-4 text-[#666666]" />
        </div>

        {/* Checkbox */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleComplete}
          className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-[#666666] hover:border-[#ff7a18] transition-colors flex items-center justify-center relative"
          style={{ cursor: 'pointer' }}
        >
          {isCompleting && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.15 }}
            >
              <Check className="w-4 h-4 text-[#ff7a18]" />
            </motion.div>
          )}
        </motion.button>

        {/* Priority Dot */}
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: getPriorityColor(task.priority), cursor: 'default' }}
        />

        {/* Title */}
        <div className="flex-1 min-w-0">
          <p className="text-[#e5e5e5]">{task.title}</p>
          {task.list && task.list !== 'Inbox' && (
            <p className="text-xs text-[#666666] mt-0.5">{task.list}</p>
          )}
        </div>

        {/* Due Date */}
        {task.due_date && (
          <div 
            className="flex items-center gap-1 text-xs text-[#888888] px-2 py-1 rounded-lg"
            style={{
              background: 'rgba(42, 42, 42, 0.5)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <Calendar className="w-3 h-3" />
            {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        )}

        {/* Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded transition-opacity opacity-0 group-hover:opacity-100"
            style={{ 
              cursor: 'pointer',
              background: showMenu ? 'rgba(42, 42, 42, 0.5)' : 'transparent',
            }}
          >
            <MoreVertical className="w-4 h-4 text-[#888888]" />
          </button>

          {showMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute right-0 top-full mt-2 rounded-lg shadow-2xl py-1 z-50 min-w-[160px]"
              style={{
                background: 'rgba(18, 18, 18, 0.95)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
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
