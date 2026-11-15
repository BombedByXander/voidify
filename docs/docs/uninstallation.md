---
title: Uninstallation
description: How to remove Voidify from your system.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

## Restore Spotify

Run `voidify restore` before removing the program. Close Spotify and remove the Voidify installation directory from your user PATH.

| Installation | Directory to remove |
| --- | --- |
| Windows PowerShell installer | `%LOCALAPPDATA%\voidify` |
| macOS or Linux shell installer | `~/.voidify` |
| Python launcher | The checkout's `.runtime/` directory |

Voidify shares Spicetify's configuration and backup location so existing profiles and extensions work. Keep that directory if you use both tools or plan to reinstall.
