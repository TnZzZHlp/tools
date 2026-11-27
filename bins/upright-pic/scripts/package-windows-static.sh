#!/usr/bin/env bash
set -euo pipefail

if [[ $# != 2 ]]; then
    printf 'Usage: %s NATIVE_SOURCE_DIRECTORY BUILD_DIRECTORY\n' "$0" >&2
    exit 2
fi

scripts=$(cd -- "$(dirname -- "$0")" && pwd -P)
root=$(dirname -- "$scripts")
mkdir -p "$2"
build=$(cd "$2" && pwd -P)
triplet=x86_64-pc-windows-gnu

bash "$scripts/build-windows-codecs.sh" "$1" "$build/native"
export UPRIGHT_NATIVE_PREFIX="$build/native/prefix"
export UPRIGHT_LINK_KIT="$build/relink"
export PKG_CONFIG_ALLOW_CROSS_x86_64_pc_windows_gnu=1
export PKG_CONFIG_LIBDIR_x86_64_pc_windows_gnu="$UPRIGHT_NATIVE_PREFIX/lib/pkgconfig"
export LIBHEIF_DYNAMIC=1

cargo rustc --manifest-path "$root/Cargo.toml" --locked --release --target "$triplet" \
    --target-dir "$build/cargo" -- -C "linker=$scripts/windows-static-link.py" -C strip=symbols
exe="$build/cargo/$triplet/release/upright-pic.exe"
imports=$(x86_64-w64-mingw32-objdump -p "$exe" | awk '/DLL Name:/ { print tolower($3) }')
if [[ -z $imports ]]; then
    printf 'Could not read executable imports\n' >&2
    exit 1
fi
while IFS= read -r dll; do
    case "$dll" in
        api-ms-win-*.dll|advapi32.dll|bcrypt.dll|bcryptprimitives.dll|kernel32.dll|msvcrt.dll|ntdll.dll|userenv.dll|ws2_32.dll) ;;
        *) printf 'Unexpected DLL dependency: %s\n' "$dll" >&2; exit 1 ;;
    esac
done <<< "$imports"
install -m 755 "$exe" "$build/upright-pic.exe"
install -m 755 "$scripts/windows-static-link.py" "$scripts/build-windows-codecs.sh" "$UPRIGHT_LINK_KIT/"
mkdir -p "$UPRIGHT_LINK_KIT/native/lib"
cp "$UPRIGHT_NATIVE_PREFIX/lib/"{libheif,libde265,libkvazaar}.a "$UPRIGHT_LINK_KIT/native/lib/"
