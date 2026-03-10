#!/bin/bash
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
createdb lifehub 2>/dev/null || true
DATABASE_URL=postgresql://localhost:5432/lifehub npx drizzle-kit push
echo "✅ Base lifehub prête"
