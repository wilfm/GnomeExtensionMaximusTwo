const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;

const Lang = imports.lang;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const MaximusTwoSettingsWidget = new GObject.Class({
  Name: 'MaximusTwo.Prefs.MaximusTwoSettingsWidget',
  GTypeName: 'MaximusTwoSettingsWidget',
  Extends: Gtk.Notebook,

  IGNORABLE_APPS: "ignorable-apps", 

  _menuConfig: {},

  _init: function(params) {
    this.parent(params);
    this.orientation = Gtk.Orientation.VERTICAL;
    this.expand = true;
    this.tab_pos = Gtk.PositionType.LEFT;    

    //this.append_page(this._generateMainSettings(), new Gtk.Label({
    //	label: "<b>Main</b>", halign:Gtk.Align.START, margin_start: 4, use_markup: true}));

    this.append_page(this._ignoreAppsSettings(), new Gtk.Label({
    	label: "<b>Ignorable Applications</b>", halign:Gtk.Align.START, margin_start: 4, use_markup: true}));

    let settings = this._loadSettings();

    for (let i=0; i < settings.length; i++) {
    	this._addEntry(settings[i]);
    }

  },

  _generateMainSettings: function() {
    let grid = new Gtk.Grid({margin_start: 20, column_homogeneous: true, })

    // TODO atm no options

    return grid;
  },

  _ignoreAppsSettings: function() {

  	this._treeModel = new Gtk.ListStore();
    this._treeModel.set_column_types([GObject.TYPE_STRING]);

    this._treeView = new Gtk.TreeView({model: this._treeModel, headers_visible: false});
    this._treeView.get_style_context().add_class(Gtk.STYLE_CLASS_RAISED);

    let column = new Gtk.TreeViewColumn({ min_width: 150 });
    let renderer = new Gtk.CellRendererText({ editable: true});
    renderer.connect("edited",
      Lang.bind(this, function(text, path, newValue) {
      	let[success, iter] = this._treeModel.get_iter_from_string(path);
      	if (success) {
      		this._treeModel.set_value(iter, 0, newValue);
      		this._updateConfig();
      	}
	  })
    );
    
    column.pack_start(renderer, true);
    column.add_attribute(renderer, 'text', 0);

    this._treeView.append_column(column);

    // sort the menu entries by position
    var entries = Object.getOwnPropertyNames(this._menuConfig);
    let size = entries.length;

    // sort entries by _menuconfig.foobar.position
    for (let i=0; i < size; i++) {
      entries[i] = {
        name: entries[i],
        position: this._menuConfig[entries[i]].position
      };
    }
    //entries.sort(Utils.sortMenuEntries);

    for(let i=0; i < entries.length; i++) {
      this._addEntry(entries[i].name);
    }

    // toolbar to add/remove entries
    let toolbar = new Gtk.Toolbar({});
    toolbar.set_icon_size(Gtk.IconSize.MENU);
    toolbar.get_style_context().add_class(Gtk.STYLE_CLASS_INLINE_TOOLBAR);

    this._removeButton = new Gtk.ToolButton( {icon_name: Gtk.STOCK_REMOVE} );
    this._removeButton.set_sensitive(false);
    this._removeButton.set_tooltip_text("Remove an existing application");

    this._removeButton.connect("clicked",
      Lang.bind(this, function() {
      	let [success, listStore, iter] = this._treeView.get_selection().get_selected();

      	let delme = this._treeModel.get_value(iter, 0);

        let dialog = new Gtk.MessageDialog({
          modal: true,
          message_type: Gtk.MessageType.QUESTION,
          title: "Delete entry '" + delme + "'?",
          text: "Are you sure to delete the configuration for  '" + delme  + "'?"
        });

        dialog.add_button(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL);
        dialog.add_button(Gtk.STOCK_DELETE, Gtk.ResponseType.DELETE_EVENT);

        dialog.connect("response",
          Lang.bind(this, function(dialog, responseType) {
            if (responseType != Gtk.ResponseType.DELETE_EVENT) {
              return;
            }

            let [success, listStore, iter] = this._treeView.get_selection().get_selected();
            listStore.remove(iter);
            this._updateConfig();
          })
        );
        dialog.run();
        dialog.destroy();
      })
    );

	this._treeView.get_selection().connect("changed",
      Lang.bind(this, function(selection) {
        let [success, store, iter] = selection.get_selected();
        if (!success) {
          return;
        }
        let selectedValue = store.get_value(iter, 0);
        if (this._selectedEntry !== null && this._selectedEntry == selectedValue) {
          return;
        }
        this._selectedEntry = selectedValue;
        this._removeButton.set_sensitive(true);
      })
    );

    let addButton = new Gtk.ToolButton({ icon_name: Gtk.STOCK_ADD });
    addButton.connect("clicked",
      Lang.bind(this, function() {
        this._addEntry( "New Entry");
      })
    );


    toolbar.insert(this._removeButton, 0);
    toolbar.insert(addButton, 1);

    let panel = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, margin_end: 5});
    panel.pack_start(toolbar, false, false, 0);
    panel.pack_start(this._treeView, true, true, 0);

    return panel;
  },

  _addEntry: function(name) {
    let iter = this._treeModel.append();
    this._treeModel.set(iter, [0], [ name ]);
    this._treeView.set_cursor(this._treeModel.get_path(iter), this._treeView.get_column(0), true)
    return iter;
  },

  _updateConfig: function() {
  	let entries = [];

  	this._treeModel.foreach(
	  function(listStore, treePath, treeIter) {
  		entries.push(listStore.get_value(treeIter, 0));


  	}, {});

  	this._settingsObject.set_string(this.IGNORABLE_APPS, JSON.stringify(entries));
  },

  _loadSettings: function() {
    let schema = "org.gnome.shell.extensions.maximus-two";

    const GioSSS = Gio.SettingsSchemaSource;

    let schemaDir = Me.dir.get_child('schemas');
    let schemaSource;
    if (schemaDir.query_exists(null)) {
      schemaSource = GioSSS.new_from_directory(schemaDir.get_path(), GioSSS.get_default(), false);
    } else {
      schemaSource = GioSSS.get_default();
    }

    schema = schemaSource.lookup(schema, true);
    if (!schema) {
        throw new Error('Schema ' + schema + ' could not be found for extension ' +
                         Me.metadata.uuid + '. Please check your installation.');
    }

    this._settingsObject = new Gio.Settings({ settings_schema: schema });

    let ret = JSON.parse(this._settingsObject.get_string(this.IGNORABLE_APPS));
    return ret;
  },

});


function init() {
}

function buildPrefsWidget() {
    let widget = new MaximusTwoSettingsWidget();
    widget.show_all();
    return widget;
};
