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

const { St, Shell, Meta, Atk, Clutter, GObject } = imports.gi;

const Main = imports.ui.main;
const Panel = imports.ui.panel;
const PopupMenu = imports.ui.popupMenu;
const PanelMenu = imports.ui.panelMenu;
const CtrlAltTab = imports.ui.ctrlAltTab;
const ExtensionSystem = imports.ui.extensionSystem;

const ExtensionUtils = imports.misc.extensionUtils;
const CE = ExtensionUtils.getCurrentExtension();
const MultiMonitors = CE.imports.extension;
const Convenience = CE.imports.convenience;
const MMCalendar = CE.imports.mmcalendar;

const SHOW_ACTIVITIES_ID = 'show-activities';
var SHOW_APP_MENU_ID = 'show-app-menu';
const SHOW_DATE_TIME_ID = 'show-date-time';
const SHOW_TOP_PANEL_ID = 'show-top-panel';
const AVAILABLE_INDICATORS_ID = 'available-indicators';
const TRANSFER_INDICATORS_ID = 'transfer-indicators';

var StatusIndicatorsController = class StatusIndicatorsController  {
    constructor() {
        this._transfered_indicators = [];
        this._settings = Convenience.getSettings();

        this._updatedSessionId = Main.sessionMode.connect('updated', this._updateSessionIndicators.bind(this));
        this._updateSessionIndicators();
        this._extensionStateChangedId = Main.extensionManager.connect('extension-state-changed', 
                                            this._extensionStateChanged.bind(this));

        this._transferIndicatorsId = this._settings.connect('changed::'+TRANSFER_INDICATORS_ID,
                                                                        this.transferIndicators.bind(this));
    }

    destroy() {
        this._settings.disconnect(this._transferIndicatorsId);
        Main.extensionManager.disconnect(this._extensionStateChangedId);
        Main.sessionMode.disconnect(this._updatedSessionId);
        this._settings.set_strv(AVAILABLE_INDICATORS_ID, []);
        this._transferBack(this._transfered_indicators);
    }

    transferBack(panel) {
        let transfer_back = this._transfered_indicators.filter((element) => {
            return element.monitor==panel.monitorIndex;
        });
        
        this._transferBack(transfer_back, panel);
    }

    transferIndicators() {
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
                        global.log(`Warning: Indicator ${iname} not found in Main.panel.statusArea`);
                        continue;
                    }
                    
                    let monitor = transfers[iname];
                    let indicator = Main.panel.statusArea[iname];
                    let panel = this._findPanel(monitor);
                    
                    if (!panel) {
                        global.log(`Warning: Panel not found for monitor ${monitor}`);
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
                            global.log(`Transferring ${iname} from ${box} to monitor ${monitor}`);
                            
                            // Add to tracking array before moving
                            this._transfered_indicators.push({
                                iname: iname,
                                box: box,
                                monitor: monitor
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
                    global.log(`Error processing indicator ${iname}: ${e}`);
                }
            }
        }
    }

    _findPanel(monitor) {
        for (let i = 0; i < Main.mmPanel.length; i++) {
            if (Main.mmPanel[i].monitorIndex == monitor) {
                return Main.mmPanel[i];
            }
        }
        return null;
    }

    _transferBack(transfer_back, panel) {
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
                    global.log(`Returning ${element.iname} from monitor ${element.monitor} to main panel`);
                    
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
                }
            }
        });
    }

    _extensionStateChanged() {
        this._findAvailableIndicators();
        this.transferIndicators();
    }

    _updateSessionIndicators() {
        let session_indicators = [];
        session_indicators.push('MultiMonitorsAddOn');
        let sessionPanel = Main.sessionMode.panel;
        for (let sessionBox in sessionPanel){
            sessionPanel[sessionBox].forEach((sesionIndicator) => {
                session_indicators.push(sesionIndicator);
            });
        }
        this._session_indicators = session_indicators;
        this._available_indicators = [];
        
        this._findAvailableIndicators();
        this.transferIndicators();
    }

    _findAvailableIndicators() {
        let available_indicators = [];
        let statusArea = Main.panel.statusArea;
        for(let indicator in statusArea) {
            if(statusArea.hasOwnProperty(indicator) && this._session_indicators.indexOf(indicator)<0){
                available_indicators.push(indicator);
            }
        }
        if(available_indicators.length!=this._available_indicators.length) {
            this._available_indicators = available_indicators;
            this._settings.set_strv(AVAILABLE_INDICATORS_ID, this._available_indicators);
        }
    }
};

