# Global Connect

Modern MERN social platform to connect, chat, and apply to jobs. Real-time messaging with Socket.io, rich profiles, posts, notifications, and job applications.

## Tech Stack
- Frontend: React, Redux Toolkit, Tailwind CSS
- Backend: Node.js, Express, MongoDB (Mongoose)
- Realtime: Socket.io
- Auth: JWT (access token via Authorization: Bearer)
- Storage: Cloudinary (media, resumes as raw)

## Features
- Authentication (register/login), profile, connections
- Real-time 1:1 messaging with read receipts
- Posts, likes, comments, notifications
- Jobs listing and applications (resume upload + cover letter)
- Role-based access (admin/user)

## Local Setup
```bash
git clone https://github.com/Navanish-Mehta/Global_Connect.git
cd Global_Connect

# Server
cd server
npm install
cp config.env .env  # or create .env; set env vars listed below
npm start

# Client (new terminal)
cd ../client
npm install
npm start
```

### Environment variables
Create `server/.env` with:
```
PORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
CLIENT_URL=http://localhost:3000
```

Create `client/.env` with:
```
REACT_APP_API_URL=http://localhost:5000/api
```

## Deployment

### Backend → Render
1. Push repo to GitHub
2. On Render, create a new Web Service and select this repo
3. Root directory: `server`
4. Build Command: `npm install`
5. Start Command: `node index.js`
6. Environment: add the server `.env` vars above
7. Set Health Check Path to `/health` (optional if you add one)

Alternative (Docker): Add service from Docker using `server/Dockerfile`.

### Frontend → Vercel
1. Import the repo in Vercel
2. Framework preset: React
3. Root directory: `client`
4. Build command: `npm run build`
5. Output directory: `build`
6. Environment variable: `REACT_APP_API_URL` → your Render backend base URL (e.g., `https://your-service.onrender.com/api`)

## API Documentation
- Postman collection: `docs/global_connect_api.postman_collection.json`
- Endpoint list: `docs/api.md`

## Architecture Overview
See docs diagrams and notes in `docs/`.

## License
MIT License © 2025 Navanish Mehta
See [LICENSE](./LICENSE)

## Author
Navanish Mehta

