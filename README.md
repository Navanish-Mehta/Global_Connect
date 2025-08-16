# Global Connect

Modern MERN social platform to connect, chat, and apply to jobs. Real-time messaging with Socket.io, rich profiles, posts, notifications, and job applications.

## Screenshot
### Home Page
<img width="1920" height="1080" alt="Screenshot (262)" src="https://github.com/user-attachments/assets/0bea75a4-fd0e-40bb-83eb-a70d49920337" />

### Admin Dashboard
<img width="1920" height="1080" alt="Screenshot (263)" src="https://github.com/user-attachments/assets/82d2589c-af0d-43f8-b530-ce06a6319a8a" />

### Post Page
<img width="1920" height="1080" alt="Screenshot (264)" src="https://github.com/user-attachments/assets/08b5512f-b2d9-4f7a-8ed9-69c9517d3f4b" />

### Network Page
<img width="1920" height="1080" alt="Screenshot (265)" src="https://github.com/user-attachments/assets/edf27072-db0b-47da-89b3-55bddc79913c" />

### Jobs Page
<img width="1920" height="1080" alt="Screenshot (266)" src="https://github.com/user-attachments/assets/361641cd-21ba-46a5-a8e6-61f1884e6fca" />
### Message Page
<img width="1920" height="1080" alt="Screenshot (267)" src="https://github.com/user-attachments/assets/090458f7-7c5e-4a1d-8029-967fa279a0ab" />

### Profile Page
<img width="1920" height="1080" alt="Screenshot (268)" src="https://github.com/user-attachments/assets/2ff6eaf5-01cc-44d1-97e4-2db9d480bf22" />

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
Navanish Mehta❤️

