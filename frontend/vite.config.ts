import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import os from 'os';

// Function to find the machine's local network IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      // Look for IPv4 and skip loopback addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost'; // Fallback
}

const localIP = getLocalIP();
const backendPort = 8000;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
  },
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(`http://${localIP}:${backendPort}`),
  },
});