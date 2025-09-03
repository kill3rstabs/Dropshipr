from ninja.router import Router
from .models import Vendor

router = Router()

@router.get("/vendors")
def list_vendors(request):
    vendors = Vendor.objects.all().order_by('name')
    return [{
        "id": v.id,
        "code": v.code,
        "name": v.name,
    } for v in vendors] 