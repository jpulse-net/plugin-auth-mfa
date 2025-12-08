# jPulse Framework / Plugins / Auth-MFA / README v1.0.0

Multi-factor authentication plugin for jPulse Framework using TOTP (Time-based One-Time Password).

## Features

- 🔐 **TOTP Authentication** - Works with any authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.)
- 🔑 **Backup Codes** - 10 single-use recovery codes generated during setup
- ⚙️ **Flexible Policy** - Optional, required for all, or required for specific roles
- 🛡️ **Account Lockout** - Protection against brute force attacks
- 📱 **QR Code Setup** - Easy enrollment via QR code scanning

## Installation

```bash
npx jpulse plugin install auth-mfa --registry=https://npm.pkg.github.com
npx jpulse plugin enable auth-mfa
```

## Configuration

Configure via Admin UI at `/admin/plugins/auth-mfa` or via plugin config API.

### Policy Options

| Policy | Description |
|--------|-------------|
| `optional` | Users can choose to enable MFA |
| `required-for-roles` | MFA required for specified roles |
| `required` | MFA required for all users |

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `mfaPolicy` | `optional` | MFA enforcement policy |
| `requiredRoles` | `['root']` | Roles that must have MFA |
| `gracePeriodDays` | `7` | Days to allow login without MFA after policy change |
| `issuerName` | `jPulse` | Name shown in authenticator apps |
| `maxFailedAttempts` | `5` | Lock account after this many failures |
| `lockoutDuration` | `15` | Lockout duration in minutes |
| `backupCodeCount` | `10` | Number of backup codes to generate |

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/1/auth-mfa/status` | User | Get MFA status |
| POST | `/api/1/auth-mfa/setup` | User | Start enrollment |
| POST | `/api/1/auth-mfa/verify-setup` | User | Complete enrollment |
| POST | `/api/1/auth-mfa/verify` | None | Verify during login |
| POST | `/api/1/auth-mfa/disable` | User | Disable MFA |
| POST | `/api/1/auth-mfa/backup-codes` | User | Regenerate backup codes |
| POST | `/api/1/auth-mfa/verify-backup` | None | Verify backup code |

## Views

| Path | Purpose |
|------|---------|
| `/auth/mfa-setup` | MFA enrollment page |
| `/auth/mfa-verify` | MFA verification during login |
| `/admin/auth-mfa` | Admin MFA management |

## User Schema Extension

This plugin extends the user schema with:

```javascript
{
    mfa: {
        enabled: Boolean,
        method: 'totp',
        secret: String (encrypted),
        backupCodes: Array (hashed),
        enrolledAt: Date,
        lastUsedAt: Date,
        failedAttempts: Number,
        lockedUntil: Date,
        gracePeriodUntil: Date
    }
}
```

## Hooks Used

| Hook | Purpose |
|------|---------|
| `authAfterPasswordValidationHook` | Check if MFA is required |
| `authValidateMfaHook` | Validate TOTP code |
| `authOnMfaSuccessHook` | Record successful verification |
| `authOnMfaFailureHook` | Handle failed attempts |

## Security

- TOTP secrets are encrypted using AES-256-GCM
- Backup codes are stored as SHA-256 hashes
- Constant-time comparison for code verification
- Account lockout after configurable failed attempts

## Requirements

- jPulse Framework >= 1.3.8
- Node.js >= 18.0.0

## Dependencies

- `otplib` - TOTP generation and validation
- `qrcode` - QR code generation for enrollment

## License

BSL-1.1 - See LICENSE file

## Author

jPulse Team <team@jpulse.net>
