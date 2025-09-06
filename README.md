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
   - `MONGODB_URI`: Your MongoDB connection string (you can use MongoDB Atlas for a cloud database)
   - `SESSION_SECRET`: A strong, random secret key for session encryption
4. Deploy the project

The application will be available at your Vercel URL.

## Environment Variables

You must set the following environment variables in your Vercel project settings:

| Variable | Description | Example |
|----------|-------------|---------|
| MONGODB_URI | MongoDB connection string | mongodb+srv://user:pass@cluster.mongodb.net/db |
| SESSION_SECRET | Secret key for session encryption | a-very-long-random-string |

To set these in Vercel:
1. Go to your project in the Vercel dashboard
2. Click on "Settings" → "Environment Variables"
3. Add each variable with its value
4. Redeploy your application

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