const config = {
  apiBaseUrl: process.env.NODE_ENV === "production"
    ? "https://chesshkbackend.azurewebsites.net"
    : "http://localhost:5001"
};

export default config;
