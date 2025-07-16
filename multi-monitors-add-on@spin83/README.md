# Multi Monitors Add-On

An extension that adds multiple monitors overview and panel for GNOME Shell.

## Recent Fixes

### Fixed "+" Button in Preferences Dialog
If you were experiencing issues with the "+" button not working in the preferences dialog, you can install the fix by running:

```
cd ~/Projects/gnome-shell/multi-monitors-add-on/multi-monitors-add-on@spin83/
chmod +x install-fixes.sh
./install-fixes.sh
```

### Window Workspace Organization
The extension now preserves window-to-workspace mappings when GNOME Shell restarts or when the extension is enabled/disabled. This prevents windows from collecting on a single workspace after restart.

## Usage Guide

See the [USAGE_GUIDE.md](USAGE_GUIDE.md) file for detailed instructions on:
- Working with multiple static workspaces
- Transferring indicators to additional monitors
- Troubleshooting common issues

## License

This extension is distributed under the GNU General Public License, version 2 or later.