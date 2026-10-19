import logging

from app.services.bootstrap_service import run_startup_bootstrap

logging.basicConfig(level=logging.INFO)
run_startup_bootstrap()
print("bootstrap concluido")
