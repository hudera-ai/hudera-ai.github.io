# -*- coding: utf-8 -*-
"""Superseded. Both home pages are now built by tools/build_static.py from tools/src/index.html."""
import subprocess, sys, pathlib
subprocess.run([sys.executable, str(pathlib.Path(__file__).with_name("build_static.py")), "--grids"], check=True)
