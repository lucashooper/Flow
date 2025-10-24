# Supabase Email Template Setup Instructions

## Quick Copy-Paste Templates

### 📧 Signup Confirmation Template

**Go to:** Supabase Dashboard → Authentication → Email Templates → "Confirm signup"

**Replace the template with this:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirm your signup</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 48px 40px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Welcome to Quill Notes</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 48px 40px;">
                            <h2 style="margin: 0 0 24px 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">Confirm your signup</h2>
                            <p style="margin: 0 0 24px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">Thank you for joining Quill Notes! We're excited to have you on board. To get started, please confirm your email address by clicking the button below.</p>
                            <div style="margin: 32px 0; text-align: center;">
                                <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">Confirm Your Email</a>
                            </div>
                            <p style="margin: 24px 0 0 0; color: #718096; font-size: 14px; line-height: 1.6;">If the button doesn't work, copy and paste this link into your browser:</p>
                            <p style="margin: 8px 0 0 0; color: #667eea; font-size: 14px; word-break: break-all;">{{ .ConfirmationURL }}</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f7fafc; padding: 32px 40px; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0 0 8px 0; color: #a0aec0; font-size: 13px; text-align: center;">This email was sent to you because you signed up for Quill Notes.</p>
                            <p style="margin: 0; color: #a0aec0; font-size: 13px; text-align: center;">© 2025 Quill Notes. All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
```

---

### 🔒 Password Reset Template

**Go to:** Supabase Dashboard → Authentication → Email Templates → "Reset Password"

**Replace the template with this:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset your password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 48px 40px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Quill Notes</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 48px 40px;">
                            <h2 style="margin: 0 0 24px 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">Reset Your Password</h2>
                            <p style="margin: 0 0 24px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">We received a request to reset your password for your Quill Notes account. If you didn't make this request, you can safely ignore this email.</p>
                            <p style="margin: 0 0 24px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">To reset your password, click the button below:</p>
                            <div style="margin: 32px 0; text-align: center;">
                                <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">Reset Password</a>
                            </div>
                            <p style="margin: 24px 0 0 0; color: #718096; font-size: 14px; line-height: 1.6;">If the button doesn't work, copy and paste this link into your browser:</p>
                            <p style="margin: 8px 0 0 0; color: #667eea; font-size: 14px; word-break: break-all;">{{ .ConfirmationURL }}</p>
                            <div style="margin-top: 32px; padding: 16px; background-color: #fef5e7; border-left: 4px solid #f39c12; border-radius: 4px;">
                                <p style="margin: 0; color: #7d6608; font-size: 14px; line-height: 1.5;"><strong>Security Note:</strong> This link will expire in 1 hour for your security. If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f7fafc; padding: 32px 40px; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0 0 8px 0; color: #a0aec0; font-size: 13px; text-align: center;">This email was sent to you because a password reset was requested for your account.</p>
                            <p style="margin: 0; color: #a0aec0; font-size: 13px; text-align: center;">© 2025 Quill Notes. All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
```

---

## ⚙️ Configuration Steps

### Step 1: Access Supabase Dashboard
1. Go to https://supabase.com/dashboard/project/oetxqcyktahczrqrxlds
2. Navigate to **Authentication** in the left sidebar
3. Click on **Email Templates**

### Step 2: Update "Confirm signup" Template
1. Find the "Confirm signup" template
2. Click **Edit**
3. **Delete all existing HTML**
4. Copy and paste the Signup Confirmation Template above
5. Click **Save**

### Step 3: Update "Reset Password" Template
1. Find the "Reset Password" template  
2. Click **Edit**
3. **Delete all existing HTML**
4. Copy and paste the Password Reset Template above
5. Click **Save**

### Step 4: Test Your Templates
1. Try signing up with a test email
2. Check if the email looks professional
3. Click the confirmation button to verify it works

---

## 🎨 Customization Options

### Change Colors
Replace the gradient colors in both templates:
```css
background: linear-gradient(135deg, #YOUR_COLOR_1 0%, #YOUR_COLOR_2 100%);
```

Current gradient: Purple to blue (`#667eea` to `#764ba2`)

### Add Your Logo
If you want to add the Flow icon to emails:
1. Upload `Flow-icon.webp` to Supabase Storage
2. Make the bucket public
3. Get the public URL
4. Add this after the opening `<td>` in the header section:
```html
<img src="YOUR_PUBLIC_URL" alt="Quill Notes" width="64" height="64" style="display: block; margin: 0 auto 20px;" />
```

### Modify Text
Simply edit the text between the `<p>` tags in the templates.

---

## ✅ Verification

After setup, verify:
- [ ] Signup emails have the new template
- [ ] Password reset emails have the new template  
- [ ] Buttons are clickable and work correctly
- [ ] Templates display correctly on mobile
- [ ] All text is readable
- [ ] Colors match your brand

---

**Pro Tip:** Test your templates by signing up with a disposable email service like temp-mail.org to see how they look!
