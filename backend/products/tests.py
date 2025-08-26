from django.test import TestCase, Client
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
import json
import tempfile
import os
from .models import Upload, Product
from vendor.models import Vendor
from marketplace.models import Marketplace, Store

# Create your tests here.

class ProductUploadTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        
        # Create test data
        self.vendor = Vendor.objects.create(code="eBay", name="eBay")
        self.marketplace = Marketplace.objects.create(code="Reverb", name="Reverb")
        self.store = Store.objects.create(
            name="The Sound Spot",
            marketplace=self.marketplace,
            scraping_enabled=True,
            is_active=True
        )

    def test_upload_csv_file(self):
        """Test uploading a valid CSV file"""
        csv_content = """Vendor Name,Vendor ID,Is Variation,Variation ID,Marketplace Name,Store Name,Marketplace Parent SKU,Marketplace Child SKU,Marketplace ID
eBay,143249333453,No,,Reverb,The Sound Spot,TSS-333453143249-N,TSS-333453143249-N,A122934573"""
        
        csv_file = SimpleUploadedFile(
            "test_products.csv",
            csv_content.encode('utf-8'),
            content_type="text/csv"
        )
        
        response = self.client.post('/api/products/upload/', {'file': csv_file})
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['itemsUploaded'], 1)

    def test_get_uploads(self):
        """Test getting upload history"""
        # Create a test upload record
        Upload.objects.create(
            original_name="test.csv",
            stored_key="uploads/test.csv"
        )
        
        response = self.client.get('/api/products/uploads/')
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        self.assertTrue(data['success'])
        self.assertIsInstance(data['uploads'], list)

    def test_invalid_file_type(self):
        """Test uploading an invalid file type"""
        txt_file = SimpleUploadedFile(
            "test.txt",
            b"This is not a CSV file",
            content_type="text/plain"
        )
        
        response = self.client.post('/api/products/upload/', {'file': txt_file})
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        self.assertFalse(data['success'])
        self.assertIn('Invalid file type', data['error'])
