#!/bin/bash
# Script to deploy the backend to Azure with proper configuration

# Set variables
RESOURCE_GROUP="ChessBasic"
APP_SERVICE_PLAN="ASP-ChessBasic-8705"
BACKEND_APP="chesshkbackend"
FRONTEND_URL="https://chesshkfrontend.azurewebsites.net"

ALLOWED_LIST="$FRONTEND_URL,https://chessbsbackend.azurewebsites.net"
ALLOWED_LIST=$(echo $ALLOWED_LIST | tr -d ' ') 

# Step 1: Create or update the backend app service
echo "Creating/updating backend app service..."
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan $APP_SERVICE_PLAN \
  --name $BACKEND_APP \
  --runtime "NODE|18-lts" \
  || echo "App service already exists, continuing..."

# Step 2: Configure the app service settings
echo "Configuring app service settings..."
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $BACKEND_APP \
  --settings \
  WEBSITE_NODE_DEFAULT_VERSION=~18 \
  ALLOWED_ORIGINS="$ALLOWED_LIST" \
  JWT_SECRET="chess-trainer-jwt-secret-key" \
  NODE_ENV="production" \
  DB_PATH="/home/site/wwwroot/chess_exercises.db"

#  # ALLOWED_ORIGINS=$FRONTEND_URL \

# Step 3: Prepare deployment package
echo "Preparing deployment package..."
cd /mnt/d/chess/ChessProject/backend

# Create a web.config file for Azure if it doesn't exist
cat > web.config << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <webSocket enabled="false" />
    <handlers>
      <add name="iisnode" path="server.js" verb="*" modules="iisnode" />
    </handlers>
    <rewrite>
      <rules>
        <rule name="DynamicContent">
          <match url="/*" />
          <action type="Rewrite" url="server.js" />
        </rule>
      </rules>
    </rewrite>
    <security>
      <requestFiltering>
        <hiddenSegments>
          <add segment="node_modules" />
        </hiddenSegments>
      </requestFiltering>
    </security>
  </system.webServer>
</configuration>
EOF

# Create a .deployment file
cat > .deployment << 'EOF'
[config]
SCM_DO_BUILD_DURING_DEPLOYMENT=true
EOF

# Create deployment package
echo "Creating deployment package..."
rm -f backend.zip
zip -r backend.zip server.js package.json package-lock.json web.config .deployment chess_exercises.db

# Step 4: Deploy the package to Azure
echo "Deploying to Azure..."
az webapp deployment source config-zip \
  --resource-group $RESOURCE_GROUP \
  --name $BACKEND_APP \
  --src backend.zip

# Step 5: Configure CORS
echo "Configuring CORS..."
az webapp cors add \
  --resource-group $RESOURCE_GROUP \
  --name $BACKEND_APP \
  --allowed-origins $FRONTEND_URL

az webapp cors add \
  --resource-group $RESOURCE_GROUP \
  --name $BACKEND_APP \
  --allowed-origins https://chessbsbackend.azurewebsites.net

# Step 6: Configure always on
echo "Configuring always on..."
az webapp config set \
  --resource-group $RESOURCE_GROUP \
  --name $BACKEND_APP \
  --always-on true

# Step 7: Restart the app
echo "Restarting app service..."
az webapp restart \
  --resource-group $RESOURCE_GROUP \
  --name $BACKEND_APP

echo "Backend deployment completed. Check your app at: https://$BACKEND_APP.azurewebsites.net"