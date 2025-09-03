from django.core.management.base import BaseCommand
from products.api import run_amazonau_scraping_job
import asyncio

class Command(BaseCommand):
    help = "Run AmazonAU scraping as a detached job"

    def add_arguments(self, parser):
        parser.add_argument("--session", required=True, help="Session ID for the scraping job")

    def handle(self, *args, **options):
        session_id = options["session"]
        asyncio.run(run_amazonau_scraping_job(session_id)) 