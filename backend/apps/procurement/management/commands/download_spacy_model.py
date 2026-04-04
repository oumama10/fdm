"""
Management command: download_spacy_model

Downloads the French spaCy model required by the NLP normalizer:

    python manage.py download_spacy_model

This is equivalent to running:

    python -m spacy download fr_core_news_sm

but integrates cleanly into the Django management command ecosystem so it
can be included in deployment scripts and Makefile targets.
"""

import subprocess
import sys

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = (
        "Download the fr_core_news_sm spaCy model used by the procurement "
        "NLP normalizer (apps.procurement.tasks.nlp_normalizer)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--check",
            action="store_true",
            help="Only check whether the model is already installed; do not download.",
        )

    def handle(self, *args, **options):
        model = "fr_core_news_sm"

        if options["check"]:
            self._check_installed(model)
            return

        self.stdout.write(f"Downloading spaCy model '{model}' …")

        result = subprocess.run(  # noqa: S603 — argv is fully controlled here
            [sys.executable, "-m", "spacy", "download", model],
            capture_output=True,
            text=True,
        )

        if result.stdout:
            self.stdout.write(result.stdout)

        if result.returncode == 0:
            self.stdout.write(
                self.style.SUCCESS(f"'{model}' downloaded and installed successfully.")
            )
        else:
            if result.stderr:
                self.stderr.write(result.stderr)
            raise SystemExit(result.returncode)

    # ------------------------------------------------------------------
    def _check_installed(self, model: str) -> None:
        try:
            import spacy  # noqa: PLC0415

            spacy.load(model, disable=["parser", "ner"])
            self.stdout.write(self.style.SUCCESS(f"'{model}' is installed."))
        except OSError:
            self.stderr.write(
                self.style.WARNING(
                    f"'{model}' is NOT installed. "
                    f"Run: python manage.py download_spacy_model"
                )
            )
