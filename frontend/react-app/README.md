# React frontend for SEC Scanner

Quickstart:

1. cd frontend/react-app
2. npm install
3. npm run dev   # for development
4. npm run build # build production output to `dist`

The backend is configured to serve static build output from `frontend/react-app/dist` when available.

Notes:
- Uses Vite + React + TypeScript and react-cytoscapejs for graph visualization.
- After `npm run build`, start your FastAPI backend and open `/` to load the built app.
