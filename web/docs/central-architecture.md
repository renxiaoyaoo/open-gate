# OpenHome architecture

```text
Web shell / native OpenHome clients
          |
 deployment access boundary (for example Cloudflare Zero Trust)
          |
 module use cases (OpenGate, OpenDevice, future modules)
          |                         |
 stable domain models       shared security/audit primitives
          \_________________________/
                       |
          storage ports + provider adapters
              /                       \
     Cloudflare D1 / SQLite      provider bundle
```

The Web shell owns navigation and shared presentation behavior; it does not own
provider protocol. Each module exposes stable use cases and domain types through
its adapter. Shared storage, encryption, error handling, and deployment code are
reused rather than copied. Cloudflare-specific bindings remain in the Worker and
deployment adapter; Node.js uses SQLite.

Provider endpoints and compatibility material arrive as one schema-versioned
runtime bundle. A private configuration service may supply that bundle during
deployment, but it is not in the daily request path. Account and device traffic
travels directly from the user's OpenHome deployment to the configured provider.

Every client uses the same interface and can add, list, or remove accounts. Account results expose only an opaque ID and display name. Door results never expose account ownership, upstream IDs, hardware addresses, or signing inputs.

Native clients select one provider implementation per upstream account:

```text
module UI -> unified module provider -> RemoteOpenHomeProvider -> OpenHome API
                              `------> LocalProvider -> provider from this device
```

Remote mode keeps upstream sessions, cached resources, preferences, and audit
records in D1 or SQLite so several clients can share one center. Local mode does
not call the OpenHome database and keeps its upstream session in platform secure
storage. The same upstream account must not be active in both modes when the
provider enforces single-session login. The current Web deployment may rely on
its deployment access boundary; native remote access will require revocable
per-device credentials before release.

Sessions are encrypted with AES-256-GCM. Mobile numbers are retained only as an
HMAC fingerprint and a display mask. Removing an account deletes its encrypted
session and cached resources through foreign-key cascades. The encryption key is
deployment identity and must survive ordinary releases; browser login cookies
remain hostname-scoped and require an explicit migration or reauthentication
when the hostname changes.

State-changing adapter calls validate input, suppress accidental duplicates,
map upstream failures into stable errors, and read state back when the provider
supports it. UI scheduling uses a desired start time; any upstream delay or
completion-time representation is an adapter concern.
