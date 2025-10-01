import sys
from pathlib import Path


def _ensure_backend_on_path() -> None:
    root = Path(__file__).resolve().parents[2]
    backend_path = root / "backend"
    backend_str = str(backend_path)
    if backend_str not in sys.path:
        sys.path.insert(0, backend_str)


_ensure_backend_on_path()
