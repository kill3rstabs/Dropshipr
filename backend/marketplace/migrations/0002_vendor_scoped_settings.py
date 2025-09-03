from django.db import migrations, models
import django.db.models.deletion


def create_default_vendor_and_populate(apps, schema_editor):
    Vendor = apps.get_model('vendor', 'Vendor')
    StorePriceSettings = apps.get_model('marketplace', 'StorePriceSettings')
    StoreInventorySettings = apps.get_model('marketplace', 'StoreInventorySettings')

    default_vendor, _ = Vendor.objects.get_or_create(code='DEFAULT', defaults={'name': 'Default Vendor'})

    # Assign default vendor to existing settings rows
    for sps in StorePriceSettings.objects.filter(vendor__isnull=True):
        sps.vendor_id = default_vendor.id
        sps.save(update_fields=['vendor'])

    for sis in StoreInventorySettings.objects.filter(vendor__isnull=True):
        sis.vendor_id = default_vendor.id
        sis.save(update_fields=['vendor'])


def noop_reverse(apps, schema_editor):
    # No-op reverse migration
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('vendor', '0002_remove_vendorprice_price_cents_vendorprice_price'),
        ('marketplace', '0001_initial'),
    ]

    operations = [
        # Change OneToOne store -> ForeignKey for price settings
        migrations.AlterField(
            model_name='storepricesettings',
            name='store',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='price_settings_by_vendor', to='marketplace.store'),
        ),
        # Add vendor FK (nullable for data migration)
        migrations.AddField(
            model_name='storepricesettings',
            name='vendor',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='store_price_settings', to='vendor.vendor'),
        ),
        # Change OneToOne store -> ForeignKey for inventory settings
        migrations.AlterField(
            model_name='storeinventorysettings',
            name='store',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='inventory_settings_by_vendor', to='marketplace.store'),
        ),
        # Add vendor FK (nullable for data migration)
        migrations.AddField(
            model_name='storeinventorysettings',
            name='vendor',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='store_inventory_settings', to='vendor.vendor'),
        ),
        # Populate vendor with DEFAULT
        migrations.RunPython(create_default_vendor_and_populate, reverse_code=noop_reverse),
        # Make vendor non-nullable
        migrations.AlterField(
            model_name='storepricesettings',
            name='vendor',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='store_price_settings', to='vendor.vendor'),
        ),
        migrations.AlterField(
            model_name='storeinventorysettings',
            name='vendor',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='store_inventory_settings', to='vendor.vendor'),
        ),
        # Enforce uniqueness per (store, vendor)
        migrations.AlterUniqueTogether(
            name='storepricesettings',
            unique_together={('store', 'vendor')},
        ),
        migrations.AlterUniqueTogether(
            name='storeinventorysettings',
            unique_together={('store', 'vendor')},
        ),
    ] 