// Modernize: No Lang, use ES6 class syntax, arrow functions, and GObject.registerClass
// All class definitions and copyClass usage are compatible with GJS 1.70+/GNOME 42
var MultiMonitorsAppMenuButton  = (() => {
	let MultiMonitorsAppMenuButton = class MultiMonitorsAppMenuButton extends PanelMenu.Button {
	    _init(panel) {
	    	if (panel.monitorIndex==undefined)
	    		this._monitorIndex = Main.layoutManager.primaryIndex;
	    	else	
	    		this._monitorIndex = panel.monitorIndex;
	    	this._actionOnWorkspaceGroupNotifyId = 0;
	    	this._targetAppGroup = null;
	    	this._lastFocusedWindow = null;
	    	Panel.AppMenuButton.prototype._init.call(this, panel);

	    	this._windowEnteredMonitorId = global.display.connect('window-entered-monitor',
			                					this._windowEnteredMonitor.bind(this));
			this._windowLeftMonitorId = global.display.connect('window-left-monitor',
			                					this._windowLeftMonitor.bind(this));
	    }
	    
	    _windowEnteredMonitor (metaScreen, monitorIndex, metaWin) {
	        if (monitorIndex == this._monitorIndex) {
	        	switch(metaWin.get_window_type()){
	        	case Meta.WindowType.NORMAL:
	        	case Meta.WindowType.DIALOG:
	        	case Meta.WindowType.MODAL_DIALOG:
	        	case Meta.WindowType.SPLASHSCREEN:
	        		this._sync();
	        		break;
	        	}
	        }
	    }
	
	    _windowLeftMonitor (metaScreen, monitorIndex, metaWin) {
	        if (monitorIndex == this._monitorIndex) {
	        	switch(metaWin.get_window_type()){
	        	case Meta.WindowType.NORMAL:
	        	case Meta.WindowType.DIALOG:
	        	case Meta.WindowType.MODAL_DIALOG:
	        	case Meta.WindowType.SPLASHSCREEN:
	        		this._sync();
	        		break;
	        	}
	        }
	    }
	    
	    _findTargetApp() {
	    	
	        if (this._actionOnWorkspaceGroupNotifyId) {
	            this._targetAppGroup.disconnect(this._actionOnWorkspaceGroupNotifyId);
	            this._actionOnWorkspaceGroupNotifyId = 0;
	            this._targetAppGroup = null;
	        }
	        let groupWindow = false;
	        let groupFocus = false;
	
	        let workspaceManager = global.workspace_manager;
	        let workspace = workspaceManager.get_active_workspace();
	        let tracker = Shell.WindowTracker.get_default();
	        let focusedApp = tracker.focus_app;
	        if (focusedApp && focusedApp.is_on_workspace(workspace)){
	        	let windows = focusedApp.get_windows();
	        	for (let i = 0; i < windows.length; i++) {
	        		let win = windows[i];
	        		if (win.located_on_workspace(workspace)){
	        			if (win.get_monitor() == this._monitorIndex){
	        				if (win.has_focus()){
	        					this._lastFocusedWindow = win;
	//    	        			global.log(this._monitorIndex+": focus :"+win.get_title()+" : "+win.has_focus());
		        			return focusedApp;	
	        				}
	        				else
	        					groupWindow = true;
	        			}
	        			else {
	        				if(win.has_focus())
	        					groupFocus = true;
	        			}
	        			if (groupFocus && groupWindow) {
							if(focusedApp != this._targetApp){
	    					this._targetAppGroup = focusedApp;
	    					this._actionOnWorkspaceGroupNotifyId = this._targetAppGroup.connect('notify::action-group', 
	    																				this._sync.bind(this));
	//    				 	global.log(this._monitorIndex+": gConnect :"+win.get_title()+" : "+win.has_focus());
							}
	        				break;
	        			}
	        		}
	        	}
	        }
	
	        for (let i = 0; i < this._startingApps.length; i++)
	            if (this._startingApps[i].is_on_workspace(workspace)){
	//            	global.log(this._monitorIndex+": newAppFocus");
	                return this._startingApps[i];
	            }
	        
	        if (this._lastFocusedWindow && this._lastFocusedWindow.located_on_workspace(workspace) &&
	        											this._lastFocusedWindow.get_monitor() == this._monitorIndex){
	//			global.log(this._monitorIndex+": lastFocus :"+this._lastFocusedWindow.get_title());
				return tracker.get_window_app(this._lastFocusedWindow);
	        }
	
	        let windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, workspace);
	
	        for (let i = 0; i < windows.length; i++) {
	        	if(windows[i].get_monitor() == this._monitorIndex){
	        		this._lastFocusedWindow = windows[i];
	//        		global.log(this._monitorIndex+": appFind :"+windows[i].get_title());
	    			return tracker.get_window_app(windows[i]);
	    		}
	        }
	
	        return null;
	    }
	    
	    _sync() {
	    	if (!this._switchWorkspaceNotifyId)
	    		return;
	    	Panel.AppMenuButton.prototype._sync.call(this);
	    }
	    
	    _onDestroy() {
	    	if (this._actionGroupNotifyId) {
	            this._targetApp.disconnect(this._actionGroupNotifyId);
	            this._actionGroupNotifyId = 0;
	        }

	        global.display.disconnect(this._windowEnteredMonitorId);
	        global.display.disconnect(this._windowLeftMonitorId);
	        
            if (this._busyNotifyId) {
                this._targetApp.disconnect(this._busyNotifyId);
                this._busyNotifyId = 0;
            }
            
            if (this.menu._windowsChangedId) {
                this.menu._app.disconnect(this.menu._windowsChangedId);
                this.menu._windowsChangedId = 0;
            }
            Panel.AppMenuButton.prototype._onDestroy.call(this);
		}
	};
	MultiMonitors.copyClass(Panel.AppMenuButton, MultiMonitorsAppMenuButton);
	return GObject.registerClass({Signals: {'changed': {}},}, MultiMonitorsAppMenuButton);
})();

