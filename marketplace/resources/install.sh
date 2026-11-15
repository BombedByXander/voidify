#!/bin/sh
# Copyright 2019 khanhas. GPL license.
# Edited from project Denoland install script (https://github.com/denoland/deno_install)

set -e
exe="${VOIDIFY_INSTALL:-$HOME/.voidify}/voidify"
"$exe" config custom_apps marketplace current_theme marketplace inject_css 1 replace_colors 1
"$exe" auto apply
