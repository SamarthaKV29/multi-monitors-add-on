/*
Copyright (C) 2014  spin83

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; either version 2
of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, visit https://www.gnu.org/licenses/.
*/

const { Clutter, Gio } = imports.gi;
const St = imports.gi.St;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const GLib = imports.gi.GLib;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const ExtensionUtils = imports.misc.extensionUtils;
const MultiMonitors = ExtensionUtils.getCurrentExtension();
const Convenience = MultiMonitors.imports.convenience;

const MMLayout = MultiMonitors.imports.mmlayout;
const MMOverview = MultiMonitors.imports.mmoverview;
const MMIndicator = MultiMonitors.imports.indicator;

const OVERRIDE_SCHEMA = 'org.gnome.shell.overrides';
const MUTTER_SCHEMA = 'org.gnome.mutter';
const WORKSPACES_ONLY_ON_PRIMARY_ID = 'workspaces-only-on-primary';

const SHOW_INDICATOR_ID = 'show-indicator';
const THUMBNAILS_SLIDER_POSITION_ID = 'thumbnails-slider-position';
const SHOW_TOP_PANEL_ID = 'show-top-panel';

function copyClass (s, d) {
    // Utility to copy prototype methods from s to d, skipping symbols and constructors
    if (!s) throw Error(`copyClass s undefined for d ${d.name}`)
    let propertyNames = Reflect.ownKeys(s.prototype);
    for (let pName of propertyNames.values()) {
        if (typeof pName === "symbol") continue;
        if (d.prototype.hasOwnProperty(pName)) continue;
        if (pName === "prototype") continue;
        if (pName === "constructor") continue;
        let pDesc = Reflect.getOwnPropertyDescriptor(s.prototype, pName);
        if (typeof pDesc !== 'object') continue;
        Reflect.defineProperty(d.prototype, pName, pDesc);
    }
};

class MultiMonitorsAddOn {
    constructor() {
        this._settings = Convenience.getSettings();
        this._mu_settings = new Gio.Settings({ schema: MUTTER_SCHEMA });
        this.mmIndicator = null;
        Main.mmOverview = null;
        Main.mmLayoutManager = null;
        this._mmMonitors = 0;
        this.syncWorkspacesActualGeometry = null;
        this._saved_workspace_window_mappings = [];
    }

    _showIndicator() {
        if (this._settings.get_boolean(SHOW_INDICATOR_ID)) {
            if (!this.mmIndicator) {
                this.mmIndicator = new MMIndicator.MultiMonitorsIndicator();
                Main.panel.addToStatusArea('multi-monitors-indicator', this.mmIndicator);
            }
        } else {
            this._hideIndicator();
        }
    }

    _hideIndicator() {
        if (this.mmIndicator) {
            this.mmIndicator.destroy();
            this.mmIndicator = null;
        }
    }

    _showThumbnailsSlider() {
        if (this._settings.get_string(THUMBNAILS_SLIDER_POSITION_ID) === 'none') {
            this._hideThumbnailsSlider();
            return;
        }
        if (this._mu_settings.get_boolean(WORKSPACES_ONLY_ON_PRIMARY_ID)) {
            this._mu_settings.set_boolean(WORKSPACES_ONLY_ON_PRIMARY_ID, false);
        }
        if (Main.mmOverview) {
            this._hideThumbnailsSlider();
        }
        Main.mmOverview = [];
        for (let idx = 0; idx < Main.layoutManager.monitors.length; idx++) {
            // Create an instance of MultiMonitorsOverview instead of directly using MultiMonitorsThumbnailsBox
            try {
                Main.mmOverview.push(new MMOverview.MultiMonitorsOverview(idx));
            } catch (e) {
                global.log('Error creating MultiMonitorsOverview for monitor ' + idx + ': ' + e);
            }
        }
        // Patch syncWorkspacesActualGeometry for multi-monitor support
        if (Main.overview && Main.overview.searchController && Main.overview.searchController._workspacesDisplay) {
            this.syncWorkspacesActualGeometry = Main.overview.searchController._workspacesDisplay._syncWorkspacesActualGeometry;
            Main.overview.searchController._workspacesDisplay._syncWorkspacesActualGeometry = () => {
                for (let idx = 0; idx < Main.mmOverview.length; idx++) {
                    if (Main.mmOverview[idx].syncWorkspacesActualGeometry)
                        Main.mmOverview[idx].syncWorkspacesActualGeometry();
                }
                if (this.syncWorkspacesActualGeometry)
                    this.syncWorkspacesActualGeometry();
            };
        }
    }