var MultiMonitorsActivitiesButton = (() => {
    let MultiMonitorsActivitiesButton = class MultiMonitorsActivitiesButton extends PanelMenu.Button {
    _init() {
            super._init(0.0, null, true);
            this.accessible_role = Atk.Role.TOGGLE_BUTTON;

            this.name = 'mmPanelActivities';

            /* Translators: If there is no suitable word for "Activities"
               in your language, you can use the word for "Overview". */
            this._label = new St.Label({ text: _("Activities"),
                                         y_align: Clutter.ActorAlign.CENTER });
            this.add_actor(this._label);

            this.label_actor = this._label;

            this._showingId = Main.overview.connect('showing', () => {
                this.add_style_pseudo_class('overview');
                this.add_accessible_state (Atk.StateType.CHECKED);
            });
            this._hidingId = Main.overview.connect('hiding', () => {
                this.remove_style_pseudo_class('overview');
                this.remove_accessible_state (Atk.StateType.CHECKED);
            });
            
            this._xdndTimeOut = 0;
        }

        _onDestroy() {
            Main.overview.disconnect(this._showingId);
            Main.overview.disconnect(this._hidingId);
            super._onDestroy();
        }
    }
    MultiMonitors.copyClass(Panel.ActivitiesButton, MultiMonitorsActivitiesButton);
    return GObject.registerClass(MultiMonitorsActivitiesButton);
})();

const MULTI_MONITOR_PANEL_ITEM_IMPLEMENTATIONS = {
    'activities': MultiMonitorsActivitiesButton,
    'appMenu': MultiMonitorsAppMenuButton,
    'dateMenu': MMCalendar.MultiMonitorsDateMenuButton,
};

