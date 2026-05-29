# Resend SMTP Configuration for Supabase

Based on your Resend domain verification (flow-notes.app), here are the SMTP settings for Supabase:

## Supabase Custom SMTP Settings

### Sender Details
- **Sender email address**: `noreply@flow-notes.app`
  - (or any email you want, like `hello@flow-notes.app`)
- **Sender name**: `Flow`

### SMTP Provider Settings
- **Host**: `smtp.resend.com`
- **Port number**: `465`
  - (Use 465 for SSL/TLS, or 587 for STARTTLS)
- **Minimum interval per user**: `60` seconds
  - (This prevents spam - users can only receive 1 email per minute)

### Credentials
- **Username**: `resend`
  - (This is always "resend" for Resend SMTP)
- **Password**: `YOUR_RESEND_API_KEY`
  - (Use your Resend API key from: https://resend.com/api-keys)
  - Example format: `re_xxxxxxxxxxxxxxxxxxxxx`

## Steps to Configure

1. Go to Supabase SMTP settings:
   https://supabase.com/dashboard/project/YOUR_PROJECT_ID/settings/auth

2. Scroll to "SMTP Settings" section

3. Toggle "Enable custom SMTP" to ON

4. Fill in all the fields above

5. Click "Save"

## Important Notes

- Make sure your Resend domain (flow-notes.app) is verified (✓ Verified in your screenshot)
- The API key must have "Sending access" permissions
- Test by sending a signup email after configuration
- Resend has a free tier: 100 emails/day, 3,000 emails/month

## After Configuration

Your emails will be sent through Resend instead of Supabase's default provider, which means:
- ✅ Better deliverability
- ✅ Your custom domain (flow-notes.app)
- ✅ Professional sender address
- ✅ Email analytics in Resend dashboard
