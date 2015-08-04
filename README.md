GnomeExtensionMaximusTwo
========================

Removes the title bar on maximised windows. See: https://extensions.gnome.org/extension/844/maximus-two/

Prerequisites
=============
You will need `xprop` and `xwininfo` installed for this extension to work.
Under Arch, this should be provided as a dependencie of [`xorg-utils`](https://www.archlinux.org/packages/extra/any/xorg-utils/) package (the [`xorg-xprop`](https://www.archlinux.org/packages/extra/x86_64/xorg-xprop/) & [`xorg-xwininfo`](https://www.archlinux.org/packages/extra/x86_64/xorg-xwininfo/) packages.)<br>
Under Debian/Ubuntu/*(and probably most other debian based distros)*, this is provided by the [`x11-utils`](http://packages.ubuntu.com/trusty/x11-utils) package<br>
Under Fedora, these programs are provided by the [`xorg-x11-utils`](https://apps.fedoraproject.org/packages/xorg-x11-utils) package.


How to install
==============
 - Visit https://extensions.gnome.org/extension/844/maximus-two/ on the machine you want to install it on. If prompted, allow the activation of the 'Gnome Shell Integration' Plugin.
 - Click the ON/OFF button on the page: ![](http://i.imgur.com/QHrIgTb.png)
 - When prompted, choose 'Install' ![](http://i.imgur.com/HAnYsqT.png)
 - The extension should be installed and working - a shell restart may be required, you can do this by pressing <kbd>Alt</kbd>+<kbd>F2</kbd>, entering `r` and pressing <kbd>Enter</kbd>. ![](http://i.imgur.com/q3fp2qL.png)
 - If it works (or doesn't work) for you, leave a review on the page! :)
 
You can manage the extension and other Gnome Shell extensions using https://extensions.gnome.org/local/ , or by using [Gnome Tweak Tool](https://wiki.gnome.org/action/show/Apps/GnomeTweakTool):

![](https://i.imgur.com/3QdnddJ.png)

Version History
===============

1. Basic modifaction of https://extensions.gnome.org/extension/723/pixel-saver/ .
2. Added (some) support for Gnome 3.14.