var MultiMonitorsPanel = (() => {
    let MultiMonitorsPanel = class MultiMonitorsPanel extends St.Widget {
    _init(monitorIndex, mmPanelBox, isPrimary = false) {
        super._init({ name: 'panel',
                      reactive: true });

        this.monitorIndex = monitorIndex;
        this.isPrimary = isPrimary;

        this.set_offscreen_redirect(Clutter.OffscreenRedirect.ALWAYS);

        this._sessionStyle = null;

        this.statusArea = {};

        this.menuManager = new PopupMenu.PopupMenuManager(this);

        this._leftBox = new St.BoxLayout({ name: 'panelLeft' });
        this.add_child(this._leftBox);
        this._centerBox = new St.BoxLayout({ name: 'panelCenter' });
        this.add_child(this._centerBox);
        this._rightBox = new St.BoxLayout({ name: 'panelRight' });
        this.add_child(this._rightBox);

        this._showingId = Main.overview.connect('showing', () => {
            this.add_style_pseudo_class('overview');
        });
        this._hidingId = Main.overview.connect('hiding', () => {
            this.remove_style_pseudo_class('overview');
        });

        mmPanelBox.panelBox.add(this);
        Main.ctrlAltTabManager.addGroup(this, _("Top Bar"), 'focus-top-bar-symbolic',
                                        { sortGroup: CtrlAltTab.SortGroup.TOP });

        this._updatedId = Main.sessionMode.connect('updated', this._updatePanel.bind(this));

        this._workareasChangedId = global.display.connect('workareas-changed', () => this.queue_relayout());
        this._updatePanel();

        this._settings = Convenience.getSettings();
        this._showActivitiesId = this._settings.connect('changed::'+SHOW_ACTIVITIES_ID,
                                                            this._showActivities.bind(this));
        this._showActivities();

        this._showAppMenuId = this._settings.connect('changed::'+SHOW_APP_MENU_ID,
                                                            this._showAppMenu.bind(this));
        this._showAppMenu();

    		this._showDateTimeId = this._settings.connect('changed::'+SHOW_DATE_TIME_ID,
                                                            this._showDateTime.bind(this));
        this._showDateTime();
        
        this._showTopPanelId = this._settings.connect('changed::'+SHOW_TOP_PANEL_ID, 
                                                           () => Main.layoutManager.emit('monitors-changed'));

        this.connect('destroy', this._onDestroy.bind(this));
    }

    _onDestroy() {
        global.display.disconnect(this._workareasChangedId);
        Main.overview.disconnect(this._showingId);
        Main.overview.disconnect(this._hidingId);

        this._settings.disconnect(this._showActivitiesId);
        this._settings.disconnect(this._showAppMenuId);
        this._settings.disconnect(this._showDateTimeId);
        this._settings.disconnect(this._showTopPanelId);

        Main.ctrlAltTabManager.removeGroup(this);
        Main.sessionMode.disconnect(this._updatedId);
    }

    _showActivities() {
        let name = 'activities';
        if (this._settings.get_boolean(SHOW_ACTIVITIES_ID)) {
            if (this.statusArea[name])
                this.statusArea[name].visible = true;
        }
        else {
            if (this.statusArea[name])
                this.statusArea[name].visible = false;
        }
    }

    _showDateTime() {
        let name = 'dateMenu';
        if (this._settings.get_boolean(SHOW_DATE_TIME_ID)) {
            if (this.statusArea[name])
                this.statusArea[name].visible = true;
        }
        else {
            if (this.statusArea[name])
                this.statusArea[name].visible = false;
        }
    }

    _showAppMenu() {
        let name = 'appMenu';
        if (this._settings.get_boolean(SHOW_APP_MENU_ID)) {
            if (!this.statusArea[name]) {
                let indicator = new MultiMonitorsAppMenuButton(this);
                this.statusArea[name] = indicator;
                let box = this._leftBox;
                this._addToPanelBox(name, indicator, box.get_n_children()+1, box);
            }
        }
        else {
            if (this.statusArea[name]) {
                let indicator = this.statusArea[name];
                this.menuManager.removeMenu(indicator.menu);
                indicator.destroy();
                delete this.statusArea[name];
            }
        }
    }

    vfunc_get_preferred_width(forHeight) {
        if (Main.layoutManager.monitors.length>this.monitorIndex)
            return [0, Main.layoutManager.monitors[this.monitorIndex].width];
        
        return [0,  0];
    }

    _hideIndicators() {
        for (let role in MULTI_MONITOR_PANEL_ITEM_IMPLEMENTATIONS) {
            let indicator = this.statusArea[role];
            if (!indicator)
                continue;
            indicator.container.hide();
        }
    }

    _ensureIndicator(role) {
        let indicator = this.statusArea[role];
        if (indicator) {
            indicator.container.show();
            return null;
        }
        else {
            let constructor = MULTI_MONITOR_PANEL_ITEM_IMPLEMENTATIONS[role];
            if (!constructor) {
                // If we don't have a specific implementation, try to use the primary panel's implementation
                if (Main.panel.statusArea && Main.panel.statusArea[role]) {
                    const primaryIndicator = Main.panel.statusArea[role];
                    if (primaryIndicator && primaryIndicator.constructor) {
                        // Try to use the same constructor as the primary panel
                        try {
                            indicator = new primaryIndicator.constructor(this);
                            this.statusArea[role] = indicator;
                            return indicator;
                        } catch (e) {
                            global.log(`Error creating ${role} from primary panel constructor: ${e}`);
                            
                            // For indicators that don't work with constructor copying,
                            // we'll handle them via the transferIndicators mechanism instead
                            return null;
                        }
                    }
                }
                global.log(`No implementation for role ${role} in additional panel`);
                return null;
            }
            indicator = new constructor(this);
            this.statusArea[role] = indicator;
        }
        return indicator;
    }

    _getDraggableWindowForPosition(stageX) {
        let workspaceManager = global.workspace_manager;
        const windows = workspaceManager.get_active_workspace().list_windows();
        const allWindowsByStacking =
            global.display.sort_windows_by_stacking(windows).reverse();

        return allWindowsByStacking.find(metaWindow => {
            let rect = metaWindow.get_frame_rect();
            return metaWindow.get_monitor() == this.monitorIndex &&
                   metaWindow.showing_on_its_workspace() &&
                   metaWindow.get_window_type() != Meta.WindowType.DESKTOP &&
                   metaWindow.maximized_vertically &&
                   stageX > rect.x && stageX < rect.x + rect.width;
        });
    }};

    MultiMonitors.copyClass(Panel.Panel, MultiMonitorsPanel);
    return GObject.registerClass(MultiMonitorsPanel);
})();
