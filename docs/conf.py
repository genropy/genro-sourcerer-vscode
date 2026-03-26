"""Sphinx configuration for Sourcerer Visual documentation."""

project = "Sourcerer Visual"
copyright = "2026, Genropy Team"
author = "Genropy Team"
release = "0.1.0"
version = "0.1"

extensions = [
    "myst_parser",
    "sphinxcontrib.mermaid",
]

myst_enable_extensions = [
    "colon_fence",
    "deflist",
    "tasklist",
]
myst_heading_anchors = 3

myst_fence_as_directive = ["mermaid"]

source_suffix = {
    ".rst": "restructuredtext",
    ".md": "markdown",
}

master_doc = "index"

exclude_patterns = ["_build", "Thumbs.db", ".DS_Store"]

suppress_warnings = ["myst.header"]

html_theme = "sphinx_rtd_theme"
html_theme_options = {
    "navigation_depth": 4,
    "collapse_navigation": False,
    "sticky_navigation": True,
}

html_static_path = ["_static"]
html_css_files = ["custom.css"]

html_context = {
    "display_github": True,
    "github_user": "genropy",
    "github_repo": "genro-sourcerer-vscode",
    "github_version": "main",
    "conf_py_path": "/docs/",
}

mermaid_output_format = "raw"
