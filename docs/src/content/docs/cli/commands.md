---
title: Commands
description: Complete Voidify command reference.
---

This page documents all Voidify CLI commands.

## Core Commands

### `spicetify` (no arguments)

Run with no arguments to generate the config file on first run, or verify your setup.

```bash
spicetify
```

### `backup`

Create a backup of vanilla Spotify files. Required before applying Voidify for the first time.

```bash
voidify backup
```

### `apply`

Apply Voidify modifications to Spotify.

```bash
voidify apply
```

This injects your theme, extensions, custom apps, and other modifications into Spotify.

### `restore`

Remove all Voidify modifications and restore Spotify to vanilla state.

```bash
voidify restore
```

Your config file and customization files are preserved.

### `update`

Hot-reload theme changes without full restart. Use this during theme development.

```bash
voidify update
```

After running, press <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd> (or <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd> on macOS) in Spotify to see changes.

### `upgrade`

Upgrade Voidify to the latest version (only works with script-based installations).

```bash
spicetify upgrade
```

---

## Configuration Commands

### `config`

View or modify configuration values.

**View all settings:**

```bash
voidify config
```

**View a specific setting:**

```bash
voidify config current_theme
```

**Set a value:**

```bash
voidify config current_theme Sleek
```

**Set multiple values:**

```bash
voidify config current_theme Sleek color_scheme Dark
```

**Add to a list (extensions, custom_apps):**

```bash
voidify config extensions fullAppDisplay.js
```

This appends to existing extensions, not replaces.

**Remove from a list:**

```bash
voidify config extensions fullAppDisplay.js-
```

Note the trailing `-`.

### `config-dir`

Open the Voidify config directory in your file manager.

```bash
voidify config-dir
```

### `-c` / `--config`

Print the config file path.

```bash
voidify -c
```

---

## Utility Commands

### `enable-devtools`

Enable Chromium DevTools in Spotify. Useful for debugging themes and extensions.

```bash
voidify enable-devtools
```

Access DevTools with <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>I</kbd>.

### `watch`

Watch for theme changes and auto-apply. Useful during development.

```bash
voidify watch
```

Monitors `color.ini` and `user.css` in your current theme folder.

### `path`

Print various Spicetify-related paths.

```bash
voidify path
voidify path userdata   # Config directory
voidify path spotify    # Spotify installation
```

### `auto`

Automatically backup (if needed) and apply, then launch Spotify.

```bash
voidify auto
```

Useful as a shortcut target instead of the Spotify executable.

---

## Combined Commands

Commands can be combined in a single call:

```bash
# First-time setup
voidify backup apply enable-devtools

# After Spotify updates
voidify backup apply

# Full restore and reapply
voidify restore backup apply
```

---

## Flags

### `--help` / `-h`

Show help for a command.

```bash
voidify --help
voidify --help config
```

### `--version` / `-v`

Show Voidify version.

```bash
voidify --version
```

### `--no-restart`

Apply changes without restarting Spotify.

```bash
voidify apply --no-restart
```

### `--quiet` / `-q`

Suppress non-error output.

```bash
voidify apply -q
```

### `--extension` / `-e`

Specify a single extension to apply (useful for testing).

```bash
voidify apply -e myExtension.js
```

---

## Examples

### Fresh Install Workflow

```bash
# Install Voidify (see Installation page)
# Generate config
spicetify

# First-time setup
voidify backup apply enable-devtools
```

### Enable an Extension

```bash
voidify config extensions fullAppDisplay.js
voidify apply
```

### Change Theme

```bash
voidify config current_theme Sleek color_scheme Dark
voidify apply
```

### After Spotify Updates

```bash
voidify backup apply
```

### Theme Development

```bash
# One-time: apply your theme
voidify config current_theme MyTheme
voidify apply

# During development: watch for changes
voidify watch
```
