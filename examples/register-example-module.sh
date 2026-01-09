#!/bin/bash
# Register the example data-sync-module

API_URL="${API_URL:-http://localhost:4000/api/v1}"

echo "Registering data-sync-module example..."

# First, login to get token
echo "Login with your credentials..."
read -p "Email: " EMAIL
read -sp "Password: " PASSWORD
echo ""

# Get access token
TOKEN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

ACCESS_TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Login failed. Please check credentials."
  exit 1
fi

echo "✅ Login successful"

# Register module
echo "Registering module..."

MANIFEST=$(cat <<'EOF'
{
  "name": "data-sync-module",
  "version": "1.0.0",
  "displayName": "Data Sync Module",
  "description": "Example module demonstrating scheduled jobs with data synchronization",
  "main": "index.js",
  "author": "Automation Platform",
  "license": "MIT",
  "capabilities": {
    "api": {
      "routes": []
    },
    "jobs": {
      "handlers": []
    },
    "events": {
      "listeners": [
        {
          "event": "user.created",
          "handler": "handlers/user-created.js"
        },
        {
          "event": "user.updated",
          "handler": "handlers/user-updated.js"
        }
      ],
      "emitters": ["data.synced", "data.sync.failed", "report.generated", "health.checked", "health.alert"]
    }
  },
  "permissions": [
    "database:read",
    "database:write",
    "network:outbound:api.example.com",
    "network:outbound:data.example.com"
  ],
  "jobs": [
    {
      "name": "Hourly Data Sync",
      "handler": "jobs/hourly-sync.js",
      "description": "Syncs data from external API every hour",
      "schedule": "0 * * * *",
      "timeout": 600000,
      "retries": 3
    },
    {
      "name": "Daily Report Generator",
      "handler": "jobs/daily-report.js",
      "description": "Generates daily analytics report",
      "schedule": "0 0 * * *",
      "timeout": 900000,
      "retries": 2
    },
    {
      "name": "Health Check",
      "handler": "jobs/health-check.js",
      "description": "Monitors system health every 5 minutes",
      "schedule": "*/5 * * * *",
      "timeout": 30000,
      "retries": 1
    }
  ],
  "dependencies": {
    "axios": "^1.6.0",
    "date-fns": "^3.0.0"
  }
}
EOF
)

RESPONSE=$(curl -s -X POST "$API_URL/modules" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{\"manifest\":$MANIFEST}")

echo "API Response:"
echo "$RESPONSE"
echo ""

SUCCESS=$(echo $RESPONSE | grep -o '"success":[^,]*' | cut -d':' -f2)

if [ "$SUCCESS" = "true" ]; then
  echo "✅ Module registered successfully!"
  echo ""

  # Step 1: Install the module
  echo "Installing module..."
  INSTALL_RESPONSE=$(curl -s -X POST "$API_URL/modules/data-sync-module/install" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

  echo "Install Response:"
  echo "$INSTALL_RESPONSE"
  echo ""

  INSTALL_SUCCESS=$(echo $INSTALL_RESPONSE | grep -o '"success":[^,]*' | cut -d':' -f2)

  if [ "$INSTALL_SUCCESS" = "true" ]; then
    echo "✅ Module installed!"
    echo ""

    # Step 2: Enable the module
    echo "Enabling module..."
    ENABLE_RESPONSE=$(curl -s -X POST "$API_URL/modules/data-sync-module/enable" \
      -H "Authorization: Bearer $ACCESS_TOKEN")

    echo "Enable Response:"
    echo "$ENABLE_RESPONSE"
    echo ""

    ENABLE_SUCCESS=$(echo $ENABLE_RESPONSE | grep -o '"success":[^,]*' | cut -d':' -f2)

    if [ "$ENABLE_SUCCESS" = "true" ]; then
      echo "✅ Module enabled!"
      echo ""
      echo "🎉 Done! Now go to the 'Create Job' page and:"
      echo "   1. Select 'Data Sync Module' from the dropdown"
      echo "   2. You'll see 3 job types appear!"
    else
      echo "⚠️  Module installed but enable failed"
      echo "Error details in response above"
    fi
  else
    echo "⚠️  Module registered but install failed"
    echo "Error details in response above"
  fi
else
  echo "❌ Registration failed"
  echo "Error details in response above"
fi
