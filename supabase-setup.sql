-- Quill Notes Database Schema Setup
-- Run this SQL in your Supabase SQL Editor

-- IMPORTANT: Create the trigger function FIRST before any tables use it
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create user_profiles table
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Enable Row Level Security for user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for user_profiles
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create trigger for user_profiles updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create index for user_profiles
CREATE INDEX idx_user_profiles_username ON user_profiles(username);

-- Create folders table
CREATE TABLE folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'New Folder',
  emoji TEXT,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Enable Row Level Security for folders
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- Create policies for folders
CREATE POLICY "Users can view their own folders"
  ON folders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own folders"
  ON folders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders"
  ON folders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders"
  ON folders FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger for folders updated_at
CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create index for folders
CREATE INDEX idx_folders_user_id ON folders(user_id);
CREATE INDEX idx_folders_parent_id ON folders(parent_id);

-- Create notes table
CREATE TABLE notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Note',
  content TEXT DEFAULT '',
  emoji TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Create policies for secure access
CREATE POLICY "Users can view their own notes"
  ON notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notes"
  ON notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
  ON notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
  ON notes FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger to automatically update updated_at column for notes
CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create index for better query performance
CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_notes_folder_id ON notes(folder_id);
CREATE INDEX idx_notes_updated_at ON notes(updated_at DESC);
