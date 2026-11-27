#!/usr/bin/env bash
set -euo pipefail

if [[ $# != 2 ]]; then
    printf 'Usage: %s NATIVE_SOURCE_DIRECTORY BUILD_DIRECTORY\n' "$0" >&2
    exit 2
fi

sources=$(cd "$1" && pwd -P)
mkdir -p "$2"
build=$(cd "$2" && pwd -P)
prefix="$build/prefix"
compiler=x86_64-w64-mingw32
jobs=${CMAKE_BUILD_PARALLEL_LEVEL:-$(nproc)}

build_codec() {
    local source=$1
    local name=${source%%-*}
    shift
    cmake -S "$sources/$source" -B "$build/$name" -G Ninja \
        -DCMAKE_SYSTEM_NAME=Windows -DCMAKE_SYSTEM_PROCESSOR=x86_64 \
        -DCMAKE_C_COMPILER="$compiler-gcc-posix" -DCMAKE_CXX_COMPILER="$compiler-g++-posix" \
        -DCMAKE_RC_COMPILER="$compiler-windres" -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_INSTALL_PREFIX="$prefix" -DCMAKE_INSTALL_LIBDIR=lib \
        -DBUILD_SHARED_LIBS=OFF "$@"
    cmake --build "$build/$name" --parallel "$jobs"
    cmake --install "$build/$name"
}

build_codec libde265-1.0.16 -DENABLE_SDL=OFF -DENABLE_DECODER=OFF
build_codec kvazaar-2.3.2 -DBUILD_TESTS=OFF -DBUILD_KVAZAAR_BINARY=OFF -DCMAKE_C_FLAGS=-DKVZ_STATIC_LIB
build_codec libheif-1.23.7 \
    '-DCMAKE_CXX_FLAGS=-DLIBHEIF_STATIC_BUILD -DLIBDE265_STATIC_BUILD -DKVZ_STATIC_LIB' \
    -DCMAKE_PREFIX_PATH="$prefix" \
    -DLIBDE265_INCLUDE_DIR="$prefix/include" -DLIBDE265_LIBRARY="$prefix/lib/libde265.a" \
    -DKVAZAAR_INCLUDE_DIR="$prefix/include" -DKVAZAAR_LIBRARY="$prefix/lib/libkvazaar.a" \
    -DWITH_LIBDE265=ON -DWITH_KVAZAAR=ON -DENABLE_PLUGIN_LOADING=OFF \
    -DWITH_X265=OFF -DWITH_X264=OFF -DWITH_OpenH264_DECODER=OFF \
    -DWITH_AOM_DECODER=OFF -DWITH_AOM_ENCODER=OFF \
    -DWITH_OpenJPEG_DECODER=OFF -DWITH_OpenJPEG_ENCODER=OFF -DWITH_OPENJPH_ENCODER=OFF \
    -DWITH_LIBSHARPYUV=OFF -DWITH_GDK_PIXBUF=OFF -DWITH_EXAMPLES=OFF \
    -DBUILD_TESTING=OFF -DBUILD_DOCUMENTATION=OFF
