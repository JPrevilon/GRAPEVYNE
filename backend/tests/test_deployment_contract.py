import json
import os
import struct
import subprocess
import sys
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
REQUIRED_SPA_SOURCES = {
    "/discover",
    "/wines/:path*",
    "/demo/:path*",
    "/login",
    "/signup",
    "/cellar",
    "/profile",
    "/an-intentional-404",
}


def test_stable_single_project_vercel_contract_has_no_experimental_services():
    configuration = json.loads(
        (REPOSITORY_ROOT / "vercel.json").read_text(encoding="utf-8")
    )

    assert configuration["framework"] == "vite"
    assert configuration["installCommand"] == "npm --prefix frontend ci"
    assert configuration["buildCommand"] == "npm --prefix frontend run build"
    assert configuration["outputDirectory"] == "frontend/dist"
    assert "services" not in configuration
    assert "experimentalServices" not in configuration
    assert "builds" not in configuration
    assert "routes" not in configuration
    assert "alias" not in configuration

    function = configuration["functions"]["api/index.py"]
    assert function["includeFiles"] == "backend/app/**"
    assert "backend/tests/**" in function["excludeFiles"]
    assert "backend/migrations/**" in function["excludeFiles"]
    assert "frontend/**" in function["excludeFiles"]
    assert "docs/**" in function["excludeFiles"]

    rewrite_sources = {rewrite["source"] for rewrite in configuration["rewrites"]}
    assert rewrite_sources == REQUIRED_SPA_SOURCES
    assert all(not source.startswith("/api") for source in rewrite_sources)
    assert "/(.*)" not in rewrite_sources


def test_runtime_and_cache_contracts_are_bounded_and_non_secret():
    root_package = json.loads(
        (REPOSITORY_ROOT / "package.json").read_text(encoding="utf-8")
    )
    configuration = json.loads(
        (REPOSITORY_ROOT / "vercel.json").read_text(encoding="utf-8")
    )
    header_rules = {rule["source"]: rule["headers"] for rule in configuration["headers"]}

    assert root_package == {
        "name": "grapevyne-deployment",
        "private": True,
        "engines": {"node": "20.x"},
    }
    assert (REPOSITORY_ROOT / ".python-version").read_text().strip() == "3.12"
    assert (REPOSITORY_ROOT / "requirements.txt").read_text().strip() == (
        "-r backend/requirements.txt"
    )
    assert header_rules["/build/:path*"] == [
        {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable",
        }
    ]
    assert "immutable" not in json.dumps(header_rules["/assets/:path*"])
    assert "immutable" not in json.dumps(header_rules["/images/:path*"])
    assert "/api/:path*" not in header_rules

    serialized = json.dumps(configuration).lower()
    content_security_policy = next(
        header["value"]
        for header in header_rules["/(.*)"]
        if header["key"] == "Content-Security-Policy"
    )
    assert "database_url" not in serialized
    assert "secret_key" not in serialized
    assert "unsafe-eval" not in serialized
    assert "https://*" not in serialized
    assert "style-src-elem 'self'" in content_security_policy
    assert "style-src-attr 'unsafe-inline'" in content_security_policy
    assert "media-src 'self'" in content_security_policy
    assert "media-src 'self' blob:" not in content_security_policy
    assert "worker-src 'none'" in content_security_policy
    assert "worker-src 'self'" not in content_security_policy
    assert "worker-src 'none' blob:" not in content_security_policy


def test_committed_apple_touch_icon_is_the_declared_180_pixel_png():
    icon = (REPOSITORY_ROOT / "frontend/public/apple-touch-icon.png").read_bytes()
    html = (REPOSITORY_ROOT / "frontend/index.html").read_text(encoding="utf-8")

    assert icon[:8] == b"\x89PNG\r\n\x1a\n"
    assert struct.unpack(">II", icon[16:24]) == (180, 180)
    assert 'rel="apple-touch-icon"' in html
    assert 'href="/apple-touch-icon.png"' in html
    assert 'sizes="180x180"' in html


def test_vercel_upload_ignore_keeps_build_sources_but_excludes_local_evidence():
    ignore_text = (REPOSITORY_ROOT / ".vercelignore").read_text(encoding="utf-8")
    ignore_lines = {
        line.strip()
        for line in ignore_text.splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    }

    for required_exclusion in (
        ".DS_Store",
        ".env",
        "**/.env",
        ".grapevyne-v2-reference/",
        ".vercel/",
        "docs/",
        "backend/.venv/",
        "backend/migrations/",
        "backend/tests/",
        "frontend/.auth/",
        "frontend/node_modules/",
        "frontend/e2e/",
        "frontend/test-results/",
    ):
        assert required_exclusion in ignore_text

    for required_build_input in (
        "frontend/package.json",
        "frontend/package-lock.json",
        "frontend/src/",
        "frontend/public/",
    ):
        assert required_build_input not in ignore_lines


def test_wsgi_adapter_imports_one_production_app_without_side_effect_commands():
    adapter_path = REPOSITORY_ROOT / "api" / "index.py"
    adapter_source = adapter_path.read_text(encoding="utf-8")

    assert adapter_source.count("app = create_app") == 1
    assert "app.run(" not in adapter_source
    assert "db.create_all" not in adapter_source
    assert "db upgrade" not in adapter_source
    assert "seed" not in adapter_source.lower()

    environment = {
        **os.environ,
        "DATABASE_URL": (
            "postgresql://preview:credential@db.example.test/grapevyne"
            "?sslmode=require"
        ),
        "SECRET_KEY": "-".join(("deployment", "adapter", "fixture")),
        "VERCEL": "1",
        "VERCEL_ENV": "preview",
        "DEPLOYMENT_DATABASE_SENTINEL": "grapevyne-preview-adapter-fixture",
        "VERCEL_URL": "grapevyne-a1b2c3-joshuaprevilon13.vercel.app",
        "FRONTEND_ORIGINS": (
            "https://grapevyne-a1b2c3-joshuaprevilon13.vercel.app"
        ),
    }
    probe = """
import runpy
namespace = runpy.run_path('api/index.py')
application = namespace['app']
routes = sorted(rule.rule for rule in application.url_map.iter_rules())
assert application.config['ENVIRONMENT'] == 'production'
assert application.config['VERCEL_ENV'] == 'preview'
assert application.config['DEPLOYMENT_DATABASE_SENTINEL'] == (
    'grapevyne-preview-adapter-fixture'
)
assert routes.count('/api/health') == 1
assert '/api/auth/login' in routes
assert '/api/cellar' in routes
assert '/api/profile/taste' in routes
assert '/api/wines/search' in routes
"""
    completed = subprocess.run(
        [sys.executable, "-c", probe],
        cwd=REPOSITORY_ROOT,
        env=environment,
        capture_output=True,
        check=False,
        text=True,
        timeout=15,
    )

    assert completed.returncode == 0, completed.stderr
    assert completed.stdout == ""
