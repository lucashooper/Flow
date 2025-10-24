# Quill Notes 📝

A beautiful, minimal note-taking application built with React, TypeScript, Tailwind CSS, and Supabase.

## Features

- 📝 **Markdown Support** - Write notes with full markdown formatting and live preview
- 🔐 **Secure Authentication** - User authentication powered by Supabase
- 🌓 **Dark Mode** - Automatic dark mode support with manual toggle
- ⚡ **Auto-save** - Your notes are automatically saved as you type
- 🔍 **Search** - Quickly find notes by title or content
- 🎨 **Modern UI** - Clean, minimal interface built with Tailwind CSS
- 📱 **Responsive** - Works seamlessly on desktop and mobile devices

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (Database + Authentication)
- **Routing**: React Router
- **Markdown**: react-markdown
- **Icons**: Lucide React

## Prerequisites

- Node.js (v20.19+ or v22.12+)
- npm or yarn
- A Supabase account

## Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd flow
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Supabase

Create a Supabase project at [supabase.com](https://supabase.com)

### 4. Create the notes table

Go to the SQL Editor in your Supabase dashboard and run:

```sql
-- Create notes table
CREATE TABLE notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Note',
  content TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Create policies
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

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 5. Configure environment variables

Copy `.env.example` to `.env` and update with your Supabase credentials:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 6. Run the development server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure

```
flow/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── MarkdownEditor.tsx
│   │   ├── Navbar.tsx
│   │   └── ProtectedRoute.tsx
│   ├── contexts/         # React contexts
│   │   ├── AuthContext.tsx
│   │   └── ThemeContext.tsx
│   ├── lib/             # Utilities and configurations
│   │   └── supabase.ts
│   ├── pages/           # Page components
│   │   ├── Dashboard.tsx
│   │   ├── Landing.tsx
│   │   ├── Login.tsx
│   │   ├── NoteEditor.tsx
│   │   └── Signup.tsx
│   ├── types/           # TypeScript interfaces
│   │   └── index.ts
│   ├── App.tsx          # Main app component with routing
│   ├── main.tsx         # App entry point
│   └── index.css        # Global styles
├── .env                 # Environment variables (not in git)
├── .env.example         # Example environment variables
└── package.json
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Database Schema

### notes table

| Column     | Type      | Description                        |
|------------|-----------|-----------------------------------|
| id         | UUID      | Primary key                       |
| user_id    | UUID      | Foreign key to auth.users         |
| title      | TEXT      | Note title                        |
| content    | TEXT      | Note content (markdown)           |
| created_at | TIMESTAMP | Creation timestamp                |
| updated_at | TIMESTAMP | Last update timestamp             |

## Features Overview

### Authentication
- Sign up with email and password
- Sign in to access your notes
- Secure session management with Supabase Auth

### Note Management
- Create new notes
- Edit notes with markdown support
- Auto-save while typing
- Delete notes
- Search notes by title or content

### Markdown Editor
- Write in markdown syntax
- Live preview mode
- Toggle between edit and preview

### Dark Mode
- Automatic detection of system preference
- Manual toggle
- Persistent preference storage

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for personal or commercial purposes.
