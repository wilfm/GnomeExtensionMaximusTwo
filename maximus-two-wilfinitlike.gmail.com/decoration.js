const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Meta = imports.gi.Meta;
const Util = imports.misc.util;

function LOG(message) {
	// log("[maximus-two]: " + message);
}

function WARN(message) {
	log("[maximus-two]: " + message);
}

/** Guesses the X ID of a window.
 *
 * It is often in the window's title, being `"0x%x %10s".format(XID, window.title)`.
 * (See `mutter/src/core/window-props.c`).
 *
 * If we couldn't find it there, we use `win`'s actor, `win.get_compositor_private()`.
 * The actor's `x-window` property is the X ID of the window *actor*'s frame
 * (as opposed to the window itself).
 *
 * However, the child window of the window actor is the window itself, so by
 * using `xwininfo -children -id [actor's XID]` we can attempt to deduce the
 * window's X ID.
 *
 * It is not always foolproof, but works good enough for now.
 *
 * @param {Meta.Window} win - the window to guess the XID of. You wil get better
 * success if the window's actor (`win.get_compositor_private()`) exists.
 */
function guessWindowXID(win) {
	let id = null;
	/* if window title has non-utf8 characters, get_description() complains
	 * "Failed to convert UTF-8 string to JS string: Invalid byte sequence in conversion input",
	 * event though get_title() works.
	 */
	try {
		id = win.get_description().match(/0x[0-9a-f]+/);
		if (id) {
			id = id[0];
			return id;
		}
	} catch (err) {
	}

	// use xwininfo, take first child.
	let act = win.get_compositor_private();
	if (act) {
		id = GLib.spawn_command_line_sync('xwininfo -children -id 0x%x'.format(act['x-window']));
		if (id[0]) {
			let str = id[1].toString();

			/* The X ID of the window is the one preceding the target window's title.
			 * This is to handle cases where the window has no frame and so
			 * act['x-window'] is actually the X ID we want, not the child.
			 */
			let regexp = new RegExp('(0x[0-9a-f]+) +"%s"'.format(win.title));
			id = str.match(regexp);
			if (id) {
				return id[1];
			}

			/* Otherwise, just grab the child and hope for the best */
			id = str.split(/child(?:ren)?:/)[1].match(/0x[0-9a-f]+/);
			if (id) {
				return id[0];
			}
		}
	}
	// debugging for when people find bugs..
	WARN("Could not find XID for window with title %s".format(win.title));
	return null;
}

/**
* Changes to config are not loaded without restart. 
*
* Reloading would require that we undo the xprop statement, otherwise it has no effect
*/
function _isIgnorebleWindow(title) {
  for (let i = 0; i < this.ignorableApps.length; i++) {
    if (title.indexOf(this.ignorableApps[i]) != -1) {
	  return true;
	}
  }
  return false;
}

/**
 * Tells the window manager to hide the titlebar on maximised windows.
 *
 * Does this by setting the _GTK_HIDE_TITLEBAR_WHEN_MAXIMIZED hint - means
 * I can do it once and forget about it, rather than tracking maximize/unmaximize
 * events.
 *
 * **Caveat**: doesn't work with Ubuntu's Ambiance and Radiance window themes -
 * my guess is they don't respect or implement this property.
 * 
 * I don't know how to read the inital value, so I'm not sure how to resore it.
 *
 * @param {Meta.Window} win - window to set the HIDE_TITLEBAR_WHEN_MAXIMIZED property of.
 * @param {boolean} hide - whether to hide the titlebar or not.
 * @param {boolean} [stopAdding] - if `win` does not have an actor and we couldn't
 * find the window's XID, we try one more time to detect the XID, unless this
 * is `true`. Internal use.
 */
function setHideTitlebar(win, hide, stopAdding) {

	let title = win.get_title();

	if (title == null || _isIgnorebleWindow(title)) {
		return;
	}


	if (title == null || title.indexOf("IntelliJ IDEA") != -1) {
		return;
	}

	LOG('setHideTitlebar: ' + title + ': ' + hide + (stopAdding ? ' (2)' : ''));

	let id = guessWindowXID(win);
	/* Newly-created windows are added to the workspace before
	 * the compositor knows about them: get_compositor_private() is null.
	 * Additionally things like .get_maximized() aren't properly done yet.
	 * (see workspace.js _doAddWindow)
	 */
	if (!id && !win.get_compositor_private() && !stopAdding) {
		Mainloop.idle_add(function () {
			setHideTitlebar(win, hide, true); // only try once more.
			return false; // define as one-time event
		});
		return;
	}

	_doHideTitlebar(win, hide, id);
}

function _doHideTitlebar(win, hide, id) {
	/* Undecorate with xprop. Use _GTK_HIDE_TITLEBAR_WHEN_MAXIMIZED.
	 * See (eg) mutter/src/window-props.c
	 */
	let cmd = ['xprop', '-id', id,
		   '-f', '_GTK_HIDE_TITLEBAR_WHEN_MAXIMIZED', '32c',
		   '-set', '_GTK_HIDE_TITLEBAR_WHEN_MAXIMIZED',
		   (hide ? '0x1' : '0x0')];

	// fallback: if couldn't get id for some reason, use the window's name
	if (!id) {
		cmd[1] = '-name';
		cmd[2] = win.get_title();
	}
	LOG(cmd.join(' '));
	
	// Run xprop
	[success, pid] = GLib.spawn_async(null, cmd, null,
					  GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
					  null);

	// After xprop completes, unmaximize and remaximize any window
	// that is already maximized. It seems that setting the xprop on
	// a window that is already maximized doesn't actually take
	// effect immediately but it needs a focuse change or other
	// action to force a relayout. Doing unmaximize and maximize
	// here seems to be an uninvasive way to handle this. This needs
	// to happen _after_ xprop completes.
	GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, function () {
		let flags = win.get_maximized();
		if (flags == Meta.MaximizeFlags.BOTH) {
			win.unmaximize(flags);
			win.maximize(flags);
		}
  });
}

