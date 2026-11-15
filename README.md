# Voidify

One checkout for the Spicetify CLI, Marketplace, themes, and developer projects. This is an unofficial collection maintained by BombedByXander. The Spicetify team and individual contributors maintain the upstream projects.

## Install the desktop bundle

![Voidify](docs/public/images/spicetify-full.png)

### Windows · Voidify Desktop

Install Spotify from the Spotify website and open it once. In regular PowerShell, run:

```powershell
iwr -useb https://raw.githubusercontent.com/BombedByXander/voidify/main/cli/install.ps1 | iex
```

Open **Voidify** from Start. Setup copies the Windows player into `%LOCALAPPDATA%\VoidifyDesktop`, applies Marketplace and the Voidify interface to that copy, and creates its own shortcut and browser profile. Sign in to the Voidify window. Store-only installations need the website edition for this workflow.

Run the same installer after Spotify updates to rebuild the private copy. A successful rebuild switches the shortcut to the new build and keeps the shared Voidify player profile. To uninstall, close Voidify and remove its Start menu shortcut and the VoidifyDesktop directory. Older in-place CLI installations are separate and can still target original Spotify.

### macOS and Linux · CLI customization

These installers customize the installed Spotify client:

```sh
curl -fsSL https://raw.githubusercontent.com/BombedByXander/voidify/main/cli/install.sh | sh
```

Choose Yes to enable Voidify Marketplace. Run `voidify -h` for commands.

### Install from a checkout

Install Python 3.9+ and open Spotify desktop at least once. Run these commands as your regular desktop user. On macOS or Linux, use `python3` if that is your Python command.

```sh
git clone https://github.com/BombedByXander/voidify.git
cd voidify
python ultimate.py install
```

On Windows the Python installer creates the same private player. On macOS and Linux the launcher downloads the pinned Voidify 2.46.7 release for your platform, checks its SHA-256 digest, and assembles the CLI, Voidify Marketplace (based on 1.0.12), and 15 themes under `.runtime/`. Install enables the Marketplace app, selects its theme, turns on CSS and color replacement, and runs the CLI's backup and apply logic. Spotify restarts. Open **Voidify Marketplace** in its sidebar to browse community content.

On macOS and Linux, install updates your active Spicetify configuration. The CLI gives custom apps and themes in your user configuration directory priority over bundled copies with the same name. To assemble the bundle without touching Spotify, run `python ultimate.py prepare`.

Pinned binary targets include Windows x64, x86, and ARM64, macOS Intel and Apple Silicon, and Linux x86-64 and ARM64. Keep the checkout while using the launcher.

## Use the bundled CLI

```sh
python ultimate.py cli -v
python ultimate.py cli config current_theme Sleek
python ultimate.py cli apply
```

Windows CLI commands target the active private build. Use `python ultimate.py cli launch` to open it and `python ultimate.py cli update` to rebuild it. On macOS and Linux the launcher forwards CLI arguments to Spicetify. Use `python ultimate.py cli restore` to restore Spotify from its backup. Some themes require additional settings or extensions. See the [theme instructions](spicetify-themes/).

## Repository guide

| Project | Contents |
| --- | --- |
| [CLI](cli/) | Go CLI source, built-in extensions, and custom apps |
| [Marketplace](marketplace/) | TypeScript app source. The launcher uses the matching [release build](marketplace-dist/). |
| [Themes](spicetify-themes/) | Community themes, screenshots, and setup instructions |
| [Extensions index](spicetify-extensions/) | Archived upstream catalog. Community downloads are available through Marketplace. |
| [Creator](spicetify-creator/) | Build tools for extensions and custom apps |
| [Docs](docs/) | Documentation site source |
| [Services](services/) | Service used for cross-origin requests |
| [Modules](modules/) Â· [Hooks](hooks/) Â· [Class maps](classmaps/) Â· [Package index](pkgs/) | Spicetify v3 development sources and registry data |
| [Actions](actions/) | Shared GitHub Actions for upstream development |
| [Android patches](morphe-patches/) | Android project with its own build and installation instructions |

The desktop launcher targets the released v2 CLI. The v3 and Android projects have independent build workflows. Marketplace fetches third-party catalog entries and downloads online.

## Source and updates

[upstreams.json](upstreams.json) records the original URL and exact Git commit for every imported source tree. Each directory keeps its upstream files and license notices. Voidify release archives contain the rebuilt CLI, Marketplace, and themes. When editing Marketplace locally, build it with the instructions in [marketplace/package.json](marketplace/package.json), replace the contents of `marketplace-dist/` with the build output, and remove the generated `.runtime/` directory before running prepare again.
