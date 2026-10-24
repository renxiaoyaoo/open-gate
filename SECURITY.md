# Security

Never publish phone numbers, one-time codes, provider sessions, upstream endpoints, signing keys, hardware addresses, deployment credentials, full provider responses, or captured application artifacts.

Sessions are encrypted with AES-256-GCM. Phone numbers are represented by a keyed HMAC fingerprint and a display mask. Removing an account deletes its session and cached doors.

OpenGate deliberately leaves authentication to the deployment boundary. Put it behind an identity-aware proxy, API gateway, VPN, or equivalent access control before exposing it to the internet. Report vulnerabilities through a private GitHub Security Advisory.
