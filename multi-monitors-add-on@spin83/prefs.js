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

const GObject = imports.gi.GObject;
const Gdk = imports.gi.Gdk;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const Gettext = imports.gettext.domain('multi-monitors-add-on');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const MultiMonitors = ExtensionUtils.getCurrentExtension();
const Convenience = MultiMonitors.imports.convenience;

const SHOW_INDICATOR_ID = 'show-indicator';
const SHOW_PANEL_ID = 'show-panel';
const SHOW_ACTIVITIES_ID = 'show-activities';
const SHOW_APP_MENU_ID = 'show-app-menu';
const SHOW_DATE_TIME_ID = 'show-date-time';
const SHOW_TOP_PANEL_ID = 'show-top-panel';
const THUMBNAILS_SLIDER_POSITION_ID = 'thumbnails-slider-position';
const AVAILABLE_INDICATORS_ID = 'available-indicators';
const TRANSFER_INDICATORS_ID = 'transfer-indicators';
const ENABLE_HOT_CORNERS = 'enable-hot-corners';

const Columns = {
    INDICATOR_NAME: 0,
    MONITOR_NUMBER: 1
};

class FixedNewIndicatorDialog extends Gtk.Dialog {
    constructor(parent) {
        super({
            title: _("Select indicator"),
            transient_for: parent,
            modal: true
        });
        
        this.add_button(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL);
        this.add_button(_("Add"), Gtk.ResponseType.OK);
        this.set_default_response(Gtk.ResponseType.OK);
        
        let content = this.get_content_area();
        content.set_margin_top(10);
        content.set_margin_bottom(10);
        content.set_margin_start(10);
        content.set_margin_end(10);
        content.set_spacing(10);
        
        // Create the indicator list
        this.indicatorStore = new Gtk.ListStore();
        this.indicatorStore.set_column_types([GObject.TYPE_STRING]);
        
        this.indicatorView = new Gtk.TreeView({
            model: this.indicatorStore,
            headers_visible: true
        });
        
        let column = new Gtk.TreeViewColumn({
            title: _("Available Indicators"),
            expand: true
        });
        
        let renderer = new Gtk.CellRendererText();
        column.pack_start(renderer, true);
        column.add_attribute(renderer, "text", 0);
        
        this.indicatorView.append_column(column);
        this.indicatorView.get_selection().set_mode(Gtk.SelectionMode.SINGLE);
        
        // Fill with available indicators
        let availableIndicators = parent._settings.get_strv(AVAILABLE_INDICATORS_ID);
        let transfers = parent._settings.get_value(TRANSFER_INDICATORS_ID).deep_unpack();
        
        availableIndicators.forEach(indicator => {
            if (!transfers.hasOwnProperty(indicator)) {
                let iter = this.indicatorStore.append();
                this.indicatorStore.set(iter, [0], [indicator]);
            }
        });
        
        // Make sure the first item is selected
        let [success, iter] = this.indicatorStore.get_iter_first();
        if (success) {
            this.indicatorView.get_selection().select_iter(iter);
        }
        
        // Add the view to a scrolled window
        let scrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            min_content_height: 200,
            min_content_width: 300
        });
        scrolled.set_child(this.indicatorView);
        
        // Add monitor selector
        let monitorBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10
        });
        
        let monitorLabel = new Gtk.Label({
            label: _("Monitor index:"),
            halign: Gtk.Align.START,
            hexpand: true
        });
        
        // Calculate max monitor index
        let monitorCount = parent._monitors ? 
            Math.max(0, parent._monitors.get_n_items() - 1) : 0;
            
        this.monitorAdjustment = new Gtk.Adjustment({
            lower: 0,
            upper: monitorCount,
            step_increment: 1,
            value: 0
        });
        
        this.monitorSpin = new Gtk.SpinButton({
            adjustment: this.monitorAdjustment,
            numeric: true,
            halign: Gtk.Align.END
        });
        
        monitorBox.append(monitorLabel);
        monitorBox.append(this.monitorSpin);
        
        // Add everything to the dialog
        content.append(scrolled);
        content.append(monitorBox);
    }
    
    get_selected_indicator() {
        let [success, model, iter] = this.indicatorView.get_selection().get_selected();
        if (success) {
            return model.get_value(iter, 0);
        }
        return null;
    }
    
    get_selected_monitor() {
        return this.monitorAdjustment.get_value();
    }
}

