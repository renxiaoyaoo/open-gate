# OpenGate architecture

```text
Web UI / OpenAPI clients
          |
 optional external authentication
          |
 account service + aggregate door service + audit service
          |                         |
 encrypted provider sessions       opaque public door IDs
          \_________________________/
                       |
              storage interface
              /               \
     Cloudflare D1       Node.js SQLite
                       |
              provider adapter
```

The domain layer depends on two ports: storage and an upstream provider adapter. Cloudflare-specific bindings exist only in `worker.ts` and `deploy/cloudflare`; normal Node.js uses the built-in SQLite adapter. Provider endpoints and protocol material are injected at runtime.

Every client uses the same interface and can add, list, or remove accounts. Account results expose only an opaque ID and display name. Door results never expose account ownership, upstream IDs, hardware addresses, or signing inputs.

Sessions are encrypted with AES-256-GCM. Mobile numbers are retained only as an HMAC fingerprint and a display mask. Removing an account deletes its encrypted session and cached doors through foreign-key cascades.
