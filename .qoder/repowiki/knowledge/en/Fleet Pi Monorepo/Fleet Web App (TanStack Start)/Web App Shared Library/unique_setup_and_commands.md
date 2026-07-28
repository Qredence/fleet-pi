No unified command — each subdirectory is imported directly by the web app; development logging uses pino-pretty only when NODE_ENV is not production and not running on Vercel or Neon Functions.
