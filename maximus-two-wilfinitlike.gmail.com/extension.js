/*global global, log */ // <-- jshint
/*jshint maxlen: 150 */
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Decoration = Me.imports.decoration;
const AppMenu = Me.imports.app_menu;

function init(extensionMeta) {
	Decoration.init(extensionMeta);
	AppMenu.init(extensionMeta);
}

function enable() {
	Decoration.enable();
	AppMenu.enable();
}

function disable() {
	AppMenu.disable();
	Decoration.disable();
}
