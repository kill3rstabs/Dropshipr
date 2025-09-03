from django.core.management.base import BaseCommand, CommandParser
import asyncio
from products.api import run_costcoau_scraping_job


class Command(BaseCommand):
    help = 'Run CostcoAU scraping job in background'

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument('--session', type=str, required=True)

    def handle(self, *args, **options):
        session_id = options['session']
        asyncio.run(run_costcoau_scraping_job(session_id)) 