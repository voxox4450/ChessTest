#!/bin/bash
# Script to update the frontend app service without deleting the resource

# Set variables
RESOURCE_GROUP="PodstawowySzachy"
APP_SERVICE_PLAN="ASP-PodstawowySzachy-96f5"
FRONTEND_APP="chessHKFrontend"
BACKEND_URL="https://chesshkbackend.azurewebsites.net/"
LOCATION="Poland Central "

# Step 1: Check if the app exists, create only if not
echo "Checking if frontend app service exists..."
APP_EXISTS=$(az webapp show --resource-group $RESOURCE_GROUP --name $FRONTEND_APP 2>/dev/null)
if [ -z "$APP_EXISTS" ]; then
  echo "App doesn't exist, creating new one..."
  az webapp create \
    --resource-group $RESOURCE_GROUP \
    --plan $APP_SERVICE_PLAN \
    --name $FRONTEND_APP \
    --runtime "NODE|18-lts"
else
  echo "App exists, proceeding with update..."
fi

# Step 2: Configure the app service settings
echo "Configuring app service settings..."
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $FRONTEND_APP \
  --settings \
  SCM_DO_BUILD_DURING_DEPLOYMENT=true \
  WEBSITE_NODE_DEFAULT_VERSION=~18 \
  NODE_ENV=production \
  REACT_APP_API_URL=$BACKEND_URL

# Step 3: Prepare deployment package
echo "Preparing deployment package..."
cd D:/ChessProject/frontend

# Make sure we're using the production versions of config files
echo "Setting production configuration..."
NODE_ENV=production

# Restore the full package.json for building
echo "Restoring full package.json for building..."
if [ -f "package.json.full" ]; then
  cp package.json.full package.json
else
  # Create package.json with all necessary dependencies
  cat > package.json << 'EOF'
{
  "name": "chessKHfrontend",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "axios": "^1.7.0",
    "chess.js": "^1.0.0",
    "cra-template": "1.2.0",
    "express": "^4.18.2",
    "react": "^18.2.0",
    "react-chessboard": "^4.7.2",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1",
    "web-vitals": "^4.2.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "engines": {
    "node": "18.x"
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}
EOF
fi

# Build React app with environment variables
echo "Building React app..."
npm install
REACT_APP_API_URL=$BACKEND_URL npm run build

# Create a production package.json for deployment
cat > package.json.prod << 'EOF'
{
  "name": "chessBSfrontend",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "express": "^4.18.2"
  },
  "scripts": {
    "start": "node server.js"
  },
  "engines": {
    "node": "18.x"
  }
}
EOF

# Create a server.js to serve static files
cat > server.js << 'EOF'
const express = require('express');
const path = require('path');
const app = express();

// Serve static files from the build directory
app.use(express.static(path.join(__dirname, 'build')));

// Handle React routing, return all requests to React app
app.get('*', function(req, res) {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
EOF

# For deployment, use the simplified package.json
mv package.json.prod package.json

# Create deployment package with only what's needed for production
echo "Creating deployment package..."
rm -f frontend-min.zip
zip -r frontend-min.zip server.js package.json build

# Step 4: Deploy the package to Azure
echo "Deploying to Azure..."
az webapp deployment source config-zip \
  --resource-group $RESOURCE_GROUP \
  --name $FRONTEND_APP \
  --src frontend-min.zip

# Step 5: Configure deployment options
echo "Configuring deployment options..."
az webapp config set \
  --resource-group $RESOURCE_GROUP \
  --name $FRONTEND_APP \
  --startup-file "node server.js" \
  --always-on true

# Step 6: Restart the app
echo "Restarting app service..."
az webapp restart \
  --resource-group $RESOURCE_GROUP \
  --name $FRONTEND_APP

echo "Frontend update completed. Check your app at: https://$FRONTEND_APP.azurewebsites.net"