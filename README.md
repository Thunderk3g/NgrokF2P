# Local File Transfer

A web-based local file transfer system that allows users on the same WiFi network to easily share files between devices.

## Features

- Drag and drop file upload
- Real-time file list updates
- QR code for easy mobile access
- File size information
- Download and delete functionality
- Works on any device with a web browser
- No internet connection required (only local network)

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd local-file-transfer
```

2. Install server dependencies:
```bash
npm install
```

3. Install client dependencies:
```bash
cd client
npm install
cd ..
```

## Usage

1. Start the server:
```bash
npm start
```

2. In a separate terminal, start the client:
```bash
cd client
npm start
```

3. The application will be available at:
- Web interface: http://localhost:3000
- Server API: http://localhost:3001

4. To access from other devices on the same network:
- Open the web interface
- Look for the "Connection Information" card
- Use the displayed URL or scan the QR code on mobile devices

## How it Works

- The server runs on port 3001 and handles file operations
- The client runs on port 3000 and provides the user interface
- Files are stored in the `uploads` directory on the server
- Real-time updates are handled through Socket.IO
- The server automatically detects its IP address for local network access

## Security Notes

- This application is designed for use on trusted local networks only
- There is no authentication system - all users on the network can access files
- Do not expose the server to the internet without implementing proper security measures

## License

MIT 