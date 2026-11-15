"""Prepare and run the desktop Voidify bundle."""
import hashlib
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


def main(args):
    if not args or args[0] in ("-h", "--help"):
        print("Usage: python ultimate.py prepare | install | cli [VOIDIFY_ARGS ...]")
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
