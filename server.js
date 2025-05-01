const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');
const ip = require('ip');
const QRCode = require('qrcode');
const fs = require('fs');
const ngrok = require('ngrok');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "DELETE"]
  }
});

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Serve static files from the React build directory
app.use(express.static(path.join(__dirname, 'client/build')));

// Get server IP address and generate QR code
const serverIP = ip.address();
const serverPort = process.env.PORT || 3001;
const serverUrl = `http://${serverIP}:${serverPort}`;

// Generate QR code for easy mobile access
let qrCodeDataURL = '';
QRCode.toDataURL(serverUrl)
  .then(url => {
    qrCodeDataURL = url;
  })
  .catch(err => {
    console.error('Error generating QR code:', err);
  });

// Routes
app.get('/api/server-info', (req, res) => {
  res.json({
    ip: serverIP,
    port: serverPort,
    url: serverUrl,
    qrCode: qrCodeDataURL
  });
});

app.get('/api/files', (req, res) => {
  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Error reading files' });
    }

    const fileList = files.map(file => {
      const stats = fs.statSync(path.join(uploadDir, file));
      return {
        name: file,
        size: stats.size,
        createdAt: stats.birthtime
      };
    });

    res.json(fileList);
  });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const fileInfo = {
    filename: req.file.filename,
    originalname: req.file.originalname,
    size: req.file.size,
    path: `/uploads/${req.file.filename}`
  };
  
  io.emit('fileUploaded', fileInfo);
  res.json(fileInfo);
});

app.delete('/api/files/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(uploadDir, filename);

  fs.unlink(filepath, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Error deleting file' });
    }
    io.emit('fileDeleted', filename);
    res.json({ message: 'File deleted successfully' });
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected');
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Function to find an available port
const findAvailablePort = (startPort) => {
  return new Promise((resolve, reject) => {
    const testServer = http.createServer();
    testServer.listen(startPort, '0.0.0.0', () => {
      const port = testServer.address().port;
      testServer.close(() => {
        resolve(port);
      });
    });
    testServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(findAvailablePort(startPort + 1));
      } else {
        reject(err);
      }
    });
  });
};

// Start server with automatic port finding
findAvailablePort(3001)
  .then(async port => {
    server.listen(port, '0.0.0.0', async () => {
      const actualUrl = `http://${serverIP}:${port}`;
      console.log(`Server running at ${actualUrl}`);
      console.log(`Local IP: ${serverIP}`);
      
      try {
        // Start ngrok tunnel with authtoken from environment variable
        const url = await ngrok.connect({
          addr: port,
          proto: 'http',
          authtoken: process.env.NGROK_AUTHTOKEN
        });
        console.log(`Ngrok tunnel created: ${url}`);
        
        // Generate QR code with ngrok URL
        QRCode.toDataURL(url)
          .then(qrUrl => {
            qrCodeDataURL = qrUrl;
            console.log('Scan QR code on mobile devices to connect via Ngrok');
          })
          .catch(err => {
            console.error('Error updating QR code:', err);
          });
      } catch (err) {
        console.error('Failed to create Ngrok tunnel:', err);
        console.log('Continuing with local network only');
        
        // Fallback to local URL QR code
        QRCode.toDataURL(actualUrl)
          .then(url => {
            qrCodeDataURL = url;
            console.log('Scan QR code on mobile devices to connect locally');
          })
          .catch(err => {
            console.error('Error updating QR code:', err);
          });
      }
    });
  })
  .catch(err => {
    console.error('Failed to start server:', err);
  });

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
}); 