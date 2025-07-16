#!/bin/bash

# Make sure the fix script is executable
chmod +x fix-indicator-transfer.js

# Run the fix script
gjs fix-indicator-transfer.js

# Make the entire extension directory writable by the user
chmod -R 755 .

echo "To apply the changes, restart GNOME Shell with Alt+F2, r, Enter"
echo "Then go to the extension preferences and try adding indicators again."