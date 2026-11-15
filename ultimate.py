"""Prepare and run the desktop Voidify bundle."""
import configparser
import hashlib
import os
import json
import platform
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def prepare():
    system = platform.system().lower()
    machine = platform.machine().lower()
    arches = {
        "windows": {"amd64": "x64", "x86_64": "x64", "x86": "x32", "arm64": "arm64"},
        "darwin": {"arm64": "arm64", "x86_64": "amd64"},
        "linux": {"x86_64": "amd64", "amd64": "amd64", "aarch64": "arm64", "arm64": "arm64"},
    }
    arch = arches.get(system, {}).get(machine)
    if not arch:
        sys.exit(f"No pinned desktop release for {system}/{machine}. See cli/ for source builds.")
    suffix = ".zip" if system == "windows" else ".tar.gz"
    target = f"{system}-{arch}"
    assets = json.loads((ROOT / "cli-assets.json").read_text(encoding="utf-8-sig"))
    asset = next(a for a in assets if a["name"].endswith(target + suffix))
    cache = ROOT / ".runtime"
    revision = hashlib.sha256((ROOT / "cli-assets.json").read_bytes()).hexdigest()[:12]
    dest = cache / f"{target}-{revision}"
    binary = "voidify.exe" if system == "windows" else "voidify"
    if (dest / binary).is_file():
        return dest / binary
    cache.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=cache) as temp:
        archive = Path(temp) / asset["name"]
        print(f"Downloading {asset['name']} ...", flush=True)
        with urllib.request.urlopen(asset["url"], timeout=90) as response, archive.open("wb") as out:
            shutil.copyfileobj(response, out)
        if "sha256:" + hashlib.sha256(archive.read_bytes()).hexdigest() != asset["digest"]:
            sys.exit("The CLI archive failed its SHA-256 check.")
        stage = Path(temp) / "bundle"
        shutil.unpack_archive(archive, stage)
        if not (stage / binary).is_file():
            sys.exit("The release archive is missing the CLI executable.")
        shutil.copytree(ROOT / "marketplace-dist", stage / "CustomApps" / "marketplace", dirs_exist_ok=True)
        theme = stage / "Themes" / "marketplace"
        theme.mkdir(exist_ok=True)
        shutil.copy2(ROOT / "marketplace/resources/color.ini", theme)
        for palette in (ROOT / "spicetify-themes").glob("*/color.ini"):
            shutil.copytree(palette.parent, stage / "Themes" / palette.parent.name, dirs_exist_ok=True)
        try:
            stage.rename(dest)
        except OSError:
            if not (dest / binary).is_file():
                raise
    return dest / binary


def desktop_setup(shortcut=True):
    with tempfile.TemporaryDirectory() as resources:
        stage = Path(resources)
        for name in ("Archivo.ttf", "Archivo-OFL.txt", "Install-Desktop.ps1", "Player.cs", "voidify-desktop.js", "Apply-Brand.ps1", "voidify-login.css", "voidify-ui.css", "voidify-color.ini"):
            shutil.copy2(ROOT / "desktop/windows" / name, stage)
        shutil.copy2(ROOT / "marketplace/src/assets/icon-filled.svg", stage / "voidify-mark.svg")
        shutil.copy2(ROOT / "cli-assets.json", stage)
        shutil.copy2(ROOT / "desktop/windows/voidify-taskbar.ico", stage / "voidify-taskbar.ico")
        command = ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "RemoteSigned",
                   "-File", str(stage / "Install-Desktop.ps1"), "-Resources", resources]
        if not shortcut:
            command.append("-SkipShortcut")
        env = os.environ.copy()
        # Windows PowerShell must discover its own modules when invoked from PowerShell 7.
        env.pop("PSMODULEPATH", None)
        subprocess.run(command, env=env, check=True)


def windows_desktop(args):
    if args in (["prepare"], ["install"], ["cli", "update"]):
        desktop_setup(shortcut=args != ["prepare"])
        return
    if args[:1] != ["cli"] or len(args) < 2:
        sys.exit("Use prepare, install, or cli COMMAND.")
    commands = args[1:]
    root = Path(os.environ["LOCALAPPDATA"]) / "VoidifyDesktop"
    marker = root / "current.txt"
    if not marker.exists():
        sys.exit("Run python ultimate.py install to create the private Voidify player first.")
    key = marker.read_text().strip()
    if len(key) != 32 or any(c not in "0123456789abcdef" for c in key):
        sys.exit("Invalid desktop build marker. Run the installer again.")
    build = root / "Builds" / key
    if commands == ["launch"]:
        subprocess.Popen([str(build / "Voidify.exe")])
        return
    if commands[0] == "config":
        keys = {"current_theme", "color_scheme", "extensions", "custom_apps",
                "inject_css", "replace_colors", "inject_theme_js", "overwrite_assets"}
        if any(field not in keys for field in commands[1::2]) or any(v.startswith("-") for v in commands[2::2]):
            sys.exit("Desktop config supports theme, extension, and custom app settings.")
    elif commands not in (["apply"], ["restore"], ["-v"], ["-h"], ["--version"], ["--help"]):
        sys.exit("Desktop commands: launch, update, apply, restore, config, -h, -v.")
    config = configparser.ConfigParser(interpolation=None)
    config.read(build / "Config/config-xpui.ini", encoding="utf-8-sig")
    for field, target in (("spotify_path", build / "Client"), ("prefs_path", build / "prefs")):
        if not target.exists() or Path(config.get("Setting", field, fallback="")).resolve() != target.resolve():
            sys.exit("Private client configuration is invalid. Run the installer again.")
    if not (build / "Client/Apps").is_dir():
        sys.exit("Private client files are missing. Run the installer again.")
    env = os.environ.copy()
    env.pop("SPICETIFY_STATE", None)
    env.update(SPICETIFY_CONFIG=str(build / "Config"), USERPROFILE=str(build / "User"),
               APPDATA=str(build / "Roaming"), LOCALAPPDATA=str(build / "Local"))
    subprocess.run([build / "Engine/voidify.exe", *commands, "--no-restart"], env=env, check=True)



def main(args):
    if not args or args[0] in ("-h", "--help"):
        print("Usage: python ultimate.py prepare | install | cli [VOIDIFY_ARGS ...]")
        return
    if platform.system() == "Windows":
        windows_desktop(args)
        return
    if args[0] == "cli":
        subprocess.run([prepare(), *args[1:]], check=True)
    elif args == ["prepare"]:
        print(prepare())
    elif args == ["install"]:
        exe = prepare()
        subprocess.run([exe, "config", "custom_apps", "marketplace", "inject_css", "1",
                        "replace_colors", "1", "current_theme", "marketplace"], check=True)
        # Auto creates or updates the backup when needed. Apply also refreshes
        # existing patched clients after the configuration change.
        subprocess.run([exe, "auto", "apply"], check=True)
    else:
        sys.exit("Unknown arguments. Run python ultimate.py --help.")


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except subprocess.CalledProcessError as error:
        sys.exit(error.returncode)
    except OSError as error:
        sys.exit(str(error))
