# Spicetify Ultimate

One checkout for the Spicetify CLI, Marketplace, themes, and developer projects. This is an unofficial collection maintained by BombedByXander. The Spicetify team and individual contributors maintain the upstream projects.

## Install the desktop bundle

Install Python 3.9+ and open Spotify desktop at least once. Run these commands as your regular desktop user. On macOS or Linux, use `python3` if that is your Python command.

```sh
git clone https://github.com/BombedByXander/spicetify-ultimate.git
cd spicetify-ultimate
python ultimate.py install
```

The launcher downloads the pinned CLI 2.46.7 release for your platform, checks its SHA-256 digest, and assembles the CLI, Marketplace 1.0.12, and 15 themes under `.runtime/`. Install enables the Marketplace app, selects its theme, turns on CSS and color replacement, and runs the CLI's backup and apply logic. Spotify restarts. Open **Marketplace** in its sidebar to browse community content.

For an existing setup, install updates your active Spicetify configuration. The CLI gives custom apps and themes in your user configuration directory priority over bundled copies with the same name. To assemble the bundle without touching Spotify, run `python ultimate.py prepare`.

Pinned binary targets include Windows x64, x86, and ARM64, macOS Intel and Apple Silicon, and Linux x86-64. Keep the checkout while using the launcher.

## Use the bundled CLI

```sh
python ultimate.py cli -v
python ultimate.py cli config current_theme Sleek
python ultimate.py cli apply
```

The launcher passes everything after `cli` to Spicetify. Use `python ultimate.py cli restore` to restore Spotify from its backup. Some themes require additional settings or extensions. See the [theme instructions](spicetify-themes/).

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
| [Modules](modules/) · [Hooks](hooks/) · [Class maps](classmaps/) · [Package index](pkgs/) | Spicetify v3 development sources and registry data |
| [Actions](actions/) | Shared GitHub Actions for upstream development |
| [Android patches](morphe-patches/) | Android project with its own build and installation instructions |

The desktop launcher targets the released v2 CLI. The v3 and Android projects have independent build workflows. Marketplace fetches third-party catalog entries and downloads online.

## Source and updates

[upstreams.json](upstreams.json) records the original URL and exact Git commit for every imported source tree. Each directory keeps its upstream files and license notices. The prepared desktop bundle uses the official release assets. When editing Marketplace locally, build it with the instructions in [marketplace/package.json](marketplace/package.json), replace the contents of `marketplace-dist/` with the build output, and remove the generated `.runtime/` directory before running prepare again.

For a version update, import the new tagged CLI and Marketplace source trees, update their commits in the manifest, refresh [the CLI release URLs and digests](cli-assets.json), and unpack the matching Marketplace release into `marketplace-dist/`. The current Marketplace archive is [marketplace.zip from v1.0.12](https://github.com/spicetify/marketplace/releases/tag/v1.0.12), SHA-256 `43c8ccff189636cf2a8e8b5ca77e87487d22599ff8dc53b692170f92cbbb4e16`.
