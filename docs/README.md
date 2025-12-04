# MFA Plugin Documentation

## Overview

The auth-mfa plugin adds Time-based One-Time Password (TOTP) multi-factor authentication to jPulse Framework.

## Current Version: 0.5.0 (Scaffold)

This version contains only the plugin configuration schema. Full MFA functionality will be available in v1.0.0.

## Planned Features (v1.0.0)

### For Users

1. **MFA Enrollment**
   - Scan QR code with authenticator app
   - Enter verification code to confirm setup
   - Receive backup codes for recovery

2. **MFA Login**
   - Enter password as usual
   - Enter 6-digit code from authenticator app
   - Option to use backup code if phone unavailable

3. **MFA Management**
   - View MFA status in profile
   - Regenerate backup codes
   - Disable MFA (may require admin approval)

### For Administrators

1. **Policy Configuration**
   - Set MFA as optional, required for roles, or required for all
   - Configure grace period for policy changes
   - Set lockout thresholds

2. **User Management**
   - View MFA status for all users
   - Reset user's MFA in emergencies
   - View MFA adoption metrics

## Configuration Reference

See plugin.json for full configuration schema. Key settings:

| Setting | Default | Description |
|---------|---------|-------------|
| mfaPolicy | optional | MFA enforcement level |
| requiredRoles | [root] | Roles requiring MFA |
| gracePeriodDays | 7 | Days before enforcement |
| issuerName | jPulse | Name in authenticator app |
| maxFailedAttempts | 5 | Lockout threshold |
| lockoutDuration | 15 | Lockout minutes |
| backupCodeCount | 10 | Recovery codes count |

## API Endpoints (v1.0.0)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/1/mfa/status | Get user's MFA status |
| POST | /api/1/mfa/setup | Start MFA enrollment |
| POST | /api/1/mfa/verify-setup | Verify during enrollment |
| POST | /api/1/mfa/verify | Verify during login |
| POST | /api/1/mfa/disable | Disable MFA |
| GET | /api/1/mfa/backup-codes | Get/regenerate backup codes |

## Security Considerations

- TOTP secrets are encrypted at rest
- Backup codes stored as bcrypt hashes
- Built-in lockout after failed attempts
- Root users exempt from enforcement until they set up MFA (bootstrap protection)