/**** Callbacks ****/
/** Callback when a window is added in any of the workspaces.
 * This includes a window switching to another workspace.
 *
 * If it is a window we already know about, we do nothing.
 *
 * Otherwise, we activate the hide title on maximize feature.
 *
 * @param {Meta.Window} win - the window that was added.
 *
 * @see undecorate
 */
function onWindowAdded(ws, win) {
	// if the window is simply switching workspaces, it will trigger a
	// window-added signal. We don't want to reprocess it then because we already
	// have.
	if (win._pixelSaverOriginalState !== undefined) {
		return false;
	}
	
	/* Newly-created windows are added to the workspace before
	 * the compositor knows about them: get_compositor_private() is null.
	 * Additionally things like .get_maximized() aren't properly done yet.
	 * (see workspace.js _doAddWindow)
	 */
	// FIXME: get hide-titlebar-when-maximized value
	win._pixelSaverOriginalState = false;
	LOG('onWindowAdded: ' + win.get_title() + ' initially hide title ? ' + win._pixelSaverOriginalState);
	
	if(win._pixelSaverOriginalState === false) {
		setHideTitlebar(win, true);
	}
	
	return false;
}

let workspaces = [];

/** Callback whenever the number of workspaces changes.
 *
 * We ensure that we are listening to the 'window-added' signal on each of
 * the workspaces.
 *
 * @see onWindowAdded
 */
function onChangeNWorkspaces() {
	let i = workspaces.length;
	while (i--) {
		let ws = workspaces[i];
		ws.disconnect(ws._pixelSaverWindowAddedId);
	}
	
	workspaces = [];
	i = global.screen.n_workspaces;
	while (i--) {
		let ws = global.screen.get_workspace_by_index(i);
		workspaces.push(ws);
		// we need to add a Mainloop.idle_add, or else in onWindowAdded the
		// window's maximized state is not correct yet.
		ws._pixelSaverWindowAddedId = ws.connect('window-added', function (ws, win) {
			Mainloop.idle_add(function () { return onWindowAdded(ws, win); });
		});
	}
	
	return false;
}

/*
 * Subextension hooks
 */
function init() {
  _loadSettings();

  this._settingsListenerId = this._settingsObject.connect(
        'changed::ignorable-apps',
        Lang.bind(this, this._settingsChanged)
      );
}

function _settingsChanged() {
	this.ignorableApps = JSON.parse(this._settingsObject.get_string("ignorable-apps"));


	let apps = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null);


	for (let i = 0; i < apps.length; i++) {
		_doHideTitlebar(apps[i], !this._isIgnorebleWindow(apps[i].get_title()));
	}
}

function _loadSettings() {
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
  this.ignorableApps = JSON.parse(this._settingsObject.get_string("ignorable-apps"));
}

let changeWorkspaceID = 0;
function enable() {
	/* Connect events */
	changeWorkspaceID = global.screen.connect('notify::n-workspaces', onChangeNWorkspaces);
	
	/* Go through already-maximised windows & undecorate.
	 * This needs a delay as the window list is not yet loaded
	 *  when the extension is loaded.
	 * Also, connect up the 'window-added' event.
	 * Note that we do not connect this before the onMaximise loop
	 *  because when one restarts the gnome-shell, window-added gets
	 *  fired for every currently-existing window, and then
	 *  these windows will have onMaximise called twice on them.
	 */
	Mainloop.idle_add(function () {
		let winList = global.get_window_actors().map(function (w) { return w.meta_window; }),
			i       = winList.length;
		while (i--) {
			let win = winList[i];
			if (win.window_type === Meta.WindowType.DESKTOP) {
				continue;
			}
			onWindowAdded(null, win);
		}
		
		onChangeNWorkspaces();
		return false;
	});
}

function disable() {
	if (changeWorkspaceID) {
		global.window_manager.disconnect(changeWorkspaceID);
		changeWorkspaceID = 0;
	}
	
	/* disconnect window-added from workspaces */
	let i = workspaces.length;
	while (i--) {
		workspaces[i].disconnect(workspaces[i]._pixelSaverWindowAddedId);
		delete workspaces[i]._pixelSaverWindowAddedId;
	}
	workspaces = [];
	
	let winList = global.get_window_actors().map(function (w) { return w.meta_window; }),
		i       = winList.length;
	while (i--) {
		let win = winList[i];
		if (win.window_type === Meta.WindowType.DESKTOP) {
			continue;
		}
		LOG('stopUndecorating: ' + win.title);
		
		if (win._pixelSaverOriginalState === false) {
			setHideTitlebar(win, false);
		}
		delete win._pixelSaverOriginalState;
	}

	this._settingsObject.disconnect(this._settingsListenerId);

}
