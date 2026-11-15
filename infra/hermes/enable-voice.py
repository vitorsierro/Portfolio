"""Execute dentro do container, como hermes, com o interpretador da instalação."""

import os
import site
import sys
from pathlib import Path


def main():
    os.environ.setdefault("HERMES_HOME", "/opt/data")
    root = Path("/opt/hermes")
    sys.path.insert(0, str(root))
    for packages in (root / ".venv/lib").glob("python*/site-packages"):
        site.addsitedir(str(packages))

    # Replica o bootstrap real: ele seleciona a geração gerenciada de dependências.
    import hermes_cli.main  # noqa: F401
    from pm.client import sync_venv

    sync_venv(["stt-whisper", "edge-tts"])
    print("Dependências de voz preparadas. Reinicie o gateway para ativá-las.")


if __name__ == "__main__":
    main()