    _hideThumbnailsSlider() {
        if (!Main.mmOverview) return;
        for (let idx = 0; idx < Main.mmOverview.length; idx++) {
            if (Main.mmOverview[idx].destroy)
                Main.mmOverview[idx].destroy();
        }
        Main.mmOverview = null;
        // Restore syncWorkspacesActualGeometry if patched
        if (Main.overview && Main.overview.searchController && Main.overview.searchController._workspacesDisplay && this.syncWorkspacesActualGeometry) {
            Main.overview.searchController._workspacesDisplay._syncWorkspacesActualGeometry = this.syncWorkspacesActualGeometry;
            this.syncWorkspacesActualGeometry = null;
        }
    }

    _relayout() {
        if (Main.mmLayoutManager) {
            Main.mmLayoutManager.hidePanel();
            Main.mmLayoutManager = null;
        }
        Main.mmLayoutManager = new MMLayout.MultiMonitorsLayoutManager();
        Main.mmLayoutManager.showPanel();
    }

    _switchOffThumbnails() {
        this._hideThumbnailsSlider();
        if (this._mu_settings.get_boolean(WORKSPACES_ONLY_ON_PRIMARY_ID) === false) {
            this._mu_settings.set_boolean(WORKSPACES_ONLY_ON_PRIMARY_ID, true);
        }
    }

    /**
     * Save the current window to workspace mappings to restore them later
     */
    saveWindowWorkspaceMappings() {
        this._saved_workspace_window_mappings = [];
        let workspaceManager = global.workspace_manager;
        let numWorkspaces = workspaceManager.n_workspaces;
        
        for (let i = 0; i < numWorkspaces; i++) {
            let workspace = workspaceManager.get_workspace_by_index(i);
            let windows = workspace.list_windows();
            
            windows.forEach(window => {
                if (window && window.get_id()) {
                    this._saved_workspace_window_mappings.push({
                        windowId: window.get_id(),
                        workspaceIndex: i,
                        monitor: window.get_monitor()
                    });
                }
            });
        }
        
        global.log(`Multi-monitors add-on saved ${this._saved_workspace_window_mappings.length} window workspace mappings`);
    }

    /**
     * Restore window to workspace mappings to fix workspace organization issues
     */
    restoreWindowWorkspaceMappings() {
        if (this._saved_workspace_window_mappings.length === 0) {
            return;
        }
        
        let workspaceManager = global.workspace_manager;
        let display = global.display;
        let windowActors = global.get_window_actors();
        let restoredCount = 0;
        
        this._saved_workspace_window_mappings.forEach(mapping => {
            let matchingActor = windowActors.find(actor => {
                return actor.get_meta_window() && actor.get_meta_window().get_id() === mapping.windowId;
            });
            
            if (matchingActor) {
                let window = matchingActor.get_meta_window();
                let currentWorkspaceIndex = window.get_workspace().index();
                
                if (currentWorkspaceIndex !== mapping.workspaceIndex) {
                    let targetWorkspace = workspaceManager.get_workspace_by_index(mapping.workspaceIndex);
                    if (targetWorkspace) {
                        window.change_workspace(targetWorkspace);
                        restoredCount++;
                    }
                }
            }
        });
        
        global.log(`Multi-monitors add-on restored ${restoredCount} window workspace mappings`);
        this._saved_workspace_window_mappings = [];
    }

    enable(version) {
        // Save current window to workspace mappings before making any changes
        this.saveWindowWorkspaceMappings();
        
        this._showIndicator();
        this._showThumbnailsSlider();
        this._relayout();
        
        // Restore window to workspace mappings after a short delay to ensure everything is initialized
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
            this.restoreWindowWorkspaceMappings();
            return GLib.SOURCE_REMOVE;
        });
    }

    disable() {
        // Save workspace mappings before disabling
        this.saveWindowWorkspaceMappings();
        
        this._hideIndicator();
        this._hideThumbnailsSlider();
        if (Main.mmLayoutManager) {
            Main.mmLayoutManager.hidePanel();
            Main.mmLayoutManager = null;
        }
        this._switchOffThumbnails();
        
        // Restore window to workspace mappings after a short delay
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            this.restoreWindowWorkspaceMappings();
            return GLib.SOURCE_REMOVE;
        });
    }
}

var multiMonitorsAddOn = null;
var version = null;

function init() {
    Convenience.initTranslations();
    // Remove any panel monkey-patching for GNOME 42+ (not needed)
}

function enable() {
    if (multiMonitorsAddOn !== null) {
        multiMonitorsAddOn.disable();
        multiMonitorsAddOn = null;
    }
    multiMonitorsAddOn = new MultiMonitorsAddOn();
    multiMonitorsAddOn.enable(version);
}

function disable() {
    if (multiMonitorsAddOn == null) return;
    multiMonitorsAddOn.disable();
    multiMonitorsAddOn = null;
}

// NOTE: If you encounter issues with Main.overview or Main.panel, review the GNOME Shell 42 API docs for changes.
