from ninja import NinjaAPI
from marketplace.api import router as marketplace_router

api = NinjaAPI()

# Include marketplace APIs
api.add_router("/marketplace/", marketplace_router)

# Add other APIs here as needed
# api.add_router("/products/", products_api)
# api.add_router("/vendor/", vendor_api) 