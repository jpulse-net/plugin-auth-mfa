# jPulse Docs / Installed Plugins / Auth-MFA Plugin v1.0.0

Detailed documentation for the jPulse MFA (Multi-Factor Authentication) plugin.

## Table of Contents

1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [User Guide](#user-guide)
4. [Administrator Guide](#administrator-guide)
5. [Troubleshooting](#troubleshooting)
6. [FAQ](#faq)

## Overview

The Auth-MFA plugin adds an extra layer of security to your jPulse application by requiring users to verify their identity using a time-based one-time password (TOTP) from an authenticator app.

### Supported Authenticator Apps

- Google Authenticator (iOS, Android)
- Microsoft Authenticator (iOS, Android)
- Authy (iOS, Android, Desktop)
- 1Password (iOS, Android, Desktop)
- Any TOTP-compatible app

## How It Works

### Login Flow with MFA

1. User enters username and password
2. If password is valid and MFA is enabled:
   - User is prompted for 6-digit TOTP code
   - Code is verified against their secret
   - If valid, login completes
   - If invalid, attempts are tracked
3. After too many failures, account is temporarily locked

### Enrollment Flow

1. User navigates to MFA setup page
2. Plugin generates a unique secret
3. User scans QR code with authenticator app
4. User enters verification code to confirm
5. Backup codes are generated and displayed
6. MFA is now enabled for the account

## User Guide

### Enabling MFA

1. Log in to your account
2. Go to your profile settings
3. Find the "Two-Factor Authentication" section
4. Click "Enable 2FA"
5. Scan the QR code with your authenticator app
6. Enter the 6-digit code from the app
7. **Save your backup codes** in a secure location

### Using MFA at Login

1. Enter your username and password
2. When prompted, open your authenticator app
3. Enter the 6-digit code shown for this site
4. Click "Verify"

### Using Backup Codes

If you lose access to your authenticator app:

1. On the MFA verification screen, click "Use a backup code"
2. Enter one of your backup codes (format: XXXX-XXXX)
3. The code is consumed and cannot be used again

**Important:** Each backup code can only be used once. After using several codes, consider regenerating new ones.

### Regenerating Backup Codes

1. Go to your profile settings
2. In the MFA section, click "New Backup Codes"
3. Your old codes are immediately invalidated
4. Save the new codes in a secure location

### Disabling MFA

1. Go to your profile settings
2. Click "Disable 2FA"
3. Enter your password to confirm
4. MFA is now disabled

**Note:** If MFA is required by policy, you cannot disable it.

## Administrator Guide

### Policy Configuration

Access plugin settings at `/admin/plugins/auth-mfa`.

#### MFA Policy Options

| Policy | Description |
|--------|-------------|
| **Optional** | Users can choose whether to enable MFA |
| **Required for Roles** | Specific roles must have MFA enabled |
| **Required for All** | All users must have MFA enabled |

#### Grace Period

When changing policy from "Optional" to "Required":
- Existing users get a grace period to set up MFA
- During grace period, they can still log in without MFA
- After grace period, MFA setup is mandatory

#### Security Settings

| Setting | Recommended | Description |
|---------|-------------|-------------|
| Max Failed Attempts | 5 | Lock account after this many failures |
| Lockout Duration | 15 min | How long to lock out |
| Code Validity Window | 1 | Accept codes ±30 seconds |

### Monitoring MFA Adoption

Access `/admin/auth-mfa` to see:
- Total users with MFA enabled
- Users who need to enable MFA
- Locked accounts
- Adoption rate

### Resetting User MFA

If a user loses access to their authenticator and backup codes:

1. Go to Admin → MFA Management
2. Find the user
3. Click "Reset MFA"
4. User can now set up MFA again

## Troubleshooting

### "Invalid code" errors

- Ensure your device's time is synchronized
- Try the next code (they change every 30 seconds)
- Check you're looking at the correct account in your app

### Account locked

- Wait for the lockout period to expire
- Contact an administrator to unlock your account
- After unlock, try logging in again

### Lost authenticator access

1. Use a backup code to log in
2. Set up MFA again with a new device
3. If no backup codes, contact administrator for MFA reset

### Time sync issues

TOTP codes are time-based. If codes aren't working:
- On mobile: Enable automatic time sync in device settings
- Ensure timezone is correct
- Some authenticator apps have a "time correction" feature

## FAQ

**Q: What if I get a new phone?**

Before switching phones:
1. Log in and go to MFA settings
2. Disable MFA on old phone
3. Re-enable on new phone
4. Or: Export accounts from old authenticator app to new one

**Q: Can I use multiple devices?**

When setting up MFA, you can scan the QR code with multiple devices. All devices will generate the same codes.

**Q: Are backup codes stored securely?**

Yes. Backup codes are stored as cryptographic hashes. Even if the database is compromised, the codes cannot be recovered—only verified.

**Q: What happens if the server time is wrong?**

The server administrator should ensure NTP time synchronization is enabled. Codes have a validity window of ±30 seconds by default.

**Q: Can admins see my MFA secret?**

No. MFA secrets are encrypted before storage. Administrators can reset your MFA (requiring you to set it up again) but cannot access your secret.

---

For technical details, see plugins/auth-mfa/README.md
