# Authentication Server

A comprehensive Node.js authentication server built with Express, EJS, and MongoDB for the Gmail Checker application.

## Features

- **User Authentication**: Secure login/logout with session management
- **Admin Dashboard**: Complete user and package management interface
- **Package System**: Three-tier package system (Free, Premium, Enterprise)
- **Security**: Rate limiting, CSRF protection, password hashing, secure sessions
- **Responsive Design**: Mobile-friendly interface with clean styling

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Templating**: EJS (Embedded JavaScript)
- **Authentication**: bcryptjs, express-session
- **Security**: Helmet, CORS, express-rate-limit
- **Session Store**: connect-mongo

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local installation or MongoDB Atlas)
- npm or yarn

### Installation

1. Clone the repository:
\`\`\`bash
git clone <repository-url>
cd auth-server
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Set up environment variables:
\`\`\`bash
cp .env.example .env
\`\`\`

Edit `.env` with your configuration:
\`\`\`env
MONGODB_URI=mongodb://localhost:27017/auth-server
SESSION_SECRET=your-super-secret-session-key
PORT=3000
NODE_ENV=development
\`\`\`

4. Start the server:
\`\`\`bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
\`\`\`

5. Open your browser and navigate to `http://localhost:3000`

## Project Structure

\`\`\`
auth-server/
├── config/
│   └── db.js              # Database connection configuration
├── middleware/
│   └── auth.js            # Authentication middleware
├── models/
│   ├── User.js            # User model schema
│   └── Package.js         # Package model schema
├── public/
│   ├── css/
│   │   └── style.css      # Main stylesheet
│   └── js/
│       └── main.js        # Client-side JavaScript
├── routes/
│   ├── auth.js            # Authentication routes
│   ├── dashboard.js       # Dashboard routes
│   └── admin.js           # Admin management routes
├── views/
│   ├── partials/
│   │   ├── header.ejs     # Header partial
│   │   └── footer.ejs     # Footer partial
│   ├── layouts/
│   │   └── main.ejs       # Main layout template
│   ├── admin/
│   │   ├── users.ejs      # User management
│   │   ├── create-user.ejs
│   │   └── edit-user.ejs
│   ├── index.ejs          # Landing page
│   ├── login.ejs          # Login form
│   ├── dashboard.ejs      # User dashboard
│   └── error.ejs          # Error page
├── app.js                 # Main application file
├── package.json
└── README.md
\`\`\`

## Package System

### Available Packages

1. **Free Package**
   - 100 email validation credits per month
   - 5 concurrent validation limit
   - Basic features

2. **Premium Package**
   - 1,000 email validation credits per month
   - 20 concurrent validation limit
   - Advanced features

3. **Enterprise Package**
   - 10,000 email validation credits per month
   - 50 concurrent validation limit
   - All features included

### Admin User Management

Admins can:
- Create new users with assigned packages
- Set custom package validity dates
- Activate/deactivate user accounts
- Edit user information and package assignments
- Delete users
- Manage package definitions

## API Endpoints

### Authentication Routes
- `GET /auth/login` - Login form
- `POST /auth/login` - Handle login
- `POST /auth/logout` - Handle logout

### Dashboard Routes
- `GET /dashboard` - User/Admin dashboard

### Admin Routes
- `GET /admin/users` - List all users
- `GET /admin/users/create` - Create user form
- `POST /admin/users/create` - Handle user creation
- `GET /admin/users/edit/:id` - Edit user form
- `POST /admin/users/edit/:id` - Handle user update
- `POST /admin/users/delete/:id` - Delete user
- `GET /admin/packages` - Package management

## Security Features

- **Password Hashing**: bcryptjs with salt rounds
- **Session Security**: Secure HTTP-only cookies
- **Rate Limiting**: Protection against brute force attacks
- **CSRF Protection**: Built-in CSRF token validation
- **Input Validation**: Server-side validation with express-validator
- **Security Headers**: Helmet.js for HTTP security headers
- **CORS Configuration**: Controlled cross-origin requests

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/auth-server` |
| `SESSION_SECRET` | Secret key for session encryption | Required |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |

## Development

### Running in Development Mode

\`\`\`bash
npm run dev
\`\`\`

This starts the server with nodemon for automatic restarts on file changes.

### Database Seeding

The application will automatically create default packages on first run. To create an admin user, use the admin creation form or directly insert into the database.

### Testing

\`\`\`bash
npm test
\`\`\`

## Deployment

### Production Considerations

1. **Environment Variables**: Set all required environment variables
2. **MongoDB**: Use MongoDB Atlas or a production MongoDB instance
3. **Session Store**: Ensure MongoDB session store is properly configured
4. **Security**: Enable HTTPS and set secure cookie flags
5. **Process Management**: Use PM2 or similar for process management

### Example PM2 Configuration

\`\`\`json
{
  "name": "auth-server",
  "script": "app.js",
  "instances": "max",
  "exec_mode": "cluster",
  "env": {
    "NODE_ENV": "production",
    "PORT": 3000
  }
}
\`\`\`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For issues and questions:
1. Check the existing issues in the repository
2. Create a new issue with detailed information
3. Include error logs and environment details

## Changelog

### v1.0.0
- Initial release
- Basic authentication system
- Admin dashboard
- Package management
- Security features implemented
