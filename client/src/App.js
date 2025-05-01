import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Paper, 
  Typography, 
  List, 
  ListItem, 
  ListItemText,
  IconButton,
  Box,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Snackbar
} from '@mui/material';
import { Delete, CloudDownload } from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import io from 'socket.io-client';

// Try to get the server URL from the current hostname
const getServerUrl = () => {
  // If we're accessing from localhost, use localhost:3001
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:3001';
  }
  // For Ngrok or other deployments, use the same origin
  return window.location.origin;
};

const SERVER_URL = getServerUrl();
let socket;

function App() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [serverInfo, setServerInfo] = useState(null);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState('');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Initialize socket connection
    socket = io(SERVER_URL, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      setConnected(true);
      setError(null);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setError('Cannot connect to server. Please check if server is running.');
      setConnected(false);
    });

    // Get server information
    fetchServerInfo();

    // Get initial files list
    fetchFiles();

    // Socket.io event listeners
    socket.on('fileUploaded', (fileInfo) => {
      setNotification(`File ${fileInfo.originalname} uploaded successfully`);
      fetchFiles();
    });

    socket.on('fileDeleted', (filename) => {
      setNotification(`File deleted successfully`);
      fetchFiles();
    });

    return () => {
      if (socket) {
        socket.off('connect');
        socket.off('connect_error');
        socket.off('fileUploaded');
        socket.off('fileDeleted');
        socket.close();
      }
    };
  }, []);

  const fetchServerInfo = async () => {
    try {
      const response = await axios.get(`${SERVER_URL}/api/server-info`);
      setServerInfo(response.data);
    } catch (err) {
      setError('Failed to get server information');
    }
  };

  const fetchFiles = async () => {
    try {
      const response = await axios.get(`${SERVER_URL}/api/files`);
      setFiles(response.data);
    } catch (err) {
      setError('Failed to fetch files');
    }
  };

  const onDrop = async (acceptedFiles) => {
    setUploading(true);
    setError(null);

    for (const file of acceptedFiles) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        await axios.post(`${SERVER_URL}/api/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setNotification(`Uploading: ${percentCompleted}%`);
          },
        });
      } catch (err) {
        setError(`Failed to upload ${file.name}: ${err.response?.data?.error || err.message}`);
      }
    }

    setUploading(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    maxSize: 100 * 1024 * 1024 // 100MB limit
  });

  const handleDelete = async (filename) => {
    try {
      await axios.delete(`${SERVER_URL}/api/files/${filename}`);
    } catch (err) {
      setError(`Failed to delete ${filename}`);
    }
  };

  const handleDownload = (filename) => {
    window.open(`${SERVER_URL}/uploads/${filename}`);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Local File Transfer
      </Typography>

      {serverInfo && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Connection Information
            </Typography>
            <Typography variant="body1" gutterBottom>
              Status: {connected ? 
                <span style={{color: 'green'}}>Connected</span> : 
                <span style={{color: 'red'}}>Disconnected</span>
              }
            </Typography>
            <Typography variant="body1">
              Server URL: {serverInfo.url}
            </Typography>
            {serverInfo.qrCode && (
              <Box sx={{ mt: 2 }}>
                <img src={serverInfo.qrCode} alt="QR Code" style={{ maxWidth: 200 }} />
                <Typography variant="caption" display="block">
                  Scan QR code to connect from mobile devices
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper
        {...getRootProps()}
        sx={{
          p: 3,
          mb: 3,
          textAlign: 'center',
          backgroundColor: isDragActive ? '#f0f8ff' : '#fff',
          border: '2px dashed #ccc',
          cursor: 'pointer'
        }}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <Box>
            <CircularProgress />
            <Typography sx={{ mt: 2 }}>Uploading...</Typography>
          </Box>
        ) : (
          <Typography>
            {isDragActive
              ? 'Drop the files here...'
              : 'Tap here to select files or drag and drop them'}
          </Typography>
        )}
      </Paper>

      <Paper sx={{ mt: 3 }}>
        <List>
          {files.map((file) => (
            <ListItem
              key={file.name}
              secondaryAction={
                <Box>
                  <IconButton
                    edge="end"
                    aria-label="download"
                    onClick={() => handleDownload(file.name)}
                  >
                    <CloudDownload />
                  </IconButton>
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() => handleDelete(file.name)}
                  >
                    <Delete />
                  </IconButton>
                </Box>
              }
            >
              <ListItemText
                primary={file.name}
                secondary={`Size: ${formatFileSize(file.size)} • Uploaded: ${new Date(
                  file.createdAt
                ).toLocaleString()}`}
              />
            </ListItem>
          ))}
          {files.length === 0 && (
            <ListItem>
              <ListItemText primary="No files uploaded yet" />
            </ListItem>
          )}
        </List>
      </Paper>

      <Snackbar
        open={!!notification}
        autoHideDuration={3000}
        onClose={() => setNotification('')}
        message={notification}
      />
    </Container>
  );
}

export default App; 