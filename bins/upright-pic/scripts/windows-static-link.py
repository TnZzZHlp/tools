#!/usr/bin/env python3
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

COMPILER = "x86_64-w64-mingw32-gcc-posix"
CODECS = ["libheif.a", "libde265.a", "libkvazaar.a"]
RUNTIMES = ["libstdc++.a", "libwinpthread.a", "libgcc_eh.a", "libgcc.a"]


def link(args, prefix, cwd=None):
    index = args.index("-lheif")
    codecs = [str(prefix / "lib" / name) for name in CODECS]
    runtimes = [
        subprocess.check_output([COMPILER, "-print-file-name=" + name], text=True).strip()
        for name in RUNTIMES
    ]
    args[index:index + 1] = ["-Wl,--start-group", *codecs, *runtimes, "-Wl,--end-group"]
    result = subprocess.run([COMPILER, "-static-libgcc", *args], cwd=cwd)
    if result.returncode:
        raise SystemExit(result.returncode)


def save_inputs(args, kit):
    objects = kit / "objects"
    if objects.exists():
        shutil.rmtree(objects)
    objects.mkdir(parents=True)
    result = []
    args = iter(args)
    for arg in args:
        if arg == "-o":
            next(args)
            result.extend(["-o", "upright-pic.exe"])
        elif arg == "-L":
            next(args)
        elif arg.startswith("-L"):
            continue
        elif Path(arg).is_file():
            source = Path(arg)
            dest = objects / f"{len(result)}-{source.name}"
            shutil.copy2(source, dest)
            result.append(dest.relative_to(kit).as_posix())
        else:
            result.append(arg)
    (kit / "link-args.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")


def main():
    if sys.argv[1] == "--relink":
        kit = Path(__file__).resolve().parent
        args = json.loads((kit / "link-args.json").read_text(encoding="utf-8"))
        link(args, Path(sys.argv[2]).resolve(), cwd=kit)
    else:
        args = sys.argv[1:]
        link(args.copy(), Path(os.environ["UPRIGHT_NATIVE_PREFIX"]))
        save_inputs(args, Path(os.environ["UPRIGHT_LINK_KIT"]))


if __name__ == "__main__":
    main()
