#!/bin/bash

# Script to register the documentation manager module

echo "📝 Registering Documentation Manager Module..."

cd "$(dirname "$0")/../../packages/backend"

# Compile and run the registration script
npx tsx scripts/register-documentation-module.ts

echo "✅ Module registration complete!"
