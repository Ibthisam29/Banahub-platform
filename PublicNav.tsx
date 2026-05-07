# ─── Server ──────────────────────────────────────────────────────────────────
NODE_ENV=development
PORT=5000

# ─── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL=mongodb+srv://<user>:<password>@cluster.mongodb.net/banahub?retryWrites=true&w=majority

# ─── Auth ─────────────────────────────────────────────────────────────────────
JWT_SECRET=your_super_secure_jwt_secret_min_32_chars
JWT_REFRESH_SECRET=your_super_secure_refresh_secret_min_32_chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ─── CORS ─────────────────────────────────────────────────────────────────────
CORS_ORIGIN=http://localhost:5173

# ─── Rate Limiting ────────────────────────────────────────────────────────────
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# ─── Logging ──────────────────────────────────────────────────────────────────
LOG_LEVEL=debug
