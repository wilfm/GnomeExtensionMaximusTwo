const Meta = imports.gi.Meta;
const MAXIMIZED = Meta.MaximizeFlags.BOTH;
// Fix for API >= 3.29
const GScreen = global.screen || global.display;

function getWindow() {
    // get all window in stacking order.
    let windows = global.display.sort_windows_by_stacking(
        GScreen.get_active_workspace().list_windows().filter(function(w) {
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
