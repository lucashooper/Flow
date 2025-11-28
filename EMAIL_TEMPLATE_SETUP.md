# Premium Email Template Setup

## 📧 How to Update Your Supabase Email Template

### Step 1: Access Email Templates
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your Flow project
3. Click **Authentication** in the left sidebar
4. Click **Email Templates**
5. Select **Confirm signup** template

### Step 2: Replace the Template
1. Open the file: `email-template-premium.html`
2. Copy **ALL** the contents
3. Paste into the Supabase email template editor
4. Click **Save**

---

## 🎨 What's New in This Template

### Premium Design Features
- ✅ **Dark background** (`#0d0d0d`) matching Flow's branding
- ✅ **Glass-morphism card** with subtle gradient and blur
- ✅ **Flow logo** with orange glow and shadow
- ✅ **Orange gradient button** matching the app
- ✅ **Responsive design** - works on mobile and desktop
- ✅ **Outlook compatible** - uses table-based layout
- ✅ **Security note** with expiration info
- ✅ **Alternative link** for users with button issues

### Logo Reference
The template uses: `{{ .SiteURL }}/Flow-icon.webp`

This automatically references your Flow logo from your site URL. Make sure:
- Your `Flow-icon.webp` file is in the `public` folder
- Your site is deployed (or use localhost for testing)

**Alternative:** If the logo doesn't show, you can:
1. Upload `Flow-icon.webp` to Supabase Storage
2. Get the public URL
3. Replace `{{ .SiteURL }}/Flow-icon.webp` with the full URL

---

## 🔧 Customization Options

### Change Colors
Find and replace these hex codes:

- **Orange primary:** `#ff7a18` → your color
- **Orange secondary:** `#ffb347` → your color
- **Background:** `#0d0d0d` → your color
- **Text primary:** `#e5e5e5` → your color
- **Text secondary:** `#a0a0a0` → your color

### Change Button Text
Find: `Verify Email Address`
Replace with your preferred text

### Change Heading
Find: `Welcome to Flow`
Replace with your preferred heading

### Change Subheading
Find: `You're one step away from your calm, focused workspace...`
Replace with your preferred message

---

## 📱 Testing the Email

### Test Locally
1. Sign up with a test email
2. Check your inbox
3. Verify the email looks correct
4. Click the verify button
5. Confirm it redirects properly

### Common Issues

**Logo not showing?**
- Check if `Flow-icon.webp` is in the `public` folder
- Try using the full URL instead of `{{ .SiteURL }}`
- Upload to Supabase Storage and use that URL

**Colors look different?**
- Some email clients don't support gradients
- The template has fallback solid colors
- Test in Gmail, Outlook, and Apple Mail

**Button not clickable?**
- Make sure you saved the template in Supabase
- Check that `{{ .ConfirmationURL }}` is present
- Verify your Supabase auth settings

---

## 🎯 Supabase Template Variables

These are automatically replaced by Supabase:

- `{{ .SiteURL }}` - Your site URL
- `{{ .ConfirmationURL }}` - The verification link
- `{{ .Token }}` - The verification token (if needed)
- `{{ .Email }}` - The user's email (if needed)

**Do NOT remove** `{{ .ConfirmationURL }}` - this is required for the verification link!

---

## 📋 Checklist

Before going live:

- [ ] Copied entire template to Supabase
- [ ] Saved the template in Supabase
- [ ] Tested with a real signup
- [ ] Verified logo shows correctly
- [ ] Clicked the verify button successfully
- [ ] Checked email on mobile device
- [ ] Checked email in different clients (Gmail, Outlook, etc.)

---

## 🚀 After Setup

Once you've updated the template:

1. **Test it:** Sign up with a test account
2. **Check spam:** Make sure emails aren't going to spam
3. **Verify mobile:** Check how it looks on mobile
4. **Update other templates:** Consider updating password reset, magic link, etc. with the same design

---

## 💡 Pro Tips

### Improve Deliverability
- Set up SPF, DKIM, and DMARC records
- Use a custom domain for emails
- Warm up your sending domain gradually

### Personalization
You can add the user's name by using `{{ .Data.username }}` if you pass it during signup.

### Other Templates
Apply the same design to:
- **Password Reset** - `Reset your Flow password`
- **Magic Link** - `Sign in to Flow`
- **Email Change** - `Confirm your new email`

---

## Summary

1. ✅ Copy `email-template-premium.html` contents
2. ✅ Paste into Supabase → Authentication → Email Templates → Confirm signup
3. ✅ Save the template
4. ✅ Test with a signup
5. ✅ Verify logo and button work correctly

Your emails will now match Flow's premium dark aesthetic! 🎨✨
