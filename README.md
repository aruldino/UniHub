# SAMS - Smart Academic Management System

A comprehensive academic management system for students, lecturers, and administrators.

## Features

- **Dashboard**: Real-time overview of academic progress.
- **User Management**: Admin-controlled user roles (Student, Lecturer, Admin).
- **Subject Management**: Manage courses and enrollments.
- **Attendance Tracking**: Mark and view attendance.
- **Assignments**: Create and submit assignments.
- **Analytics**: Academic performance insights.

## Technology Stack

- **Frontend**: React, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui
- **Backend/Auth**: Supabase
- **State Management**: TanStack Query (React Query)

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

1. Clone the repository:
   ```sh
   git clone <YOUR_GIT_URL>
   ```

2. Install dependencies:
   ```sh
   npm install
   ```

3. Create a `.env` file based on the provided configuration (Supabase URL and Key).

4. Start the development server:
   ```sh
   npm run dev
   ```

## Admin Setup

To create an administrator account:
1. Navigate to `/register`.
2. Enter your details.
3. Select **Admin** from the role dropdown.
4. Sign up and verify your email (if required by your Supabase configuration).
