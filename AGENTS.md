# get-temp-app

**Project:** TypeScript/Vite web application

## OVERVIEW
Full-stack IoT dashboard - serves HTML pages, handles MQTT, stores data in NeonDB.

## KEY FILES
| File | Purpose |
|------|---------|
| `src/main.ts` | HTTP + WebSocket server (144KB - monolithic) |
| `src/mqttService.ts` | MQTT client connection |
| `src/dataService.ts` | Database queries |
| `src/authService.ts` | bcrypt + JWT auth |
| `src/db.ts` | NeonDB client |

## STRUCTURE
- 11 HTML pages at root (non-standard)
- TypeScript in `src/`
- Tests in `test/`

## CONVENTIONS (DIFFERENT FROM ROOT)
- ES2023 target, strict mode enabled
- vitest for testing (not Jest)
- No unused locals warning

## ANTI-PATTERNS
- 11 HTML files at project root (`*.html`) - should be in `src/pages/`
- Single 144KB `main.ts` - no route separation

## COMMANDS
```bash
npm run dev      # Dev server
npm run build    # Build
npm run test    # Test
```

## NOTES
- NeonDB serverless for database
- MQTT over TLS (wss://...:8084/mqtt)
- WebSocket for real-time updates
- getReadings() always queries DB (no cache)

## RECENT CHANGES (Abril 2026)
- `getReadings()` sempre carrega do banco, não do cache em memória
- MQTT porta correta: 8084 (não 8884)
- MQTT usa rejectUnauthorized: false (dev)
- Filtro SQL para temp inválidas (null, 85°C, >125°C, <-55°C)
- Modal de registro e recuperação de senha no login