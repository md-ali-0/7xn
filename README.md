# Gmail Checker Authentication Server

A comprehensive Node.js authentication server built with Express, EJS, and MongoDB for the Gmail Checker application.

## Features

- Secure user authentication and session management
- Admin dashboard for user and package management
- Three-tier package system (Free, Premium, Enterprise)
- Enhanced security features (rate limiting, CSRF protection, password hashing)
- Responsive design with clean styling
- Device registration and management for desktop applications

## Prerequisites

- Node.js v16 or higher
- MongoDB (local or Atlas)
- npm or yarn

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   
   Edit the `.env` file with your configuration:
   - `MONGODB_URI`: Your MongoDB connection string
   - `SESSION_SECRET`: A secure secret for session encryption

## Running the Application

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

## Deployment to Vercel

1. Create a new project on Vercel
2. Connect your GitHub repository
3. Set the following environment variables in Vercel:
   - `MONGODB_URI`: Your MongoDB connection string
   - `SESSION_SECRET`: A secure secret for session encryption
4. Deploy the project

The application will be available at your Vercel URL.

## API Documentation

See [docs/api.md](docs/api.md) for detailed API documentation.

## Security Features

- Password hashing with bcryptjs
- CSRF protection
- Rate limiting
- Input validation
- Secure HTTP-only cookies
- Content Security Policy
- MongoDB injection protection

## License

ISC
