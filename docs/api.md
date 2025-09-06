# Desktop Application API Documentation

## Authentication Endpoints

### Login
**POST** `/auth/api/login`

Authenticate a user and receive a token for desktop application use.

#### Request Body
```json
{
  "email": "user@example.com",
  "password": "userpassword"
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
- 401: Invalid email or password
- 403: Account deactivated or package expired
- 500: Server error

### Verify Token
**POST** `/auth/api/verify-token`

Verify if a token is still valid and get updated user information.

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
  "message": "Token is valid",
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
- 400: Token is required
- 401: Invalid or expired token
- 403: Account deactivated or package expired
- 500: Server error

## Usage Example

1. Login to get a token:
```bash
curl -X POST http://localhost:3000/auth/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

2. Use the token to verify authentication:
```bash
curl -X POST http://localhost:3000/auth/api/verify-token \
  -H "Content-Type: application/json" \
  -d '{"token":"your_generated_token"}'
```