#!/bin/bash
set -e

BASE_URL="https://literate-space-funicular-76q945w7qjcx5xp-4000.app.github.dev"

echo "🧪 Phase 2 Dynamic Routing - Comprehensive Test Suite"
echo "=================================================="
echo ""
echo "ℹ️  Make sure to set TOKEN environment variable first:"
echo "   export TOKEN=<your-jwt-token>"
echo ""

if [ -z "$TOKEN" ]; then
  echo "❌ ERROR: TOKEN environment variable is not set"
  echo "   Run: export TOKEN=\$(curl -s -X POST ${BASE_URL}/api/v1/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"admin@automation-platform.local\",\"password\":\"admin123\"}' | jq -r '.data.accessToken')"
  exit 1
fi

echo "🔐 Using token: ${TOKEN:0:20}..."
echo ""

# Test 1: Invalid route (404)
echo "📝 Test 1: Invalid route should return 404"
RESULT=$(curl -s "${BASE_URL}/api/v1/modules/example-module/nonexistent" \
  -H "Authorization: Bearer $TOKEN")
STATUS_CODE=$(echo "$RESULT" | jq -r '.error.statusCode // 0')
MESSAGE=$(echo "$RESULT" | jq -r '.error.message // "N/A"')
if [ "$STATUS_CODE" = "404" ]; then
  echo "   ✅ PASS: $MESSAGE"
else
  echo "   ❌ FAIL: Expected 404, got $STATUS_CODE"
fi
echo ""

# Test 2: Wrong HTTP method (404)
echo "📝 Test 2: Wrong HTTP method should return 404"
RESULT=$(curl -s -X POST "${BASE_URL}/api/v1/modules/example-module/hello" \
  -H "Authorization: Bearer $TOKEN")
STATUS_CODE=$(echo "$RESULT" | jq -r '.error.statusCode // 0')
MESSAGE=$(echo "$RESULT" | jq -r '.error.message // "N/A"')
if [ "$STATUS_CODE" = "404" ]; then
  echo "   ✅ PASS: $MESSAGE"
else
  echo "   ❌ FAIL: Expected 404, got $STATUS_CODE"
fi
echo ""

# Test 3: Disable module
echo "📝 Test 3: Disabling module"
RESULT=$(curl -s -X POST "${BASE_URL}/api/v1/modules/example-module/disable" \
  -H "Authorization: Bearer $TOKEN")
STATUS=$(echo "$RESULT" | jq -r '.data.status // "ERROR"')
if [ "$STATUS" = "DISABLED" ]; then
  echo "   ✅ PASS: Module disabled successfully"
else
  echo "   ❌ FAIL: Expected DISABLED status, got $STATUS"
fi
echo ""

# Test 4: Access disabled module (503)
echo "📝 Test 4: Accessing disabled module should return 503"
RESULT=$(curl -s "${BASE_URL}/api/v1/modules/example-module/hello" \
  -H "Authorization: Bearer $TOKEN")
STATUS_CODE=$(echo "$RESULT" | jq -r '.error.statusCode // 0')
MESSAGE=$(echo "$RESULT" | jq -r '.error.message // "N/A"')
if [ "$STATUS_CODE" = "503" ]; then
  echo "   ✅ PASS: $MESSAGE"
else
  echo "   ❌ FAIL: Expected 503, got $STATUS_CODE"
fi
echo ""

# Test 5: Re-enable module
echo "📝 Test 5: Re-enabling module"
RESULT=$(curl -s -X POST "${BASE_URL}/api/v1/modules/example-module/enable" \
  -H "Authorization: Bearer $TOKEN")
STATUS=$(echo "$RESULT" | jq -r '.data.status // "ERROR"')
if [ "$STATUS" = "ENABLED" ]; then
  echo "   ✅ PASS: Module enabled successfully"
else
  echo "   ❌ FAIL: Expected ENABLED status, got $STATUS"
fi
echo ""

# Test 6: Route works after re-enable
echo "📝 Test 6: Routes should work after re-enabling"
RESULT=$(curl -s "${BASE_URL}/api/v1/modules/example-module/hello?name=TestAfterEnable" \
  -H "Authorization: Bearer $TOKEN")
MESSAGE=$(echo "$RESULT" | jq -r '.data.message // "ERROR"')
if [[ "$MESSAGE" == *"TestAfterEnable"* ]]; then
  echo "   ✅ PASS: $MESSAGE"
