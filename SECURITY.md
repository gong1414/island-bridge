# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it by:

1. **Do NOT** open a public issue
2. Email the maintainer or use GitHub's private vulnerability reporting
3. Include detailed steps to reproduce the issue
4. Allow reasonable time for a fix before public disclosure

## Security Best Practices

When using Island Bridge:

- Keep your SSH private keys secure with proper permissions (0600)
- Use SSH key authentication instead of passwords
- Review the `--insecure` flag carefully before using it
- Keep the tool updated to the latest version
- Protect your `.island-bridge.json` config file (contains server info)

## Response Timeline

- **Initial Response**: Within 48 hours
- **Fix Timeline**: Depends on severity, typically within 7-30 days
- **Disclosure**: Coordinated disclosure after fix is released

Thank you for helping keep Island Bridge secure!

