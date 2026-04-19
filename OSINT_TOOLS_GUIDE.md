# 🛠️ Fsociety ShadowScan Toolset: Technical Overview & Strategies

This document provides a detailed breakdown of the intelligence tools integrated into the Fsociety ShadowScan platform, including their technical implementation, data sources, and investigative strategies.

---

## 🔍 1. Email Lookup (Advanced Professional Enrichment)
The Email Lookup tool has been upgraded to a professional-grade OSINT engine that orchestrates multiple authoritative data sources.

### **Strategy & Implementation**
*   **Corporate & Professional Orchestration**: Simultaneously queries **Hunter.io**, **RocketReach**, **Clearbit**, and **FullContact** to extract corporate affiliations, job titles, and professional histories.
*   **Recursive Handle Expansion**: Generates refined alias variations (reversed parts, number-less aliases) to improve hit rates on legacy and secondary social accounts.
*   **Multi-Point Identity Resolution**: Cross-references results from multiple providers to calculate a **Confidence Score**, ensuring that only verified digital footprints are prioritized.
*   **Deep Social Footprint Mapping**: Probes 10+ social platforms including Reddit, Stack Overflow, and Pinterest, correlating handles discovered via API enrichment.
*   **Risk & Breach Assessment**: Integrates with **Have I Been Pwned** to provide severity-coded breach histories and exposed data alerts.

---

## 👤 2. Username Intelligence (Deep Signature Probing)
The Username Intelligence tool conducts multi-signature content analysis across social networks and code repositories to identify active, deleted, or suspended accounts.

### **Strategy & Implementation**
*   **HTML Signature Matching**: Moves beyond basic HTTP status code checks. The engine verifies the existence of a profile by searching for specific HTML "found" markers (e.g., specific CSS classes or data attributes) and identifies "not found" states via custom error page signatures.
*   **Suspended Account Identification**: Unique signatures are used to detect accounts that have been suspended or restricted by the platform, providing critical intelligence on a target's history.
*   **Multi-Factor Variation Generation**: Automatically generates permutations of a target's alias, including delimiter swaps (john.doe vs john_doe), numeric suffixes, and character replacements (l/1, o/0) to find copycat or legacy accounts.
*   **Batched Parallel Probing**: Uses a jittered concurrency model (5-platform batches) to ensure high search speeds while mitigating the risk of IP-based rate limiting or bot detection.
*   **Confidence Scoring**: Each match is assigned a reliability score based on the strength of the signature matched (e.g., an exact HTML ID match vs. a simple string match).

---

## 📂 3. Advanced Layer Forensic Extraction (Metadata)
The Metadata tool has been completely overhauled into a multi-format forensic engine capable of deep-layer dissection and privacy risk assessment.

### **Strategy & Implementation**
*   **Multi-Engine Dissection**: Orchestrates **ExifTool**, **FFmpeg (ffprobe)**, and specialized Python libraries (**pdfplumber**, **python-docx**) to extract hidden data from all major file types.
*   **Geospatial Intercept & Geocoding**: Automatically converts GPS coordinates and resolves them to street-level addresses via **Nominatim (OpenStreetMap)** integration.
*   **Privacy Risk Dashboard**: Quantifies file exposure by calculating a **Risk Score (0-100)** and identifying high-risk leaks like location, author identity, and hardware fingerprints.
*   **Hardware Fingerprinting**: Generates unique device signatures based on hardware and software characteristics discovered in the binary headers.

---

## 📞 4. Pakistan Telephony Intelligence (HLR Signature Analysis)
The Telephony tool conducts deep prefix and signature analysis for numbers within the **Pakistan Numbering Plan** to identify network operators and geographic origins.

### **Strategy & Implementation**
*   **MNO Signature Mapping**: Targeted identification of Pakistani Mobile Network Operators based on PTA prefix signatures (Jazz/Mobilink, Zong, Telenor, Ufone, and SCOM).
*   **Landline Geo-Resolving**: Automatic city resolution for **PTCL/Fixed Line** numbers based on area code patterns (e.g., Karachi `21`, Faisalabad `41`, Multan `61`).
*   **Forensic Insight Reporting**: Provides an automated summary dossier explaining the logic behind the operator identification and location mapping.

---


> [!TIP]
> **Investigator Note**: Use these tools in combination. Start with a **Username Search** to find a common handle, then use **Metadata Extraction** on images found on those profiles to find physical locations.