var MultiMonitorsPrefsWidget = GObject.registerClass(
class MultiMonitorsPrefsWidget extends Gtk.Grid {
    _init() {
        super._init({
            margin_top: 6, margin_end: 6, margin_bottom: 6, margin_start: 6
        });

        this._numRows = 0;

        this.set_orientation(Gtk.Orientation.VERTICAL);

        this._settings = Convenience.getSettings();
        this._desktopSettings = Convenience.getSettings("org.gnome.desktop.interface");

        this._display = Gdk.Display.get_default();
        this._monitors = this._display.get_monitors()

        this._addBooleanSwitch(_('Show Multi Monitors indicator on Top Panel.'), SHOW_INDICATOR_ID);
        this._addBooleanSwitch(_('Show Panel on additional monitors.'), SHOW_PANEL_ID);
        this._addBooleanSwitch(_('Show Activities-Button on additional monitors.'), SHOW_ACTIVITIES_ID);
        this._addBooleanSwitch(_('Show AppMenu-Button on additional monitors.'), SHOW_APP_MENU_ID);
        this._addBooleanSwitch(_('Show DateTime-Button on additional monitors.'), SHOW_DATE_TIME_ID);
        this._addBooleanSwitch(_('Show top panel on all monitors.'), SHOW_TOP_PANEL_ID);
        this._addComboBoxSwitch(_('Show Thumbnails-Slider on additional monitors.'), THUMBNAILS_SLIDER_POSITION_ID, {
            none: _('No'),
            right: _('On the right'),
            left: _('On the left'),
            auto: _('Auto')
        });
        this._addSettingsBooleanSwitch(_('Enable hot corners.'), this._desktopSettings, ENABLE_HOT_CORNERS);

        this._store = new Gtk.ListStore();
        this._store.set_column_types([GObject.TYPE_STRING, GObject.TYPE_INT]);

        this._treeView = new Gtk.TreeView({ model: this._store, hexpand: true, vexpand: true });
        this._treeView.get_selection().set_mode(Gtk.SelectionMode.SINGLE);

        let appColumn = new Gtk.TreeViewColumn({ 
            expand: true, 
            sort_column_id: Columns.INDICATOR_NAME,
            title: _("Indicators to transfer to additional monitors (e.g., Tilda, Dropbox, etc.)") 
        });

        let nameRenderer = new Gtk.CellRendererText;
        appColumn.pack_start(nameRenderer, true);
        appColumn.add_attribute(nameRenderer, "text", Columns.INDICATOR_NAME);

        let monitorRenderer = new Gtk.CellRendererText;
        appColumn.pack_start(monitorRenderer, true);
        appColumn.add_attribute(monitorRenderer, "text", Columns.MONITOR_NUMBER);
        
        this._treeView.append_column(appColumn);
        this.add(this._treeView);

        let toolbar = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        toolbar.get_style_context().add_class("inline-toolbar");

        this._settings.connect('changed::'+TRANSFER_INDICATORS_ID, this._updateIndicators.bind(this));
        this._updateIndicators();

        let addTButton = new Gtk.Button({ icon_name: "list-add" });
        addTButton.connect('clicked', this._addIndicator.bind(this));
        toolbar.append(addTButton);

        let removeTButton = new Gtk.Button({ icon_name: "list-remove" });
        removeTButton.connect('clicked', this._removeIndicator.bind(this));
        toolbar.append(removeTButton);
        
        this.add(toolbar);
    }

    add(child) {
        this.attach(child, 0, this._numRows++, 1, 1);
    }

    _updateIndicators() {
        try {
            global.log("Updating indicators list");
            
            // Clear the existing store
            this._store.clear();
            
            // Get the current transfers
            let transfers = this._settings.get_value(TRANSFER_INDICATORS_ID).deep_unpack();
            let count = 0;
            
            // Add each transfer to the list
            for(let indicator in transfers) {
                if(transfers.hasOwnProperty(indicator)){
                    let monitor = transfers[indicator];
                    let iter = this._store.append();
                    this._store.set(iter, [Columns.INDICATOR_NAME, Columns.MONITOR_NUMBER], [indicator, monitor]);
                    count++;
                }
            }
            
            global.log(`Updated indicators list with ${count} items`);
            
            // Make sure the treeview is updated and visible
            if (this._treeView) {
                this._treeView.get_selection().unselect_all();
                this._treeView.queue_draw();
            }
        } catch (e) {
            global.log(`Error updating indicators: ${e.message}`);
        }
    }
    
    _addIndicator() {
        try {
            global.log("Opening indicator selection dialog");
            
            let dialog = new FixedNewIndicatorDialog(this.get_toplevel());
            
            // Force dialog to show properly
            dialog.set_visible(true);
            dialog.present();
            
            dialog.connect('response', (dialog, id) => {
                global.log(`Dialog response: ${id}`);
                
                if (id == Gtk.ResponseType.OK) {
                    let indicator = dialog.get_selected_indicator();
                    let monitorIndex = Math.floor(dialog.get_selected_monitor()); // Ensure integer
                    
                    global.log(`Selected indicator: ${indicator}, monitor: ${monitorIndex}`);
                    
                    if (indicator) {
                        let transfers = this._settings.get_value(TRANSFER_INDICATORS_ID).deep_unpack();
                        if (!transfers.hasOwnProperty(indicator)) {
                            global.log(`Adding indicator ${indicator} to transfers`);
                            transfers[indicator] = monitorIndex;
                            this._settings.set_value(TRANSFER_INDICATORS_ID, 
                                new GLib.Variant('a{si}', transfers));
                            
                            // Force update display
                            this._updateIndicators();
                            
                            global.log(`Added indicator ${indicator} to monitor ${monitorIndex}`);
                        } else {
                            global.log(`Indicator ${indicator} was already in transfers`);
                        }
                    } else {
                        global.log("No indicator selected");
                    }
                }
                
                dialog.destroy();
            });
        } catch (e) {
            global.log(`Error in _addIndicator: ${e.message}`);
        }
    }
    
    _removeIndicator() {
        try {
            let [any, model, iter] = this._treeView.get_selection().get_selected();
            if (any) {
                let indicator = model.get_value(iter, Columns.INDICATOR_NAME);
                global.log(`Removing indicator: ${indicator}`);
                
                let transfers = this._settings.get_value(TRANSFER_INDICATORS_ID).deep_unpack();
                if(transfers.hasOwnProperty(indicator)){
                    delete transfers[indicator];
                    this._settings.set_value(TRANSFER_INDICATORS_ID, new GLib.Variant('a{si}', transfers));
                    global.log(`Removed ${indicator} from transfers`);
                } else {
                    global.log(`Warning: ${indicator} not found in transfers`);
                }
            } else {
                global.log("No indicator selected for removal");
            }
        } catch (e) {
            global.log(`Error in _removeIndicator: ${e.message}`);
        }
    }

    _addComboBoxSwitch(label, schema_id, options) {
        this._addSettingsComboBoxSwitch(label, this._settings, schema_id, options)
    }

    _addSettingsComboBoxSwitch(label, settings, schema_id, options) {
        let gHBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL,
                margin_top: 10, margin_end: 10, margin_bottom: 10, margin_start: 10,
                spacing: 20, hexpand: true});
        let gLabel = new Gtk.Label({label: _(label), halign: Gtk.Align.START});
        gHBox.append(gLabel);

        let gCBox = new Gtk.ComboBoxText({halign: Gtk.Align.END});
        Object.entries(options).forEach(function(entry) {
            const [key, val] = entry;
            gCBox.append(key, val);
        });
        gHBox.append(gCBox);

        this.add(gHBox);

        settings.bind(schema_id, gCBox, 'active-id', Gio.SettingsBindFlags.DEFAULT);
    }

    _addBooleanSwitch(label, schema_id) {
        this._addSettingsBooleanSwitch(label, this._settings, schema_id);
    }

    _addSettingsBooleanSwitch(label, settings, schema_id) {
        let gHBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL,
                margin_top: 10, margin_end: 10, margin_bottom: 10, margin_start: 10,
                spacing: 20, hexpand: true});
        let gLabel = new Gtk.Label({label: _(label), halign: Gtk.Align.START});
        gHBox.append(gLabel);
        let gSwitch = new Gtk.Switch({halign: Gtk.Align.END});
        gHBox.append(gSwitch);
        this.add(gHBox);

        settings.bind(schema_id, gSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
    }
});

function init() {
    Convenience.initTranslations();
}

function buildPrefsWidget() {
    let widget = new MultiMonitorsPrefsWidget();
    return widget;
}