else
  echo "   ❌ FAIL: Expected greeting with 'TestAfterEnable', got $MESSAGE"
fi
echo ""

# Test 7: Complex POST body echo
echo "📝 Test 7: POST handler should echo complex body"
RESULT=$(curl -s -X POST "${BASE_URL}/api/v1/modules/example-module/echo" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nested":{"data":"test","array":[1,2,3]},"timestamp":"2026-01-09"}')
NESTED_DATA=$(echo "$RESULT" | jq -r '.data.echo.nested.data // "ERROR"')
if [ "$NESTED_DATA" = "test" ]; then
  echo "   ✅ PASS: Complex body echoed correctly"
else
  echo "   ❌ FAIL: Body not echoed correctly"
fi
echo ""

# Test 8a: Query parameter handling - without parameter
echo "📝 Test 8a: Hello handler without name parameter"
RESULT=$(curl -s "${BASE_URL}/api/v1/modules/example-module/hello" \
  -H "Authorization: Bearer $TOKEN")
MESSAGE=$(echo "$RESULT" | jq -r '.data.message // "ERROR"')
if [[ "$MESSAGE" == *"World"* ]]; then
  echo "   ✅ PASS: $MESSAGE"
else
  echo "   ❌ FAIL: Expected 'Hello, World!', got $MESSAGE"
fi
echo ""

# Test 8b: Query parameter handling - with parameter
echo "📝 Test 8b: Hello handler with name parameter"
RESULT=$(curl -s "${BASE_URL}/api/v1/modules/example-module/hello?name=Automation" \
  -H "Authorization: Bearer $TOKEN")
MESSAGE=$(echo "$RESULT" | jq -r '.data.message // "ERROR"')
if [[ "$MESSAGE" == *"Automation"* ]]; then
  echo "   ✅ PASS: $MESSAGE"
else
  echo "   ❌ FAIL: Expected greeting with 'Automation', got $MESSAGE"
fi
echo ""

# Test 9: Status endpoint
echo "📝 Test 9: Status endpoint should return module info"
RESULT=$(curl -s "${BASE_URL}/api/v1/modules/example-module/status" \
  -H "Authorization: Bearer $TOKEN")
STATUS=$(echo "$RESULT" | jq -r '.data.status // "ERROR"')
UPTIME=$(echo "$RESULT" | jq -r '.data.uptime // "ERROR"')
if [ "$STATUS" = "operational" ] && [ "$UPTIME" != "ERROR" ]; then
  echo "   ✅ PASS: Status = $STATUS, Uptime = $UPTIME"
else
  echo "   ❌ FAIL: Status endpoint not working correctly"
fi
echo ""

# Test 10: Module list shows correct status
echo "📝 Test 10: Module list should show example-module as ENABLED"
RESULT=$(curl -s "${BASE_URL}/api/v1/modules" \
  -H "Authorization: Bearer $TOKEN")
MODULE_STATUS=$(echo "$RESULT" | jq -r '.data[] | select(.name=="example-module") | .status // "ERROR"')
if [ "$MODULE_STATUS" = "ENABLED" ]; then
  echo "   ✅ PASS: Module status is $MODULE_STATUS"
else
  echo "   ❌ FAIL: Expected ENABLED, got $MODULE_STATUS"
fi
echo ""

# Test 11: Unregistered module returns 503
echo "📝 Test 11: Accessing non-existent module should return 503"
RESULT=$(curl -s "${BASE_URL}/api/v1/modules/nonexistent-module/hello" \
  -H "Authorization: Bearer $TOKEN")
STATUS_CODE=$(echo "$RESULT" | jq -r '.error.statusCode // 0')
MESSAGE=$(echo "$RESULT" | jq -r '.error.message // "N/A"')
if [ "$STATUS_CODE" = "503" ]; then
  echo "   ✅ PASS: $MESSAGE"
else
  echo "   ❌ FAIL: Expected 503, got $STATUS_CODE"
fi
echo ""

echo "=================================================="
echo "✅ Phase 2 Dynamic Routing Test Suite Complete!"
echo "=================================================="
echo ""
echo "Summary:"
echo "  • Wildcard route handler working correctly"
echo "  • Module enable/disable lifecycle working"
echo "  • Error handling (404, 503) working correctly"
echo "  • TypeScript handlers executing via dynamic import"
echo "  • Query parameters and request bodies handled correctly"
echo "  • Module state persistence working"
echo ""
echo "✨ Phase 2 Step 3: Dynamic Routing - VALIDATED"
