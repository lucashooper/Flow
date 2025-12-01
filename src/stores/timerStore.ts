import { create } from 'zustand';

type TimerMode = 'work' | 'break' | 'longBreak';

interface TimerState {
  isRunning: boolean;
  secondsLeft: number;
  mode: TimerMode;
  attachedTaskId: string | null;
  pomodorosCompleted: number;

  // UI: global floating timer toggle
  floatingEnabled: boolean;

  // Actions
  start: () => void;
  pause: () => void;
  reset: () => void;
  tick: () => void;
  setMode: (mode: TimerMode) => void;
  attachTask: (taskId: string | null) => void;
  completePomodoro: () => void;
  setFloatingEnabled: (value: boolean) => void;
}

const DURATIONS = {
  work: 25 * 60, // 25 minutes
  break: 5 * 60, // 5 minutes
  longBreak: 15 * 60, // 15 minutes
};

export const useTimerStore = create<TimerState>((set, get) => ({
  isRunning: false,
  secondsLeft: DURATIONS.work,
  mode: 'work',
  attachedTaskId: null,
  pomodorosCompleted: 0,

  floatingEnabled: false,

  start: () => set({ isRunning: true }),
  
  pause: () => set({ isRunning: false }),
  
  reset: () => {
    const { mode } = get();
    set({ 
      isRunning: false, 
      secondsLeft: DURATIONS[mode] 
    });
  },
  
  tick: () => {
    const { secondsLeft, isRunning, mode, pomodorosCompleted } = get();
    
    if (!isRunning || secondsLeft <= 0) return;
    
    const newSecondsLeft = secondsLeft - 1;
    
    if (newSecondsLeft <= 0) {
      // Timer completed
      set({ isRunning: false, secondsLeft: 0 });
      
      // Auto-switch to break or work
      if (mode === 'work') {
        const newMode = (pomodorosCompleted + 1) % 4 === 0 ? 'longBreak' : 'break';
        setTimeout(() => {
          set({ 
            mode: newMode, 
            secondsLeft: DURATIONS[newMode],
            pomodorosCompleted: pomodorosCompleted + 1
          });
        }, 1000);
      } else {
        setTimeout(() => {
          set({ 
            mode: 'work', 
            secondsLeft: DURATIONS.work 
          });
        }, 1000);
      }
    } else {
      set({ secondsLeft: newSecondsLeft });
    }
  },
  
  setMode: (mode: TimerMode) => {
    set({ 
      mode, 
      secondsLeft: DURATIONS[mode], 
      isRunning: false 
    });
  },
  
  attachTask: (taskId: string | null) => {
    set({ attachedTaskId: taskId });
  },
  
  completePomodoro: () => {
    set((state) => ({ 
      pomodorosCompleted: state.pomodorosCompleted + 1 
    }));
  },

  setFloatingEnabled: (value: boolean) => {
    set({ floatingEnabled: value });
  },
}));
