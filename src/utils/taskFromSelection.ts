import { supabase } from '../lib/supabase';

export const createTaskFromSelection = async (selectedText: string, userId: string): Promise<boolean> => {
  try {
    // Trim and validate
    const taskTitle = selectedText.trim().slice(0, 200); // Limit to 200 chars
    if (!taskTitle) return false;

    const { error } = await supabase
      .from('tasks')
      .insert([
        {
          user_id: userId,
          title: taskTitle,
          completed: false,
          priority: 2,
        },
      ]);

    if (error) throw error;
    
    // Dispatch event to refresh tasks list
    window.dispatchEvent(new Event('taskCreated'));
    
    return true;
  } catch (error) {
    console.error('Error creating task from selection:', error);
    return false;
  }
};
