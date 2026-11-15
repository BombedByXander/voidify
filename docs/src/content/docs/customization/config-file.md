---
title: Configuration Reference
description: Complete reference for Spicetify's config file.
---

Voidify stores its configuration in `config-xpui.ini`. This page documents all available options.

## File Location

| Platform | Path |
|----------|------|
| **Windows** | `%appdata%\spicetify\config-xpui.ini` |
| **Linux / macOS** | `~/.config/spicetify/config-xpui.ini` |

To find the exact path:

```bash
voidify -c
```

To open the config folder:

```bash
voidify config-dir
```

## Editing Configuration

### Via CLI (Recommended)

```bash
voidify config <key> <value>
voidify apply
```

Examples:

```bash
# Set a theme
voidify config current_theme Sleek

# Add an extension
voidify config extensions fullAppDisplay.js

# Remove an extension (note the trailing -)
voidify config extensions fullAppDisplay.js-

# Set multiple values at once
voidify config current_theme Sleek color_scheme Dark
```

### Via Direct File Editing

Open `config-xpui.ini` in any text editor, make changes, save, then run:

```bash
voidify apply
```

---

## Configuration Sections

### [Setting]

Core paths and settings.

| Key | Description | Example |
|-----|-------------|---------|
| `spotify_path` | Path to Spotify installation | `/opt/spotify` |
| `prefs_path` | Path to Spotify's `prefs` file | `~/.config/spotify/prefs` |
| `spotify_launch_flags` | Flags passed when launching Spotify | `--remote-debugging-port=9222` |
| `check_spicetify_upgrade` | Check for Voidify updates on startup | `1` (enabled) |

### [Preprocesses]

Control CSS/color injection.

| Key | Description | Default |
|-----|-------------|---------|
| `disable_sentry` | Disable Spotify's error reporting | `1` |
| `disable_ui_logging` | Disable UI telemetry | `1` |
| `remove_rtl_rule` | Remove right-to-left CSS rules | `1` |
| `expose_apis` | Expose Voidify APIs to extensions | `1` |

### [AdditionalOptions]

Theme and add-on configuration.

| Key | Description | Example |
|-----|-------------|---------|
| `current_theme` | Active theme folder name | `Sleek` |
| `color_scheme` | Color scheme within current theme | `Dark` |
| `extensions` | Enabled extensions (pipe-separated) | `fullAppDisplay.js\|trashbin.js` |
| `custom_apps` | Enabled custom apps (pipe-separated) | `reddit\|lyrics-plus` |
| `inject_css` | Inject theme CSS | `1` |
| `inject_theme_js` | Inject theme JavaScript (if present) | `1` |
| `replace_colors` | Apply theme colors | `1` |
| `overwrite_assets` | Allow themes to replace assets | `0` |
| `sidebar_config` | Sidebar customization (auto-generated) | - |
| `home_config` | Homepage customization (auto-generated) | - |

### [Patch]

Low-level patches. Usually leave these alone.

| Key | Description | Default |
|-----|-------------|---------|
| `xpui.js_find_8008` | Enable specific patching | Varies |
| `xpui.js_repl_8008` | Replacement value for patch | Varies |

---

## Common Tasks

### See All Current Settings

```bash
voidify config
```

### Reset to Defaults

```bash
voidify restore
```

This removes Voidify modifications from Spotify but keeps your config file.

### Backup Current State

```bash
voidify backup
```

Creates a backup of vanilla Spotify that can be restored later.

### Full Reset

To completely start fresh:

```bash
voidify restore
rm ~/.config/spicetify/config-xpui.ini  # Linux/macOS
# or on Windows: del %appdata%\spicetify\config-xpui.ini
spicetify
```

Running `spicetify` with no config file regenerates the default configuration.

---

## Getting Help

For detailed help on any config option:

```bash
voidify --help config
```

For all available commands:

```bash
voidify --help
```
