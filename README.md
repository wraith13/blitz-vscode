# Blitz for VS Code

[![Visual Studio Marketplace](https://vsmarketplacebadge.apphb.com/version/wraith13.blitz.svg) ![installs](https://vsmarketplacebadge.apphb.com/installs/wraith13.blitz.svg) ![rating](https://vsmarketplacebadge.apphb.com/rating/wraith13.blitz.svg)](https://marketplace.visualstudio.com/items?itemName=wraith13.blitz)

Quickly config for VS Code.

## Features

- Quick pick based setting
- Setting preview
- Setting undo/redo
- Reuse recently setting values

<!-- ![screenshot](images/screenshot.png) -->

## Tutorial

### 0. ⬇️ Install Blitz

Show extension side bar within VS Code(Mac:<kbd>Command</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd>, Windows and Linux: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd>), type `blitz` and press <kbd>Enter</kbd> and click <kbd>Install</kbd>.

### 1. 🚀 Edit settings

Launch Command Palette, Execute `Blitz: Edit Settings` command or click eys icon on status bar. You can edit VS Code settings.

### 2. 🔧 Next step

You can change [settings](#extension-settings) by `settings.json`. And you can apply [keyboard shortcuts](#keyboard-shortcut-settings) by `keybindings.json`.

Enjoy!

## Commands

* `Blitz: Edit Settings` : Edit VS Code's settings.
* `Blitz: Undo Setting` : Undo VS Code's settings.
* `Blitz: Redo Setting` : Redo VS Code's settings.
* `Blitz: Clear Setting History` : Clear recently information.

## Extension Settings

This extension contributes the following settings by [`settings.json`](https://code.visualstudio.com/docs/customization/userandworkspace#_creating-user-and-workspace-settings)( Mac: <kbd>Command</kbd>+<kbd>,</kbd>, Windows / Linux: <kbd>File</kbd> -> <kbd>Preferences</kbd> -> <kbd>User Settings</kbd> ):

* `blitz.statusBarAlignment`: Alignment on status bar.
* `blitz.statusBarText`: Status bar's label.

## Keyboard shortcut Settings

In default, blitz's commands doesn't apply keyboard shortcuts. Althogh,
you can apply keyboard shortcuts by [`keybindings.json`](https://code.visualstudio.com/docs/customization/keybindings#_customizing-shortcuts)
( Mac: <kbd>Code</kbd> -> <kbd>Preferences</kbd> -> <kbd>Keyboard Shortcuts</kbd>, Windows / Linux: <kbd>File</kbd> -> <kbd>Preferences</kbd> -> <kbd>Keyboard Shortcuts</kbd>).

Command name on `keybindings.json` is diffarent from on Command Pallete. See below table.

|on Command Pallete|on keybindings.json|
|-|-|
|`Blitz: Edit Settings`|`blitz.editSettings`|
|`Blitz: Undo Setting`|`blitz.undoSetting`|
|`Blitz: Redo Setting`|`blitz.redoSetting`|
|`Blitz: Clear Setting History`|`blitz.clearHistory`|

## Release Notes

see ChangLog on [marketplace](https://marketplace.visualstudio.com/items/wraith13.blitz/changelog) or [github](https://github.com/wraith13/blitz-vscode/blob/master/CHANGELOG.md)

## Support

[GitHub Issues](https://github.com/wraith13/blitz-vscode/issues)

## License

[Boost Software License](https://github.com/wraith13/blitz-vscode/blob/master/LICENSE_1_0.txt)

## Other extensions of wraith13's work

|Icon|Name|Description|
|---|---|---|
|![](https://wraith13.gallerycdn.vsassets.io/extensions/wraith13/background-phi-colors/3.1.0/1581619161244/Microsoft.VisualStudio.Services.Icons.Default) |[Background Phi Colors](https://marketplace.visualstudio.com/items?itemName=wraith13.background-phi-colors)|This extension colors the background in various ways.|
|![](https://wraith13.gallerycdn.vsassets.io/extensions/wraith13/zoombar-vscode/1.2.1/1563089420894/Microsoft.VisualStudio.Services.Icons.Default) |[Zoom Bar](https://marketplace.visualstudio.com/items?itemName=wraith13.zoombar-vscode)|Zoom UI in status bar for VS Code.|
|![](https://wraith13.gallerycdn.vsassets.io/extensions/wraith13/unsaved-files-vscode/2.1.1/1562823380255/Microsoft.VisualStudio.Services.Icons.Default) |[Unsaved Files](https://marketplace.visualstudio.com/items?itemName=wraith13.unsaved-files-vscode)|Easy access to unsaved files for VS Code.|

See all wraith13's  expansions: <https://marketplace.visualstudio.com/publishers/wraith13>
