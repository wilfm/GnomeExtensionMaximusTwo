const ExtensionUtils = imports.misc.extensionUtils;
const Gio = imports.gi.Gio;
const Me = ExtensionUtils.getCurrentExtension();

const CONFIG_SCHEMA = "org.gnome.shell.extensions.maximus-two";

const IGNORABLE_APPS = "ignorable-apps"; 

function _loadSettings() {
  

  const GioSSS = Gio.SettingsSchemaSource;

  let schemaDir = Me.dir.get_child('schemas');
  let schemaSource;
  if (schemaDir.query_exists(null)) {
    schemaSource = GioSSS.new_from_directory(schemaDir.get_path(), GioSSS.get_default(), false);
  } else {
    schemaSource = GioSSS.get_default();
  }

  let schema = schemaSource.lookup(CONFIG_SCHEMA, true);
  if (!schema) {
      throw new Error('Schema ' + CONFIG_SCHEMA + ' could not be found for extension ' +
                       Me.metadata.uuid + '. Please check your installation.');
  }

  this._settingsObject = new Gio.Settings({ settings_schema: schema });

  let ret = JSON.parse(this._settingsObject.get_string(IGNORABLE_APPS));
  return ret;
}
