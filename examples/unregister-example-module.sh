#!/bin/bash
# Unregister the example data-sync-module

API_URL="${API_URL:-http://localhost:4000/api/v1}"

echo "Unregistering data-sync-module example..."

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

# Get module ID
echo "Fetching module details..."
MODULE_RESPONSE=$(curl -s -X GET "$API_URL/modules" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

MODULE_ID=$(echo $MODULE_RESPONSE | grep -o '"id":"[^"]*","name":"data-sync-module"' | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$MODULE_ID" ]; then
  echo "❌ Module not found"
  exit 1
fi

echo "Found module ID: $MODULE_ID"

# Disable the module first
echo "Disabling module..."
DISABLE_RESPONSE=$(curl -s -X POST "$API_URL/modules/data-sync-module/disable" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Disable Response: $DISABLE_RESPONSE"

# Delete the module
echo "Deleting module..."
DELETE_RESPONSE=$(curl -s -X DELETE "$API_URL/modules/$MODULE_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Delete Response:"
echo "$DELETE_RESPONSE"
echo ""

DELETE_SUCCESS=$(echo $DELETE_RESPONSE | grep -o '"success":[^,]*' | cut -d':' -f2)

if [ "$DELETE_SUCCESS" = "true" ]; then
  echo "✅ Module unregistered successfully!"
  echo ""
  echo "You can now run ./examples/register-example-module.sh to register it again."
else
  echo "❌ Unregistration failed"
  echo "Error details in response above"
fi
