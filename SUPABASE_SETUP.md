# Supabase Setup Instructions for Quill Notes

## Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Enter your project details:
   - **Name**: Flow (or any name you prefer)
   - **Database Password**: Choose a secure password
   - **Region**: Select the closest region to your users
4. Click "Create new project" and wait for setup to complete

## Step 2: Get Your API Credentials

1. Once your project is created, go to **Project Settings** (gear icon in sidebar)
2. Navigate to **API** section
3. Copy the following credentials:
   - **Project URL**: `https://[your-project-id].supabase.co`
   - **anon/public key**: This is your `VITE_SUPABASE_ANON_KEY`

## Step 3: Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

⚠️ **Important**: Never commit the `.env` file to version control!

## Step 4: Create Database Tables

1. In your Supabase dashboard, click on **SQL Editor** in the left sidebar
2. Click **New Query**
3. Copy the entire contents of `supabase-setup.sql` file
4. Paste it into the SQL editor
5. Click **Run** to execute the SQL

This will create:
- ✅ The `notes` table with proper schema
- ✅ Row Level Security (RLS) policies for data protection
- ✅ Automatic `updated_at` timestamp triggers
- ✅ Database indexes for better performance

## Step 5: Configure Authentication

### Enable Email Authentication

1. Go to **Authentication** → **Providers** in your Supabase dashboard
2. Ensure **Email** is enabled (it should be by default)
3. Configure email settings:
   - **Enable email confirmations**: ON (recommended for production)
   - **Secure email change**: ON (recommended)
   - **Confirm email**: ON (recommended for production)

### Email Templates (Optional)

You can customize the email templates for signup and password reset:

1. Go to **Authentication** → **Email Templates**
2. Customize the templates as needed

### Development Mode (Optional)

For development/testing, you might want to:
1. Go to **Authentication** → **Providers**
2. Scroll to **Email** provider settings
3. Toggle **Enable email confirmations** to OFF
   - This allows instant signup without email verification
   - ⚠️ Only use this for development, not production!

## Step 6: Test Your Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open [http://localhost:5173](http://localhost:5173)

3. Try the following:
   - Create a new account (Sign Up)
   - Sign in with your credentials
   - Create a new note
   - Edit and save notes
   - Test search functionality
   - Toggle dark mode

## Database Schema Overview

### notes table

```sql
CREATE TABLE notes (
  id UUID PRIMARY KEY,              -- Unique identifier
  user_id UUID NOT NULL,            -- References auth.users(id)
  title TEXT NOT NULL,              -- Note title
  content TEXT,                     -- Markdown content
  created_at TIMESTAMP,             -- Creation date
  updated_at TIMESTAMP              -- Last modification date
);
```

### Row Level Security (RLS)

RLS ensures that users can only access their own notes:

- **SELECT**: Users can only view notes where `user_id` matches their auth ID
- **INSERT**: Users can only create notes with their own `user_id`
- **UPDATE**: Users can only update their own notes
- **DELETE**: Users can only delete their own notes

## Troubleshooting

### Issue: "Missing Supabase environment variables"

**Solution**: Make sure your `.env` file exists in the project root and contains the correct values.

### Issue: "Cannot read from table notes"

**Solution**: 
1. Verify that the SQL script was executed successfully
2. Check that Row Level Security policies are in place
3. Ensure you're signed in with a valid user account

### Issue: Email confirmation required

**Solution**: 
- Check your email for the confirmation link, or
- Disable email confirmations in development (see Step 5)

### Issue: "Failed to create account"

**Solution**:
1. Check that email authentication is enabled in Supabase
2. Verify your environment variables are correct
3. Check browser console for detailed error messages

## Security Best Practices

1. ✅ **Never share your `service_role` key** - Only use the `anon` key in your frontend
2. ✅ **Keep `.env` file out of version control** - Already configured in `.gitignore`
3. ✅ **Enable email confirmations in production**
4. ✅ **Use strong passwords** for user accounts
5. ✅ **Enable RLS on all tables** - Already configured
6. ✅ **Regularly update dependencies** - Run `npm audit` periodically

## Next Steps

- 🚀 Deploy your app to production (Vercel, Netlify, etc.)
- 📧 Set up custom SMTP for production emails
- 📊 Monitor usage in Supabase dashboard
- 🎨 Customize the UI to match your brand
- 🔔 Add real-time features using Supabase Realtime

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [React + Supabase Tutorial](https://supabase.com/docs/guides/getting-started/tutorials/with-react)

---

Need help? Check the [Supabase Discord](https://discord.supabase.com/) or [GitHub Discussions](https://github.com/supabase/supabase/discussions)
