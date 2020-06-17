# blitz for VS Code

[![Visual Studio Marketplace](https://vsmarketplacebadge.apphb.com/version/wraith13.blitz.svg) ![installs](https://vsmarketplacebadge.apphb.com/installs/wraith13.blitz.svg) ![rating](https://vsmarketplacebadge.apphb.com/rating/wraith13.blitz.svg)](https://marketplace.visualstudio.com/items?itemName=wraith13.blitz)

Smart search your codes.

## Features

Blitz scans your code and enumerates all tokens and provides access to them.

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

* `Blitz: Edit Settings` : Access to tokens in your codes with menu.

## Extension Settings

This extension contributes the following settings by [`settings.json`](https://code.visualstudio.com/docs/customization/userandworkspace#_creating-user-and-workspace-settings)( Mac: <kbd>Command</kbd>+<kbd>,</kbd>, Windows / Linux: <kbd>File</kbd> -> <kbd>Preferences</kbd> -> <kbd>User Settings</kbd> ):

* `blitz.statusBarAlignment`: Alignment on status bar. Requires a restart to take effect.
* `blitz.statusBarText`: Status bar's label.

## Keyboard shortcut Settings

In default, blitz's commands doesn't apply keyboard shortcuts. Althogh,
you can apply keyboard shortcuts by [`keybindings.json`](https://code.visualstudio.com/docs/customization/keybindings#_customizing-shortcuts)
( Mac: <kbd>Code</kbd> -> <kbd>Preferences</kbd> -> <kbd>Keyboard Shortcuts</kbd>, Windows / Linux: <kbd>File</kbd> -> <kbd>Preferences</kbd> -> <kbd>Keyboard Shortcuts</kbd>).

Command name on `keybindings.json` is diffarent from on Command Pallete. See below table.

|on Command Pallete|on keybindings.json|
|-|-|
|`Blitz: Edit Settings`|`blitz.editSettings`|

## Release Notes

see ChangLog on [marketplace](https://marketplace.visualstudio.com/items/wraith13.blitz/changelog) or [github](https://github.com/wraith13/blitz-vscode/blob/master/CHANGELOG.md)

## Support

[GitHub Issues](https://github.com/wraith13/blitz-vscode/issues)

## License

[Boost Software License](https://github.com/wraith13/blitz-vscode/blob/master/LICENSE_1_0.txt)
