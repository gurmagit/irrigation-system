# Irrigation Control System

## Overview

The Irrigation Control System is a web application designed for managing and scheduling irrigation devices. It allows users to view, add, edit, and delete devices, as well as manage their schedules. The application provides real-time updates via WebSocket and ensures secure access through user authentication.

## Features

- **Device Management**: View, add, edit, and delete irrigation devices.
- **Scheduling**: Set and manage schedules for each device with start and end times.
- **Real-Time Updates**: Receive real-time notifications and updates using WebSocket.
- **User Authentication**: Secure access with login functionality and token-based authentication.

## Prerequisites

Before running the project, ensure you have the following installed:

- **Node.js** (v16 or later)
- **MongoDB** (v4.4 or later)
- **Angular CLI** (v15 or later)

## Installation

### Backend

1. Clone the repository:

   ```bash
   git clone <repository-url>
   ```

2. Navigate to the backend directory:

   ```bash
   cd server
   ```

3. Install the dependencies:

   ```bash
   npm install
   ```

4. Set up the environment variables. Create a `.env` file in the `backend` directory with the following content:

   ```env
   TOKEN_SECRET=<your-secret-key>
   ```

5. Start the server:

   ```bash
   npm start
   ```

### Frontend

1. Navigate to the frontend directory:

   ```bash
   cd client
   ```

2. Install the dependencies:

   ```bash
   npm install
   ```

3. Start the Angular application:

   ```bash
   ng serve
   ```

4. Open your browser and navigate to `http://localhost:4200` to view the application.

## Basic Functionality

### User Authentication

- **Login**: Users can log in using their username and password. On successful login, a token is stored in `localStorage` and used for authenticated requests.
- **Logout**: Users can log out to clear the token from `localStorage`.

### Device Management

- **View Devices**: The main page displays a list of devices with their status and schedules.
- **Add Device**: Users can add new devices through a modal form.
- **Edit Device**: Users can edit device details and schedules.
- **Delete Device**: Devices can be removed after a confirmation prompt.

### Scheduling

- **Add Schedule**: Each device can have schedules with start and end times.
- **Manage Schedules**: Edit or delete existing schedules.

### Real-Time Updates

- **WebSocket**: The application uses WebSocket for real-time updates and notifications related to device statuses.

## Security

- **Token-Based Authentication**: The backend uses JWT (JSON Web Tokens) for secure access. Tokens are stored in `localStorage` and included in request headers for authenticated routes.
- **CORS**: Cross-Origin Resource Sharing is configured to allow requests from the frontend.

## Notes

- Ensure that MongoDB is running on `localhost` and is accessible.
- Update the `.env` file with a strong secret key for JWT token generation.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact

For any questions or issues, please contact [matan@matang.xyz](mailto:matan@matang.xyz).
```
