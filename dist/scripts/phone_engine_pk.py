import sys
import json
import phonenumbers
from phonenumbers import PhoneNumberType, geocoder
from datetime import datetime
import time

# Set output to UTF-8
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

class PakistanPhoneIntelligence:
    def __init__(self, raw_phone):
        self.start_time = time.time()
        self.input_original = raw_phone
        self.input_normalized = None
        self.extraction_time_ms = 0
        
    def sanitize_and_normalize(self, number):
        """Part A: Input Handling"""
        raw = str(number).strip()
        if not raw:
            return None, "No input provided"
            
        # Check for non-telephony characters (letters, etc.)
        if any(c.isalpha() for c in raw):
            return None, "Invalid format"
            
        # Strip all non-numeric except leading +
        sanitized = "".join([c for c in raw if c.isdigit() or (c == '+' and raw.find(c) == 0)])
        
        # Check numeric length (FIRST)
        numeric_only = "".join([c for c in sanitized if c.isdigit()])
        if len(numeric_only) < 5: 
            return None, "Invalid length"
            
        # Check for foreign country codes (only for numbers with sufficient length)
        # 1. Starts with + but not +92
        if raw.startswith('+') and not raw.startswith('+92'):
            return None, "Not Pakistani number"
        # 2. Starts with international code (e.g. 44) that isn't 92 or local 0
        if raw[0].isdigit() and not raw.startswith('0') and not raw.startswith('92'):
            return None, "Not Pakistani number"

        # Convert to E.164 (+92XXXXXXXXXX)
        if sanitized.startswith('0'):
            normalized = "+92" + sanitized[1:]
        elif sanitized.startswith('92') and not sanitized.startswith('+'):
            normalized = "+" + sanitized
        elif sanitized.startswith('+92'):
            # Handle cases like +92-0300... or +92300...
            remainder = sanitized[3:]
            if remainder.startswith('0') and len(remainder) > 3:
                 normalized = "+92" + remainder[1:]
            else:
                 normalized = sanitized
        else:
            # Final fallback
            if sanitized.isdigit() and len(sanitized) >= 9:
                normalized = "+92" + sanitized if not sanitized.startswith('92') else "+" + sanitized
            else:
                return None, "Invalid format"
        
        # Final safety check
        if not normalized.startswith('+92'):
            return None, "Not Pakistani number"
            
        return normalized, None

    def get_operator(self, nsn):
        """Part C: Mobile Operator Identification"""
        prefix = "0" + nsn[:3] # e.g. 0300
        
        operators = [
            {
                "name": "Jazz",
                "network_type": "GSM",
                "technologies": ["2G", "3G", "4G", "5G"],
                "prefixes": [
                    "0300", "0301", "0302", "0303", "0304", "0305", "0306", "0307", "0308", "0309",
                    "0315", "0316", "0317", "0318", "0319",
                    "0322", "0323", "0324", "0325", "0326", "0327", "0328", "0329",
                    "0332", "0333", "0334", "0335", "0336", "0337", "0338", "0339"
                ]
            },
            {
                "name": "Zong",
                "network_type": "GSM/LTE",
                "technologies": ["2G", "3G", "4G"],
                "prefixes": ["0310", "0311", "0312", "0313", "0314", "0320", "0321"]
            },
            {
                "name": "Telenor",
                "network_type": "GSM",
                "technologies": ["2G", "3G", "4G", "5G"],
                "prefixes": ["0340", "0341", "0342", "0343", "0344", "0345", "0346", "0347", "0348", "0349"]
            },
            {
                "name": "Ufone",
                "network_type": "GSM/CDMA",
                "technologies": ["2G", "3G", "4G"],
                "prefixes": ["0330", "0331", "0332", "0333", "0334", "0335", "0336", "0337"]
            },
            {
                "name": "Warid",
                "network_type": "GSM",
                "technologies": ["2G", "3G", "4G"],
                "prefixes": ["0321", "0322"]
            }
        ]
        
        for op in operators:
            if prefix in op["prefixes"]:
                return {
                    "name": op["name"],
                    "network_type": op["network_type"],
                    "technologies": op["technologies"]
                }
        return None

    def get_location(self, nsn):
        """Part D: Landline Area Code Resolution"""
        area_codes = {
            "21": {"city": "Karachi", "province": "Sindh"},
            "22": {"city": "Hyderabad", "province": "Sindh"},
            "23": {"city": "Mirpur Khas", "province": "Sindh"},
            "24": {"city": "Sukkur", "province": "Sindh"},
            "25": {"city": "Larkana", "province": "Sindh"},
            "41": {"city": "Faisalabad", "province": "Punjab"},
            "42": {"city": "Lahore", "province": "Punjab"},
            "43": {"city": "Gujranwala", "province": "Punjab"},
            "44": {"city": "Sialkot", "province": "Punjab"},
            "45": {"city": "Gujrat", "province": "Punjab"},
            "48": {"city": "Sargodha", "province": "Punjab"},
            "51": {"city": "Islamabad", "province": "Punjab"}, # Refined to Islamabad
            "52": {"city": "Sialkot", "province": "Punjab"},
            "55": {"city": "Gujranwala", "province": "Punjab"},
            "61": {"city": "Multan", "province": "Punjab"},
            "62": {"city": "Bahawalpur", "province": "Punjab"},
            "71": {"city": "Peshawar", "province": "KPK"},
            "81": {"city": "Quetta", "province": "Balochistan"},
            "91": {"city": "Peshawar", "province": "KPK"}
        }
        
        code_2 = nsn[:2]
        if code_2 in area_codes:
            res = area_codes[code_2]
            return {
                "city": res["city"],
                "province": res["province"],
                "area_code": "0" + code_2
            }
        return None

    def run(self):
        try:
            # Step A: Input Handling
            self.input_normalized, error_str = self.sanitize_and_normalize(self.input_original)
            
            if error_str:
                execution_time = int((time.time() - self.start_time) * 1000)
                return {
                    "status": "error",
                    "input_original": self.input_original,
                    "error": error_str,
                    "metadata": {"extraction_time_ms": execution_time}
                }

            # Step B: Use libphonenumber Correctly
            try:
                parsed = phonenumbers.parse(self.input_normalized, "PK")
            except Exception as e:
                execution_time = int((time.time() - self.start_time) * 1000)
                return {
                    "status": "error",
                    "input_original": self.input_original,
                    "error": "Invalid format",
                    "metadata": {"extraction_time_ms": execution_time}
                }

            is_valid_structure = phonenumbers.is_valid_number(parsed)
            num_type_enum = phonenumbers.number_type(parsed)
            num_type_str = "unknown"
            if num_type_enum == PhoneNumberType.MOBILE:
                num_type_str = "mobile"
            elif num_type_enum in [PhoneNumberType.FIXED_LINE, PhoneNumberType.FIXED_LINE_OR_MOBILE]:
                num_type_str = "landline"
            
            # Additional heuristic: NSN length 10 or starts with 3
            nsn = str(parsed.national_number)
            if num_type_str == "unknown" and nsn.startswith("3"):
                num_type_str = "mobile"

            # Step C & D: Identification
            operator = None
            location = None
            if num_type_str == "mobile" or nsn.startswith('3'):
                operator = self.get_operator(nsn)
                if operator: num_type_str = "mobile"
            if not operator:
                location = self.get_location(nsn)
                if location: num_type_str = "landline"

            # Step E: Scoring (Optimized for FINAL GOAL)
            score = 0.0
            id_found = (num_type_str == "mobile" and operator) or (num_type_str == "landline" and location)
            
            if id_found and is_valid_structure:
                if num_type_str == "mobile":
                    score = 0.92 # Mobile Final Goal
                else:
                    score = 0.90 # Landline Final Goal
            elif id_found:
                score = 0.85 # Partial identification (prefix match only)
            elif is_valid_structure:
                score = 0.60 # Structural check passed but unknown operator
            elif self.input_normalized.startswith('+92') and len(nsn) >= 7:
                score = 0.30 # Suspicious but formatted correctly
            else:
                score = 0.0
            
            confidence_score = round(min(max(score, 0), 0.95), 2)
            
            # Step F: Forensic Status
            if id_found and is_valid_structure: forensic_status = "VERIFIED"
            elif id_found: forensic_status = "VERIFIED"
            elif is_valid_structure: forensic_status = "LIKELY_VALID"
            elif self.input_normalized.startswith('+92') and len(nsn) >= 7: forensic_status = "SUSPICIOUS"
            else: forensic_status = "INVALID"

            # Step G: Return JSON
            execution_time = int((time.time() - self.start_time) * 1000)
            response = {
                "status": "success",
                "input_original": self.input_original,
                "input_normalized": self.input_normalized,
                "validation": {"is_valid": is_valid_structure, "number_type": num_type_str},
                "confidence_score": confidence_score,
                "forensic_status": forensic_status,
                "metadata": {"extraction_time_ms": execution_time}
            }
            if num_type_str == "mobile" and operator: response["operator"] = operator
            elif num_type_str == "landline" and location: response["location"] = location
            return response

        except Exception as e:
            execution_time = int((time.time() - self.start_time) * 1000)
            return {
                "status": "error", "input_original": self.input_original, 
                "error": "Engine failure", "message": str(e),
                "metadata": {"extraction_time_ms": execution_time}
            }

if __name__ == "__main__":
    raw_input = sys.argv[1] if len(sys.argv) > 1 else ""
    engine = PakistanPhoneIntelligence(raw_input)
    print(json.dumps(engine.run(), indent=2))
