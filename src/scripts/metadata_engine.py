import sys
import json
import os
import subprocess
import hashlib
import requests
from datetime import datetime
from PIL import Image
import piexif
from PyPDF2 import PdfReader
import docx
import openpyxl
import pptx
import eyed3

# Support for non-ASCII metadata
sys.stdout.reconfigure(encoding='utf-8')

class MetadataForensicEngine:
    def __init__(self, file_path):
        self.file_path = file_path
        self.filename = os.path.basename(file_path)
        self.ext = os.path.splitext(file_path)[1].lower()
        self.start_time = datetime.now()
        self.tools_used = ["hashlib"]
        self.warnings = []
        self.errors = []
        self.total_fields = 0

    def get_readable_size(self, size):
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} TB"

    def get_hashes(self):
        md5 = hashlib.md5()
        sha256 = hashlib.sha256()
        with open(self.file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                md5.update(chunk)
                sha256.update(chunk)
        return md5.hexdigest(), sha256.hexdigest()

    def run_exiftool(self):
        try:
            # -n flag ensures decimal output for GPS and exposure
            cmd = ["exiftool", "-json", "-G1", "-n", self.file_path]
            output = subprocess.check_output(cmd).decode('utf-8')
            self.tools_used.append("ExifTool")
            return json.loads(output)[0]
        except Exception as e:
            self.errors.append(f"ExifTool execution failed: {str(e)}")
            return {}

    def reverse_geocode(self, lat, lon):
        try:
            headers = {"User-Agent": "Fsociety-OSINT-Metadata-Tool/1.0 (Contact: osint@example.com)"}
            url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}"
            response = requests.get(url, headers=headers, timeout=5)
            self.tools_used.append("Nominatim API")
            if response.status_code == 200:
                data = response.json()
                addr = data.get("address", {})
                return {
                    "street": addr.get("road", addr.get("pedestrian", "")),
                    "city": addr.get("city", addr.get("town", addr.get("village", ""))),
                    "state": addr.get("state", ""),
                    "country": addr.get("country", ""),
                    "postal_code": addr.get("postcode", ""),
                    "full_address": data.get("display_name")
                }
        except: pass
        return None

    def calculate_privacy(self, results):
        score = 0
        risks = []
        recommendations = []

        # Location
        gps = results.get("gps_data")
        if gps and gps.get("latitude"):
            score += 60
            risks.append({"severity": "HIGH", "category": "Location", "description": "GPS coordinates exposed - precise location visible"})
            recommendations.append("Remove GPS data before sharing publicly")

        # Identity
        author = results.get("exif_data", {}).get("camera", {}).get("creator") or \
                 results.get("document_properties", {}).get("author")
        if author:
            score += 20
            risks.append({"severity": "MEDIUM", "category": "Identity", "description": "Author/Creator name identified"})
            recommendations.append("Remove author information before sharing")

        # Hardware/Fingerprint
        camera = results.get("exif_data", {}).get("camera", {}).get("model")
        if camera:
            score += 10
            risks.append({"severity": "LOW", "category": "Device", "description": "Device model exposed - camera can be identified"})
            recommendations.append("Consider stripping all EXIF data")

        sw = results.get("exif_data", {}).get("camera", {}).get("firmware") or \
             results.get("document_properties", {}).get("software")
        if sw:
            score += 5
            risks.append({"severity": "LOW", "category": "Software", "description": "Software version exposed"})

        # History
        rev = results.get("document_properties", {}).get("revision_count")
        if rev and int(rev) > 0:
            score += 15
            risks.append({"severity": "MEDIUM", "category": "History", "description": f"Document revision history ({rev} edits) exposed"})
            recommendations.append("Sanitize document processing history")

        # Copyright
        if results.get("iptc_data", {}).get("copyright"):
            score += 2
            risks.append({"severity": "LOW", "category": "Legal", "description": "Copyright information visible"})

        percentage = min((score / 130) * 100, 100)
        level = "LOW" if percentage <= 20 else "MEDIUM" if percentage <= 50 else "HIGH" if percentage <= 80 else "CRITICAL"
        
        return {
            "risk_score": int(percentage),
            "risk_level": level,
            "risks": risks,
            "recommendations": list(set(recommendations))
        }

    def generate_fingerprint(self, exif):
        cam = exif.get("camera", {})
        feat = f"{cam.get('make')}{cam.get('model')}{cam.get('firmware')}{exif.get('lens', {}).get('model')}"
        if cam.get('make'):
            return hashlib.sha256(feat.encode()).hexdigest()
        return "Unknown"

    def run(self):
        # Part A: Validation
        if not os.path.exists(self.file_path):
            return self.error_response("File not found")
        
        size = os.path.getsize(self.file_path)
        if size > 100 * 1024 * 1024:
            return self.error_response("File too large (Max 100MB)")

        md5, sha256 = self.get_hashes()
        
        # Part B: ExifTool Primary
        raw = self.run_exiftool()
        
        results = {
            "status": "success",
            "file_info": {
                "filename": self.filename,
                "file_size_bytes": size,
                "file_size_readable": self.get_readable_size(size),
                "file_type": raw.get("File:MIMEType", "unknown"),
                "upload_date": datetime.now().isoformat()
            },
            "hashing": {
                "md5": md5,
                "sha256": sha256
            }
        }

        # Part C: Image Processing
        if self.ext in ['.jpg', '.jpeg', '.png', '.gif', '.tiff', '.bmp', '.webp']:
            self.process_image(results, raw)
        
        # Part D: Document Processing
        elif self.ext in ['.pdf', '.docx', '.xlsx', '.pptx']:
            self.process_document(results, raw)

        # Part E & F: Media Processing
        elif self.ext in ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.mp4', '.mov', '.avi', '.mkv', '.webm']:
            self.process_media(results, raw)

        # Part J & I
        results["privacy_assessment"] = self.calculate_privacy(results)
        
        # Metadata Stats
        end_time = datetime.now()
        results["metadata"] = {
            "total_fields_extracted": self.total_fields,
            "extraction_time_ms": int((end_time - self.start_time).total_seconds() * 1000),
            "tools_used": list(set(self.tools_used)),
            "warnings": self.warnings,
            "errors": self.errors
        }

        return results

    def process_image(self, results, raw):
        # Exif Data
        camera = {
            "make": raw.get("IFD0:Make") or raw.get("EXIF:Make"),
            "model": raw.get("IFD0:Model") or raw.get("EXIF:Model"),
            "firmware": raw.get("IFD0:Software") or raw.get("ExifIFD:Software")
        }
        lens = {
            "model": raw.get("ExifIFD:LensModel") or raw.get("Composite:LensID"),
            "focal_length": raw.get("Composite:FocalLength"),
            "f_number": raw.get("Composite:Aperture")
        }
        exposure = {
            "iso": raw.get("ExifIFD:ISO"),
            "aperture": raw.get("Composite:Aperture"),
            "shutter_speed": raw.get("EXIF:ExposureTime") or raw.get("Composite:ShutterSpeed"),
            "exposure_bias": raw.get("EXIF:ExposureCompensation"),
            "metering_mode": raw.get("EXIF:MeteringMode"),
            "white_balance": raw.get("EXIF:WhiteBalance")
        }
        results["exif_data"] = {"camera": camera, "lens": lens, "exposure": exposure}

        # GPS Data
        lat = raw.get("Composite:GPSLatitude")
        lon = raw.get("Composite:GPSLongitude")
        if lat is not None and lon is not None:
            results["gps_data"] = {
                "latitude": lat,
                "longitude": lon,
                "altitude": raw.get("Composite:GPSAltitude"),
                "gps_date": raw.get("Composite:GPSDateTime"),
                "address": self.reverse_geocode(lat, lon),
                "maps": {
                    "google_maps": f"https://maps.google.com/?q={lat},{lon}",
                    "openstreetmap": f"https://www.openstreetmap.org/?mlat={lat}&mlon={lon}&zoom=15"
                }
            }
        
        # IPTC
        results["iptc_data"] = {
            "keywords": raw.get("IPTC:Keywords"),
            "copyright": raw.get("IPTC:CopyrightNotice"),
            "creator": raw.get("IPTC:By-line"),
            "location": raw.get("IPTC:City")
        }

        # Properties (Pillow)
        try:
            with Image.open(self.file_path) as img:
                self.tools_used.append("Pillow")
                results["image_properties"] = {
                    "width": img.width,
                    "height": img.height,
                    "resolution": f"{img.info.get('dpi', (72, 72))[0]} x {img.info.get('dpi', (72, 72))[1]} DPI",
                    "color_mode": img.mode,
                    "bit_depth": 8 if img.mode in ['L', 'RGB', 'RGBA'] else 1 # Simple approximation
                }
        except: pass

        results["device_fingerprint"] = {
            "device_type": "Smartphone" if camera.get("make") in ["Apple", "Samsung", "Google"] else "Camera",
            "device_model": f"{camera.get('make', '')} {camera.get('model', '')}".strip(),
            "software_version": camera.get("firmware"),
            "unique_id": self.generate_fingerprint(results["exif_data"])
        }
        self.total_fields += sum(1 for v in camera.values() if v) + sum(1 for v in lens.values() if v)

    def process_document(self, results, raw):
        props = {}
        if self.ext == '.pdf':
            try:
                reader = PdfReader(self.file_path)
                self.tools_used.append("PyPDF2")
                info = reader.metadata
                props = {
                    "author": info.author,
                    "title": info.title,
                    "subject": info.subject,
                    "keywords": info.get('/Keywords'),
                    "created": info.get('/CreationDate'),
                    "modified": info.get('/ModDate'),
                    "software": info.producer,
                    "page_count": len(reader.pages),
                    "encryption_status": "Encrypted" if reader.is_encrypted else "None"
                }
            except: pass
        elif self.ext == '.docx':
            try:
                doc = docx.Document(self.file_path)
                self.tools_used.append("python-docx")
                cp = doc.core_properties
                props = {
                    "author": cp.author,
                    "title": cp.title,
                    "created": cp.created.isoformat() if cp.created else None,
                    "modified": cp.modified.isoformat() if cp.modified else None,
                    "last_modified_by": cp.last_modified_by,
                    "revision_count": cp.revision,
                    "software": "Microsoft Word"
                }
            except: pass
        elif self.ext == '.xlsx':
            try:
                wb = openpyxl.load_workbook(self.file_path, read_only=True)
                cp = wb.properties
                props = {
                    "author": cp.creator,
                    "title": cp.title,
                    "sheet_count": len(wb.sheetnames)
                }
            except: pass
        elif self.ext == '.pptx':
            try:
                pres = pptx.Presentation(self.file_path)
                cp = pres.core_properties
                props = {
                    "author": cp.author,
                    "title": cp.title,
                    "slide_count": len(pres.slides)
                }
            except: pass
        
        results["document_properties"] = props
        self.total_fields += len(props)

    def process_media(self, results, raw):
        if self.ext in ['.mp3', '.wav', '.flac', '.aac', '.ogg']:
            audio = {}
            try:
                self.tools_used.append("eyeD3")
                af = eyed3.load(self.file_path)
                if af and af.tag:
                    audio = {
                        "artist": af.tag.artist,
                        "album": af.tag.album,
                        "title": af.tag.title,
                        "track_num": af.tag.track_num[0] if af.tag.track_num else None,
                        "genre": str(af.tag.genre) if af.tag.genre else None
                    }
                audio.update({
                    "bitrate": f"{int(raw.get('Audio:AudioBitrate', 0))/1000} kbps",
                    "sample_rate": f"{raw.get('Audio:SampleRate')} Hz",
                    "duration": raw.get("Composite:Duration"),
                    "channels": "Stereo" if int(raw.get("Audio:AudioChannels", 0)) > 1 else "Mono"
                })
            except: pass
            results["audio_metadata"] = audio
        else:
            video = {}
            try:
                cmd = ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", self.file_path]
                self.tools_used.append("FFprobe")
                probe = json.loads(subprocess.check_output(cmd).decode('utf-8'))
                fmt = probe.get("format", {})
                streams = probe.get("streams", [])
                vs = next((s for s in streams if s['codec_type'] == 'video'), {})
                
                video = {
                    "duration": f"{float(fmt.get('duration', 0))/60:.0f}:{float(fmt.get('duration', 0))%60:02.0f}",
                    "resolution": f"{vs.get('width')} x {vs.get('height')}",
                    "frame_rate": vs.get("avg_frame_rate"),
                    "video_codec": vs.get("codec_name"),
                    "bitrate": f"{int(fmt.get('bit_rate', 0))/1000000:.2f} Mbps",
                    "creation_date": fmt.get("tags", {}).get("creation_time")
                }
            except: pass
            results["video_metadata"] = video

    def error_response(self, msg):
        return {
            "status": "error",
            "file_info": {"filename": self.filename},
            "error": "Processing failed",
            "message": msg,
            "supported_types": [".jpg", ".png", ".pdf", ".docx", ".mp3", ".mp4", ".xlsx", ".pptx"],
            "metadata": {"extraction_time_ms": int((datetime.now() - self.start_time).total_seconds() * 1000)}
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"status": "error", "message": "No file provided"}))
        sys.exit(1)
    
    engine = MetadataForensicEngine(sys.argv[1])
    print(json.dumps(engine.run(), indent=2))
