const Meta = imports.gi.Meta;
const MAXIMIZED = Meta.MaximizeFlags.BOTH;
// Get shell version
var shell_version = parseFloat(imports.misc.config.PACKAGE_VERSION.split('.').slice(0, 2).join('.'));
// Fix for API >= 3.29
// https://www.reddit.com/r/gnome/comments/9kraax/globaldisplay_or_globalscreen_in_gnomeshell/
var GD = global.display;
var WSM = (shell_version < 3.29) ? global.screen : global.workspace_manager;

function getWindow() {
    // get all window in stacking order.
    // log("GD: ", global.display);
    // log("WSM: ", global.workspace_manager);
    let windows = GD.sort_windows_by_stacking(
        WSM.get_active_workspace().list_windows().filter(function(w) {
            // log("w", w);
            return w.get_window_type() !== Meta.WindowType.DESKTOP;
        })
    );

    let i = windows.length;
    while (i--) {
        let window = windows[i];
        if (window.get_maximized() === MAXIMIZED && !window.minimized) {
            return window;
        }
    }

    return null;
}
