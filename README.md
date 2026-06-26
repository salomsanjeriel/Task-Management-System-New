# Task Management System (TMS)

A robust and real-time Task Management System designed to streamline team collaboration, project tracking, and workflow management. Built with a modern tech stack featuring React, Node.js, Express, and PostgreSQL (via Prisma).

## 🚀 Features

- **Role-Based Access Control (RBAC):**
  - **Administrators**: Manage system-wide users, roles, and settings.
  - **Project Managers**: Create projects, assign tasks, and monitor progress.
  - **Collaborators**: View assigned tasks, update task statuses, and add comments.
- **Real-Time Collaboration:** Powered by Socket.io for instant task updates and notifications without page reloads.
- **Automated Email Notifications:** Sends transactional emails (via Nodemailer) for account creation, task assignments, status changes, and upcoming deadlines.
- **Drag & Drop Task Board:** Intuitive Kanban-style board for dragging tasks across different statuses (Powered by `@hello-pangea/dnd`).
- **Secure Authentication:** JWT-based login with enforced password resets for newly created user accounts.
- **File Uploads:** Upload and attach files/documents to projects and tasks.

## 🛠️ Technology Stack

### Frontend
- **Framework:** React 19 (via Vite)
- **Routing:** React Router v7
- **Styling:** CSS Modules
- **State/API:** Axios for data fetching
- **Real-time:** Socket.io-client
- **UI Interactions:** `@hello-pangea/dnd` for drag-and-drop

### Backend
- **Runtime:** Node.js (v25)
- **Framework:** Express.js
- **Database:** PostgreSQL (hosted on Supabase)
- **ORM:** Prisma
- **Authentication:** JSON Web Tokens (JWT) & bcrypt
- **File Uploads:** Multer
- **Email:** Nodemailer (SMTP)
- **Real-time:** Socket.io

## 📦 Project Structure

```text
Task-Management-System-New/
├── backend/                  # Express.js REST API
│   ├── prisma/               # Database schema and migrations
│   ├── src/
│   │   ├── controllers/      # Route handlers
│   │   ├── routes/           # API endpoints routing
│   │   ├── sockets/          # Socket.io event handlers
│   │   └── utils/            # Helpers (email, deadline checking, etc.)
│   └── .env                  # Backend environment variables
│
└── frontend/                 # React Vite application
    ├── src/
    │   ├── assets/           # Images and static files
    │   ├── components/       # Reusable UI components
    │   ├── context/          # React Context (Auth)
    │   ├── layouts/          # Page layouts (Sidebar, Header)
    │   ├── pages/            # Application views (Dashboard, Login, Tasks)
    │   ├── routes/           # Protected routing logic
    │   └── services/         # API and Socket connections
    └── .env                  # Frontend environment variables
```

## ⚙️ Setup and Installation

### Prerequisites
- Node.js installed on your machine
- A PostgreSQL database instance (e.g., Supabase, Heroku, or local)
- An SMTP Email account (e.g., Gmail with App Passwords enabled)

### 1. Clone the repository
```bash
git clone <repository-url>
cd Task-Management-System-New
```

### 2. Backend Setup
```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory with the following variables:
```env
PORT=5000
DATABASE_URL="postgresql://user:password@host:port/dbname"
DIRECT_URL="postgresql://user:password@host:port/dbname"
JWT_SECRET=your_jwt_secret_key

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM="TaskFlow Team" <your_email@gmail.com>

FRONTEND_URL=http://localhost:5173
```

Push the Prisma schema to your database and start the server:
```bash
npx prisma db push
npm run dev
```

### 3. Frontend Setup
Open a new terminal window:
```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend/` directory with the following variables:
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

Start the frontend development server:
```bash
npm run dev
```

## 📧 Email Configuration
For the automated email system to work correctly, you must configure a valid SMTP server in the backend `.env` file. If using Gmail, you must generate an **App Password** from your Google Account settings (requires 2-Factor Authentication to be enabled). 
If the SMTP credentials are not provided or invalid, the backend will fallback to logging a `[MOCK EMAIL]` output in the console.

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page.