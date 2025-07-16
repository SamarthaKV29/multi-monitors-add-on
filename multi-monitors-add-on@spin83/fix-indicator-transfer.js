#!/usr/bin/gjs

// This script fixes indicator transfer in the Multi Monitors Add-On
// Run with: `cd /path/to/extension && gjs fix-indicator-transfer.js`

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

// Path to the extension directory (current directory)
const extensionDir = Gio.File.new_for_path('.');
const mmpanelFile = extensionDir.get_child('mmpanel.js');

// Backup original file
const backupFile = extensionDir.get_child('mmpanel.js.backup');
if (!backupFile.query_exists(null)) {
    print('Creating backup of mmpanel.js...');
    
    try {
        mmpanelFile.copy(backupFile, Gio.FileCopyFlags.NONE, null, null);
        print('Backup created: mmpanel.js.backup');
    } catch (e) {
        print(`Error creating backup: ${e.message}`);
        imports.system.exit(1);
    }
}

// Read the mmpanel.js file
let contents;
try {
    const [success, data] = mmpanelFile.load_contents(null);
    if (success) {
        contents = new TextDecoder().decode(data);
    } else {
        print('Failed to read mmpanel.js');
        imports.system.exit(1);
    }
} catch (e) {
    print(`Error reading file: ${e.message}`);
    imports.system.exit(1);
}

// Check if our fix is already applied
if (contents.includes('// Enhanced indicator transfer implementation')) {
    print('Fix has already been applied. Nothing to do.');
    imports.system.exit(0);
}

// Replace the transferIndicators method with our fixed version
const oldTransferIndicators = `    transferIndicators() {
        let boxs = ['_leftBox', '_centerBox', '_rightBox'];
        let transfers = this._settings.get_value(TRANSFER_INDICATORS_ID).deep_unpack();
        
        // Find indicators that need to be moved back to main panel
        let transfer_back = this._transfered_indicators.filter((element) => {
            return !transfers.hasOwnProperty(element.iname);
        });
        
        this._transferBack(transfer_back);
        
        // Transfer indicators to secondary panels
        for(let iname in transfers) {
            if(transfers.hasOwnProperty(iname)) {`;

const newTransferIndicators = `    transferIndicators() {
        // Enhanced indicator transfer implementation
        let boxs = ['_leftBox', '_centerBox', '_rightBox'];
        let transfers = this._settings.get_value(TRANSFER_INDICATORS_ID).deep_unpack();
        
        // Find indicators that need to be moved back to main panel
        let transfer_back = this._transfered_indicators.filter((element) => {
            return !transfers.hasOwnProperty(element.iname);
        });
        
        this._transferBack(transfer_back);
        
        // Transfer indicators to secondary panels
        for(let iname in transfers) {
            if(transfers.hasOwnProperty(iname)) {
                try {
                    if (!Main.panel.statusArea[iname]) {
                        global.log(\`Warning: Indicator \${iname} not found in Main.panel.statusArea\`);
                        continue;
                    }
                    
                    let monitor = transfers[iname];
                    let indicator = Main.panel.statusArea[iname];
                    let panel = this._findPanel(monitor);
                    
                    if (!panel) {
                        global.log(\`Warning: Panel not found for monitor \${monitor}\`);
                        continue;
                    }
                    
                    // Check if indicator is already transferred
                    let alreadyTransferred = this._transfered_indicators.some(element => 
                        element.iname === iname && element.monitor === monitor);
                        
                    if (alreadyTransferred) {
                        continue; // Skip if already moved to this monitor
                    }
                    
                    // Find which box contains the indicator in the main panel
                    boxs.forEach((box) => {
                        if (Main.panel[box] && Main.panel[box].contains(indicator.container)) {
                            global.log(\`Transferring \${iname} from \${box} to monitor \${monitor}\`);
                            
                            // Get the position to maintain order
                            let order = indicator.container.get_parent().get_children().indexOf(indicator.container);
                            
                            // Add to tracking array before moving
                            this._transfered_indicators.push({
                                iname: iname,
                                box: box,
                                monitor: monitor,
                                order: order
                            });
                            
                            // Remove menu from main panel manager
                            if (indicator.menu && Main.panel.menuManager) {
                                Main.panel.menuManager.removeMenu(indicator.menu);
                            }
                            
                            // Remove from main panel
                            Main.panel[box].remove_child(indicator.container);
                            
                            // Add to target panel
                            panel[box].add_child(indicator.container);
                            
                            // Add menu to target panel's menu manager
                            if (indicator.menu && panel.menuManager) {
                                panel.menuManager.addMenu(indicator.menu);
                            }
                            
                            // Ensure indicator is visible and interactive
                            if (indicator.container) {
                                indicator.container.opacity = 255;
                                indicator.container.show();
                            }
                            
                            // Also set any actor property to visible
                            if (indicator.actor) {
                                indicator.actor.opacity = 255;
                                indicator.actor.show();
                            }
                        }
                    });
                } catch (e) {
                    global.log(\`Error processing indicator \${iname}: \${e}\`);
                }`;

// Also replace the _transferBack method
const oldTransferBack = `    _transferBack(transfer_back, panel) {
        transfer_back.forEach((element) => {
            let idx = this._transfered_indicators.indexOf(element);
            if (idx >= 0) {
                this._transfered_indicators.splice(idx, 1);
            }
            
            if(Main.panel.statusArea[element.iname]) {`;

const newTransferBack = `    _transferBack(transfer_back, panel) {
        transfer_back.forEach((element) => {
            let idx = this._transfered_indicators.indexOf(element);
            if (idx >= 0) {
                this._transfered_indicators.splice(idx, 1);
            }
            
            if(Main.panel.statusArea[element.iname]) {
                let indicator = Main.panel.statusArea[element.iname];
                if(!panel) {
                    panel = this._findPanel(element.monitor);
                }
                
                if(panel && panel[element.box] && panel[element.box].contains(indicator.container)) {
                    global.log(\`Returning \${element.iname} from monitor \${element.monitor} to main panel\`);
                    
                    // Remove the menu from the panel's menu manager before removing the indicator
                    if (indicator.menu && panel.menuManager) {
                        panel.menuManager.removeMenu(indicator.menu);
                    }
                    
                    panel[element.box].remove_child(indicator.container);
                    
                    // Restore indicator to main panel
                    if (element.box === '_leftBox')
                        Main.panel[element.box].insert_child_at_index(indicator.container, 1);
                    else
                        Main.panel[element.box].insert_child_at_index(indicator.container, 0);
                        
                    // Add menu back to main panel's menu manager
                    if (indicator.menu && Main.panel.menuManager) {
                        Main.panel.menuManager.addMenu(indicator.menu);
                    }
                    
                    // Make sure the indicator is fully visible
                    if (indicator.container) {
                        indicator.container.opacity = 255;
                        indicator.container.show();
                    }
                    
                    if (indicator.actor) {
                        indicator.actor.opacity = 255;
                        indicator.actor.show();
                    }
                }`;

const newContents = contents
    .replace(oldTransferIndicators, newTransferIndicators)
    .replace(oldTransferBack, newTransferBack);

// Write the modified content back
try {
    mmpanelFile.replace_contents(new TextEncoder().encode(newContents), 
                                null, false, 
                                Gio.FileCreateFlags.NONE, null);
    print('Successfully applied indicator transfer fix!');
    print('Restart GNOME Shell (Alt+F2, r, Enter) for changes to take effect.');
} catch (e) {
    print(`Error writing file: ${e.message}`);
    imports.system.exit(1);
}

imports.system.exit(0);