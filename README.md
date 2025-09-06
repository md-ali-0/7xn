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
   - `MONGODB_URI`: Your MongoDB connection string (must start with mongodb:// or mongodb+srv://)
   - `SESSION_SECRET`: A secure secret for session encryption

## Running the Application

### Development
```bash
npm run dev
```

### Testing API Endpoints

To test the desktop application API endpoints:

1. Start the server:
   ```bash
   npm start
   ```

2. Use Postman or curl to test the endpoints:
   - **Login**: POST `http://localhost:3000/auth/api/login`
   - Make sure to set the Content-Type header to `application/json`
   - Send JSON body with `username`, `password`, and `device_id`

Example curl command:
```bash
curl -X POST http://localhost:3000/auth/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass","device_id":"device123"}'
```

## Environment Variables

You must set the following environment variables in your Vercel project settings:

| Variable | Description | Example |
|----------|-------------|---------|
| MONGODB_URI | MongoDB connection string (must start with mongodb:// or mongodb+srv://) | mongodb+srv://username:password@cluster.mongodb.net/database |
| SESSION_SECRET | Secret key for session encryption (at least 32 characters) | a-very-long-random-string |

To set these in Vercel:
1. Go to your project in the Vercel dashboard
2. Click on "Settings" → "Environment Variables"
3. Add each variable with its value
4. Redeploy your application

## MongoDB Connection String Format

The MONGODB_URI must be a valid MongoDB connection string:

### For MongoDB Atlas (Cloud):
```
mongodb+srv://<username>:<password>@<cluster-url>/<database-name>?retryWrites=true&w=majority
```

### For Local MongoDB:
```
mongodb://localhost:27017/<database-name>
```

### For MongoDB with Authentication:
```
mongodb://<username>:<password>@<host>:<port>/<database-name>
```

Important notes:
- The connection string must start with either `mongodb://` or `mongodb+srv://`
- Replace `<username>`, `<password>`, `<cluster-url>`, and `<database-name>` with your actual values
- For MongoDB Atlas, make sure your IP address is whitelisted in the Atlas dashboard

## API Endpoints

### Desktop Application Authentication
- **Login**: POST `/auth/api/login`
- **Verify Token**: POST `/auth/api/verify-token`
- **Logout**: POST `/auth/api/logout`

See [docs/api.md](docs/api.md) for detailed API documentation.

## Serverless Deployment Considerations

When deploying to Vercel's serverless environment:

1. **File System Access**: The application cannot write to the file system. All logging functionality that writes to files is automatically disabled in serverless environments.

2. **Persistent Storage**: All data must be stored in MongoDB or other external services. The application uses MongoDB for all persistent storage needs.

3. **Environment Detection**: The application automatically detects when it's running in a serverless environment and adjusts its behavior accordingly.

4. **Performance**: Serverless functions have execution time limits. The application is designed to be efficient within these constraints.

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