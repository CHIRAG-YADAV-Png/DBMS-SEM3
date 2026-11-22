KeyTag - free version (Node.js + PostgreSQL, deployable on Vercel)

1. Create a free PostgreSQL database on Aiven and copy its Service URI.
2. Import database/schema.sql into it.
3. Copy .env.example to .env, paste DATABASE_URL and set TOKEN_SECRET.
4. npm install, then npm start -> http://localhost:3000  (login: admin / admin123)
5. Push to GitHub (.env is ignored) and import the repo on vercel.com/new.
   Add DATABASE_URL and TOKEN_SECRET under Environment Variables, then Deploy.
