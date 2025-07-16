# Multi Monitors Add-On Usage Guide

## Important Notes for Multi-Workspace Users

If you're using multiple workspaces across multiple monitors, please be aware of these considerations:

1. This extension preserves your window-to-workspace mappings when GNOME Shell restarts or when the extension is enabled/disabled.
2. If you notice windows collecting on a single workspace after restart, please report this issue with details about your specific setup.
3. For optimal experience with static workspace extensions, enable this extension first, then the workspace management extension.

## Transferring Indicators to Additional Monitors

The Multi Monitors Add-On allows you to transfer status indicators (like Tilda, Dropbox, etc.) from the main panel to additional monitor panels. This is useful when you primarily work on a secondary monitor and want quick access to these indicators without having to move to your primary monitor.

### How to transfer an indicator:

1. Open the extension preferences through:
   - System Settings > Extensions > Multi Monitors Add-On > Settings, or
   - Clicking the Multi Monitors indicator in the top panel and selecting "Preferences"

2. In the preferences window, scroll down to see the list of indicators that can be transferred.

3. Click the "+" button to add a new indicator to transfer.

4. In the popup dialog:
   - Select the indicator you want to transfer from the list (e.g., "Tilda")
   - Choose the monitor number to transfer it to (0 is the first additional monitor, 1 is the second, etc.)
   - Click "Add"

5. The indicator should now appear in the selected monitor's panel.

6. To remove a transferred indicator (returning it to the main panel), select it in the list and click the "-" button.

### Troubleshooting:

If an indicator doesn't appear on the additional monitor panel after transfer:

1. Make sure the "Show Panel on additional monitors" option is enabled.

2. Try restarting the GNOME Shell (press Alt+F2, type "r", press Enter).

3. Check if the indicator is properly initialized. Some indicators need to be activated first 
   before they can be transferred. For example, for Tilda, you might need to start Tilda first.

4. Some indicators might not be transferable due to how they're implemented. In this case, 
   you might need to enable "Show top panel on all monitors" which creates more complete panels
   on all monitors.

### Common Indicators to Transfer:

- **Tilda**: Terminal dropdown tool
- **Dropbox**: Cloud storage sync status
- **KeePassXC**: Password manager
- **NetworkManager**: Network status (if not using the default one)
- **OpenWeather**: Weather indicator
- **Sound Input & Output Device Chooser**: Audio device selection

Note: The available indicators list is dynamically generated based on what's currently loaded in your session.

## Working with Multiple Static Workspaces

If you're using another extension to manage static workspaces along with multiple monitors, follow these steps for best compatibility:

1. **Extension Load Order**: Enable Multi Monitors Add-On first, then enable your workspace management extension.

2. **Workspace Organization**: If windows are collecting on a single workspace after GNOME restart:
   - Try disabling and then re-enabling this extension
   - Make sure there are no conflicts with other workspace-related extensions
   - If problems persist, try adjusting the workspace number in your static workspace extension first, then restart GNOME, and finally set your desired workspace number

3. **Window Placement**: This extension now automatically saves and restores window-to-workspace mappings when GNOME Shell restarts or when you enable/disable the extension.

4. **Monitor-specific Workspaces**: For advanced workspace layouts (e.g., different workspaces on different monitors), you may need to manually organize windows after restart.