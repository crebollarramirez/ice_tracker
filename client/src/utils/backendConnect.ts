import axios from 'axios';

// Create axios instance with base configuration
const backendConnect = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:5001/iceinmyarea/us-central1',
  timeout: 10000, // 10 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

export default backendConnect;
