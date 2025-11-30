export interface Note {
  id: string;
  user_id: string;
  folder_id: string | null;
  dashboard_id: string | null;
  title: string;
  content: string;
  emoji: string | null;
  drawing_data: string | null;
  is_starred: boolean;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  emoji: string | null;
  parent_id: string | null;
  dashboard_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Dashboard {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  cover_image: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  username?: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  profile_picture_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: 1 | 2 | 3; // 1 = high, 2 = medium, 3 = low
  completed: boolean;
  position: number; // For drag-and-drop ordering
  list: string; // Project/list name (e.g., 'Inbox', 'Personal', 'Work')
  created_at: string;
  updated_at: string;
}

export interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUsername: (username: string) => Promise<void>;
}
