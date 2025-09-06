# Desktop Application API Documentation

## Overview
This API provides authentication endpoints for desktop applications.
Each user can only be logged in on one device at a time.
When a user logs in for the first time, their device is registered.
Subsequent logins must use the same device ID, or they will be rejected.

## Authentication Endpoints

### Login
**POST** `/auth/api/login`

Authenticate a user and receive a token for desktop application use.
Each user can only be logged in on one device at a time.

#### Request Body
```json
{
  "username": "username",
  "password": "userpassword",
  "device_id": "unique_device_identifier"
}
```

#### Response
```json
{
  "success": true,
  "message": "Login successful",
  "token": "generated_token_string",
  "user": {
    "id": "user_id",
    "username": "username",
    "email": "user@example.com",
    "role": "user",
    "isActive": true,
    "package": {
      "id": "package_id",
      "name": "Package Name",
      "emailCredits": 1000,
      "concurrencyLimit": 10
    },
    "packageEndDate": "2023-12-31T00:00:00.000Z"
  }
}
```

#### Error Responses
- 400: Validation failed
- 401: Invalid username or password
- 403: Account deactivated, package expired, or device mismatch
- 500: Server error

### Logout
**POST** `/auth/api/logout`

Logout a user from the desktop application and invalidate their token.

#### Request Body
```json
{
  "token": "generated_token_string"
}
```

#### Response
```json
{
  "success": true,
  "message": "Logout successful"
}
```

#### Error Responses
- 400: Token is required
- 401: Invalid or expired token
- 500: Server error

## Device Registration
Each user is registered to a specific device on their first successful login.
If a user attempts to log in from a different device, they will receive an error.
To allow a user to log in from a different device, an administrator must reset their device registration
through the admin panel.

## Usage Example

1. Login with username and device ID (first time):
```bash
curl -X POST http://localhost:3000/auth/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user123","password":"password123","device_id":"device-12345"}'
```

2. Logout:
```bash
curl -X POST http://localhost:3000/auth/api/logout \
  -H "Content-Type: application/json" \
  -d '{"token":"your_generated_token"}'
```