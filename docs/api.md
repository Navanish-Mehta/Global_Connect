# Global Connect API

Base URL (local): `http://localhost:5000/api`

Auth: JWT via `Authorization: Bearer <token>` on protected endpoints.

## Auth
- POST `/api/auth/register` — body: { name, email, password }
- POST `/api/auth/login` — body: { email, password } — returns { token, user }

## Users
- GET `/api/users` [auth] — list non-admin users (paginated)
- GET `/api/users/admin` [admin] — list all users (exclude self)
- GET `/api/users/connections` [auth]
- GET `/api/users/:id` [public]
- GET `/api/users/:id/connections` [public]
- POST `/api/users/connect/:id` [auth]
- PUT `/api/users/connect/:id` [auth] — body: { action: 'accept' | 'reject' }

## Messages
- POST `/api/messages` [auth] — body: { receiverId, content, messageType? }
- GET `/api/messages/conversations` [auth]
- GET `/api/messages/conversation/:userId` [auth]
- PUT `/api/messages/conversation/:userId/read` [auth]

## Posts
- GET `/api/posts` [public]
- POST `/api/posts` [auth]
- PUT `/api/posts/:id` [auth]
- DELETE `/api/posts/:id` [auth]

## Jobs
- GET `/api/jobs` [public]
- GET `/api/jobs/:id` [public]
- POST `/api/jobs` [auth]
- POST `/api/jobs/:id/apply` [auth] — multipart form: resume (File, optional), coverLetter (string)
- GET `/api/jobs/:id/applications` [admin]

## Notifications
- GET `/api/notifications` [auth]

Response formats follow `{ message, ...data }` patterns across routes. See Postman collection for detailed samples.
