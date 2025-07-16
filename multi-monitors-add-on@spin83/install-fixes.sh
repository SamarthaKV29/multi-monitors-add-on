#!/bin/bash

# Backup the original prefs.js file
if [ -f "prefs.js" ]; then
    echo "Backing up original prefs.js to prefs.js.backup"
    cp prefs.js prefs.js.backup
fi

# Replace with the fixed version
if [ -f "fixed-prefs.js" ]; then
    echo "Installing fixed prefs.js"
    cp fixed-prefs.js prefs.js
    echo "Fix installed successfully!"
else
    echo "Error: fixed-prefs.js not found!"
    exit 1
fi

# Check and run the indicator transfer fix
if [ -f "fix-indicators.sh" ]; then
    echo "Running indicator transfer fix..."
    chmod +x fix-indicators.sh
    ./fix-indicators.sh
fi

# Ensure this script and the extension files have the right permissions
chmod +x "$0"
chmod -R 755 .
echo "Restart GNOME Shell with Alt+F2, r, Enter to apply all changes"