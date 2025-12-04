# jPulse MFA Plugin

Multi-factor authentication plugin for jPulse Framework using TOTP (Time-based One-Time Password).

## Status

**Version 0.5.0** - Configuration scaffold only. MFA functionality coming in v1.0.0.

## Features (Planned for v1.0.0)

- 🔐 **TOTP Authentication**: Works with Google Authenticator, Authy, Microsoft Authenticator
- 🔑 **Backup Codes**: Single-use recovery codes for account access
- 📋 **Flexible Policy**: Optional, required for specific roles, or required for all users
- 🛡️ **Security**: Lockout protection, configurable attempt limits
- 🚀 **Easy Setup**: QR code enrollment, guided setup flow

## Requirements

- jPulse Framework >= 1.3.8
- W-106: Plugin CLI management (for installation)

## Installation

```bash
# Install via jPulse CLI
npx jpulse plugin install auth-mfa

# Configure in Admin UI
# Navigate to /admin/plugins/auth-mfa
```

## Configuration

Configure via Admin UI at `/admin/plugins/auth-mfa`:

### Policy Tab
- **MFA Policy**: Optional, required for roles, or required for all
- **Required Roles**: Which roles must have MFA (when policy is role-based)
- **Grace Period**: Days before enforcement kicks in

### Security Tab
- **Issuer Name**: Displayed in authenticator apps
- **Max Failed Attempts**: Lockout threshold
- **Lockout Duration**: Minutes to lock after max attempts

### Advanced Tab
- **Backup Codes Count**: Number of recovery codes
- **Code Validity Window**: TOTP time tolerance

## License

BSL-1.1 - See LICENSE file

## Author

jPulse Team <team@jpulse.net>
