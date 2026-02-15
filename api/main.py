#!/usr/bin/env python3
"""
NYC Tenant Safety App — FastAPI Backend
"""

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
import psycopg2.extras
import re
import os
from datetime import date
from typing import Optional

app = FastAPI(title="NYC Tenant Safety API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Lock down in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_CONN = os.getenv('DATABASE_URL', 'postgresql://localhost/wocket_demo')


@app.get("/")
def health_check():
    """Health check endpoint for deployment verification."""
    return {"status": "ok", "app": "Wocket API", "version": "1.0"}


def get_db():
    return psycopg2.connect(DB_CONN)


# ─── ECB Description Parsing ───────────────────────────────

# Regex to extract apartment numbers from ECB violation descriptions
# Matches: APT 11A, APT# 12C, APTS 11A & 11B, APT:#12B/11B, APARTMENT 5A, APT. 3B
_APT_PATTERN = re.compile(
    r'(?:APTS?\.?[:#\s]*|APARTMENTS?[:#\s]*)'
    r'([\d]+[A-Z]?(?:\s*[&/,]\s*[\d]+[A-Z]?)*)',
    re.IGNORECASE
)
# Split extracted apartment groups into individual apartments
_APT_SPLIT = re.compile(r'[&/,]\s*')

def extract_apartments_from_description(desc: str) -> list:
    """Extract apartment numbers from ECB violation description text."""
    if not desc:
        return []
    apts = set()
    for match in _APT_PATTERN.finditer(desc):
        group = match.group(1).strip()
        parts = _APT_SPLIT.split(group)
        for p in parts:
            p = p.strip().upper()
            if p and re.match(r'^\d+[A-Z]?$', p):
                apts.add(p)
    return sorted(apts)

# Hazard keyword tags for ECB violations
ECB_TAG_DEFINITIONS = {
    "fire-stopping": {
        "keywords": ["fire stopping", "firestopping", "fire-stopping", "fire stop"],
        "icon": "🔥",
        "label": "Fire Stopping",
    },
    "lead": {
        "keywords": ["lead", "lead-based", "lead paint", "lead abatement"],
        "icon": "🧪",
        "label": "Lead",
    },
    "asbestos": {
        "keywords": ["asbestos", " acm ", "asbestos-containing"],
        "icon": "☣️",
        "label": "Asbestos",
    },
    "mold": {
        "keywords": ["mold", "mildew"],
        "icon": "🌫️",
        "label": "Mold",
    },
    "pest": {
        "keywords": ["roach", "mice", "rat", "pest", "vermin", "bed bug", "bedbug"],
        "icon": "🪳",
        "label": "Pest",
    },
    "no-permit": {
        "keywords": ["work without permit", "w/o permit", "no permit", "without a permit"],
        "icon": "🚫",
        "label": "No Permit",
    },
    "structural": {
        "keywords": ["structural", "load-bearing", "load bearing", "demising wall", "gutted", "gutting"],
        "icon": "🧱",
        "label": "Structural",
    },
    "egress": {
        "keywords": ["egress", "means of egress", "exit", "stairway", "fire escape"],
        "icon": "🚪",
        "label": "Egress",
    },
    "electrical": {
        "keywords": ["electrical", "wiring", "electric"],
        "icon": "⚡",
        "label": "Electrical",
    },
    "plumbing": {
        "keywords": ["plumbing", "gas line", "gas pipe", "piping"],
        "icon": "🔧",
        "label": "Plumbing",
    },
    "elevator": {
        "keywords": ["elevator", "elev "],
        "icon": "🛗",
        "label": "Elevator",
    },
    "facade": {
        "keywords": ["facade", "façade", "exterior wall", "falling debris"],
        "icon": "🏢",
        "label": "Facade",
    },
    "occupied": {
        "keywords": ["occupied", "tenant", "residents"],
        "icon": "👥",
        "label": "Occupied During Work",
    },
}

COMPLAINT_TAG_MAP = {
    "01": [{"id": "plumbing", "icon": "🔧", "label": "Plumbing"}],
    "03": [{"id": "structural", "icon": "🧱", "label": "Adjacent Buildings"}],
    "04": [{"id": "no-permit", "icon": "🚫", "label": "After Hours Work"}],
    "05": [{"id": "no-permit", "icon": "🚫", "label": "No Permit"}],
    "06": [{"id": "structural", "icon": "🧱", "label": "Construction"}],
    "09": [{"id": "structural", "icon": "🧱", "label": "Debris"}],
    "10": [{"id": "facade", "icon": "🏢", "label": "Falling Debris"}],
    "11": [{"id": "no-permit", "icon": "🚫", "label": "No Permit"}],
    "12": [{"id": "structural", "icon": "🧱", "label": "Unsafe Demolition"}],
    "14": [{"id": "structural", "icon": "🧱", "label": "Excavation"}],
    "1A": [{"id": "no-permit", "icon": "🚫", "label": "Illegal Conversion"}],
    "1H": [{"id": "asbestos", "icon": "☣️", "label": "Asbestos"}],
    "28": [{"id": "structural", "icon": "🧱", "label": "Collapse Danger"}],
    "29": [{"id": "egress", "icon": "🚪", "label": "Vacant/Open"}],
    "30": [{"id": "structural", "icon": "🧱", "label": "Structural"}],
    "31": [{"id": "no-permit", "icon": "🚫", "label": "No C of O"}],
    "37": [{"id": "egress", "icon": "🚪", "label": "Egress Blocked"}],
    "38": [{"id": "egress", "icon": "🚪", "label": "Exit Door"}],
    "39": [{"id": "egress", "icon": "🚪", "label": "No Secondary Egress"}],
    "3A": [{"id": "electrical", "icon": "⚡", "label": "Electrical"}],
    "40": [{"id": "facade", "icon": "🏢", "label": "Falling Building Part"}],
    "41": [{"id": "facade", "icon": "🏢", "label": "Falling Danger"}],
    "43": [{"id": "structural", "icon": "🧱", "label": "Structural"}],
    "45": [{"id": "no-permit", "icon": "🚫", "label": "Illegal Conversion"}],
    "46": [{"id": "no-permit", "icon": "🚫", "label": "No Permit"}],
    "48": [{"id": "no-permit", "icon": "🚫", "label": "Illegal Residential"}],
    "4B": [{"id": "electrical", "icon": "⚡", "label": "Electrical"}],
    "4E": [{"id": "structural", "icon": "🧱", "label": "Stalled Site"}],
    "52": [{"id": "fire-stopping", "icon": "🔥", "label": "Sprinkler"}],
    "53": [{"id": "plumbing", "icon": "🔧", "label": "Vent/Exhaust"}],
    "54": [{"id": "structural", "icon": "🧱", "label": "Wall Bulging/Cracked"}],
    "56": [{"id": "fire-stopping", "icon": "🔥", "label": "Boiler Fumes/CO"}],
    "59": [{"id": "electrical", "icon": "⚡", "label": "Electrical"}],
    "5G": [{"id": "no-permit", "icon": "🚫", "label": "Illegal Work"}],
    "60": [{"id": "electrical", "icon": "⚡", "label": "Electrical"}],
    "61": [{"id": "electrical", "icon": "⚡", "label": "Electrical"}],
    "62": [{"id": "elevator", "icon": "🛗", "label": "Elevator Danger"}],
    "63": [{"id": "elevator", "icon": "🛗", "label": "Elevator"}],
    "64": [{"id": "elevator", "icon": "🛗", "label": "Elevator Shaft"}],
    "65": [{"id": "plumbing", "icon": "🔧", "label": "Gas Piping"}],
    "66": [{"id": "plumbing", "icon": "🔧", "label": "Plumbing"}],
    "6M": [{"id": "elevator", "icon": "🛗", "label": "Elevator"}],
    "6S": [{"id": "elevator", "icon": "🛗", "label": "Elevator"}],
    "71": [{"id": "no-permit", "icon": "🚫", "label": "SRO Illegal Work"}],
    "73": [{"id": "structural", "icon": "🧱", "label": "Failure to Maintain"}],
    "76": [{"id": "plumbing", "icon": "🔧", "label": "Plumbing"}],
    "7J": [{"id": "no-permit", "icon": "🚫", "label": "No Permit"}],
    "80": [{"id": "elevator", "icon": "🛗", "label": "Elevator"}],
    "81": [{"id": "elevator", "icon": "🛗", "label": "Elevator Accident"}],
    "83": [{"id": "no-permit", "icon": "🚫", "label": "Beyond Approved Plans"}],
    "84": [{"id": "facade", "icon": "🏢", "label": "Facade"}],
    "85": [{"id": "fire-stopping", "icon": "🔥", "label": "Gas/Fire-Stop"}],
    "86": [{"id": "no-permit", "icon": "🚫", "label": "Contrary to Stop Work"}],
    "91": [{"id": "no-permit", "icon": "🚫", "label": "No C of O"}],
    "92": [{"id": "no-permit", "icon": "🚫", "label": "Illegal Conversion"}],
    "94": [{"id": "plumbing", "icon": "🔧", "label": "Plumbing"}],
}

def tag_complaint(category_code: str) -> list:
    return COMPLAINT_TAG_MAP.get(category_code, [])

def tag_ecb_violation(desc: str) -> list:
    """Return list of hazard tag dicts that match the ECB violation description."""
    if not desc:
        return []
    desc_lower = desc.lower()
    tags = []
    for tag_id, defn in ECB_TAG_DEFINITIONS.items():
        if any(re.search(r'\b' + re.escape(kw) + r'\b', desc_lower) for kw in defn["keywords"]):
            tags.append({"id": tag_id, "icon": defn["icon"], "label": defn["label"]})
    return tags


def extract_cross_references(desc: str) -> dict:
    """Extract job numbers, ECB violation references, and CO numbers from ECB description."""
    if not desc:
        return {"jobs": [], "ecb_refs": [], "co_refs": []}
    
    desc_upper = desc.upper()
    
    # Job numbers: JOB #M00878280, JOB# M01032270, JOBS #M00966449
    jobs = list(set(re.findall(r'(?:JOB\s*#?\s*|JOBS\s*#?\s*)([A-Z]?\d{6,})', desc_upper)))
    
    # ECB violation refs: NOV #35450475J, VIOLATION #35258095H, ECB VIOLATION #39005951L
    ecb_refs = list(set(re.findall(r'(?:NOV|VIOLATION|ECB\s*VIOLATION)\s*#?\s*(\d{8,}[A-Z])', desc_upper)))
    
    # CO refs: C OF O #120015401, CERTIFICATE OF OCCUPANCY #120015401, COFO #1033361
    co_refs = list(set(re.findall(r'(?:C(?:ERTIFICATE)?\s*(?:OF\s*)?O(?:CCUPANCY)?|COFO|TCOFO)\s*#?\s*(\d{6,})', desc_upper)))
    
    return {"jobs": jobs, "ecb_refs": ecb_refs, "co_refs": co_refs}


# ─── Address Normalization ─────────────────────────────────

def normalize_address_query(q: str) -> str:
    """Expand common abbreviations and strip ordinals for flexible address search."""
    q = q.strip()
    
    # Strip city/state/zip suffixes common in pasted addresses
    # e.g. "251 West 92nd Street, New York, NY 10025" → "251 West 92nd Street"
    q = re.sub(r',?\s*(?:New York|Manhattan|Brooklyn|Queens|Bronx|Staten Island)\b.*$', '', q, flags=re.IGNORECASE)
    q = re.sub(r',?\s*NY\s*\d{5}(-\d{4})?$', '', q, flags=re.IGNORECASE)
    q = re.sub(r',?\s*\d{5}(-\d{4})?$', '', q)
    q = q.strip().rstrip(',')
    
    # Direction abbreviations (word boundaries)
    dir_map = {
        r'\bw\b': 'WEST', r'\be\b': 'EAST', r'\bn\b': 'NORTH', r'\bs\b': 'SOUTH',
    }
    for pat, repl in dir_map.items():
        q = re.sub(pat, repl, q, flags=re.IGNORECASE)
    
    # Street type abbreviations
    type_map = {
        r'\bst\.?\b$': 'STREET', r'\bave\.?\b': 'AVENUE', r'\bblvd\.?\b': 'BOULEVARD',
        r'\bdr\.?\b': 'DRIVE', r'\bpl\.?\b': 'PLACE', r'\brd\.?\b': 'ROAD',
        r'\bln\.?\b': 'LANE', r'\bct\.?\b': 'COURT', r'\btpke?\.?\b': 'TURNPIKE',
        r'\bpkwy\.?\b': 'PARKWAY', r'\bhwy\.?\b': 'HIGHWAY', r'\bter\.?\b': 'TERRACE',
    }
    for pat, repl in type_map.items():
        q = re.sub(pat, repl, q, flags=re.IGNORECASE)
    
    # Strip ordinal suffixes: 92nd → 92, 1st → 1, 2nd → 2, 3rd → 3, 4th → 4
    q = re.sub(r'(\d+)(?:st|nd|rd|th)\b', r'\1', q, flags=re.IGNORECASE)
    
    return q.upper()


# ─── Search ───────────────────────────────────────────────

@app.get("/api/search")
def search_buildings(q: str = Query(..., min_length=2, description="Address search query")):
    """Search buildings by address. Returns top 20 matches."""
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    # Normalize query: expand abbreviations, strip ordinals
    q_normalized = normalize_address_query(q)
    
    # Search address + aliases using normalized query
    cur.execute("""
        SELECT bin, address, aliases, borough, zip, score_grade, open_class_c,
            ecb_penalties, co_status, tco_expired, owner_name
        FROM building_scores
        WHERE address ILIKE %s OR aliases ILIKE %s
        ORDER BY 
            CASE WHEN address ILIKE %s THEN 0 
                 WHEN aliases ILIKE %s THEN 1
                 ELSE 2 END,
            open_class_c DESC NULLS LAST
        LIMIT 20
    """, (f'%{q_normalized}%', f'%{q_normalized}%', f'{q_normalized}%', f'%{q_normalized}%'))
    
    raw_results = cur.fetchall()
    cur.close()
    conn.close()
    
    # Determine matched address: if query matches an alias, surface that alias as display_address
    q_upper = q_normalized
    results = []
    for r in raw_results:
        r = dict(r)
        if r['address'] and q_upper in r['address'].upper():
            r['display_address'] = r['address']
            r['matched_alias'] = None
        elif r['aliases']:
            # Find which alias matched
            matched = None
            for alias in r['aliases'].split('; '):
                if q_upper in alias.upper():
                    matched = alias.strip()
                    break
            r['display_address'] = matched or r['address']
            r['matched_alias'] = matched
        else:
            r['display_address'] = r['address']
            r['matched_alias'] = None
        results.append(r)
    
    return {"results": results, "count": len(results)}


def natural_sort_key(s: str):
    """Sort apartments naturally: numeric part first, then alpha."""
    parts = re.split(r'(\d+)', s)
    return [int(p) if p.isdigit() else p.upper() for p in parts if p]


# ─── Apartments List ──────────────────────────────────────

@app.get("/api/building/{bin_number}/apartments")
def get_apartments(bin_number: str):
    """Get known apartment units for a building."""
    conn = get_db()
    cur = conn.cursor()

    # Direct from apartment field
    cur.execute("""
        SELECT DISTINCT UPPER(TRIM(apartment))
        FROM hpd_violations
        WHERE bin = %s AND apartment IS NOT NULL AND TRIM(apartment) != ''
    """, (bin_number,))
    apts = {row[0] for row in cur.fetchall()}

    # Regex extraction from novdescription
    cur.execute("""
        SELECT novdescription FROM hpd_violations
        WHERE bin = %s AND novdescription IS NOT NULL
    """, (bin_number,))
    apt_pattern = re.compile(r'APT\s+(\w+)', re.IGNORECASE)
    for (desc,) in cur.fetchall():
        for m in apt_pattern.finditer(desc):
            apts.add(m.group(1).upper())

    # Also extract apartments from ECB violation descriptions
    cur.execute("""
        SELECT violation_description FROM ecb_violations
        WHERE bin = %s AND violation_description IS NOT NULL
    """, (bin_number,))
    for (desc,) in cur.fetchall():
        for a in extract_apartments_from_description(desc):
            apts.add(a.upper())

    # Remove building-wide entries
    apts.discard('BLDG')
    apts.discard('')

    cur.close()
    conn.close()

    sorted_apts = sorted(apts, key=natural_sort_key)
    return {"apartments": sorted_apts, "count": len(sorted_apts)}


# ─── Building Report Card ─────────────────────────────────

@app.get("/api/building/{bin_number}")
def get_building(bin_number: str, apt: Optional[str] = None):
    """Get full building report card."""
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    # Basic info + scores
    cur.execute("""
        SELECT * FROM building_scores WHERE bin = %s
    """, (bin_number,))
    building = cur.fetchone()
    
    if not building:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Building not found")
    
    # HPD violations (open first, Class C first)
    cur.execute("""
        SELECT violationid, class, inspectiondate, currentstatus, violationstatus,
            novdescription, apartment, story
        FROM hpd_violations
        WHERE bin = %s
        ORDER BY 
            CASE violationstatus WHEN 'Open' THEN 0 ELSE 1 END,
            CASE class WHEN 'C' THEN 0 WHEN 'B' THEN 1 ELSE 2 END,
            inspectiondate DESC
        LIMIT 50
    """, (bin_number,))
    open_violations = cur.fetchall()

    # If apt filter, annotate and re-sort HPD violations
    if apt:
        apt_upper = apt.upper()
        # Extract floor number from apt (e.g., "11A" -> "11", "5B" -> "5")
        floor_match = re.match(r'(\d+)', apt_upper)
        apt_floor = floor_match.group(1) if floor_match else None
        apt_pattern = re.compile(r'APT\s+' + re.escape(apt_upper), re.IGNORECASE)

        for v in open_violations:
            v_apt = (v.get('apartment') or '').upper().strip()
            v_desc = v.get('novdescription') or ''
            v['is_unit_match'] = (v_apt == apt_upper) or bool(apt_pattern.search(v_desc))
            v_story = str(v.get('story') or '').strip()
            v['is_floor_match'] = (apt_floor and v_story == apt_floor and not v['is_unit_match'])

        # Sort: unit matches first, then floor matches, then rest
        open_violations.sort(key=lambda v: (0 if v['is_unit_match'] else 1 if v['is_floor_match'] else 2))
    
    # Tag HPD violations
    for v in open_violations:
        v['tags'] = tag_ecb_violation(v.get('novdescription') or '')

    # ECB violations
    cur.execute("""
        SELECT ecb_violation_number, issue_date, violation_description,
            penality_imposed, ecb_violation_status, severity
        FROM ecb_violations
        WHERE bin = %s
        ORDER BY issue_date DESC NULLS LAST
        LIMIT 50
    """, (bin_number,))
    ecb_violations = cur.fetchall()

    # Always extract apartments and tags from ECB descriptions
    for v in ecb_violations:
        desc = v.get('violation_description') or ''
        v['extracted_apartments'] = extract_apartments_from_description(desc)
        v['tags'] = tag_ecb_violation(desc)
        v['cross_references'] = extract_cross_references(desc)

    # Annotate ECB if apt filter
    if apt:
        for v in ecb_violations:
            v['is_unit_match'] = apt_upper in [a.upper() for a in v.get('extracted_apartments', [])]
    
    # C of O records + lat/long
    cur.execute("""
        SELECT job_number, job_type, c_o_issue_date, issue_type, latitude, longitude
        FROM certificates_of_occupancy
        WHERE bin = %s
        ORDER BY c_o_issue_date DESC NULLS LAST
    """, (bin_number,))
    co_records = cur.fetchall()
    
    # First and latest TCO dates (for TCO duration calculation)
    # Combine BISweb CO records with DOB NOW CO records
    first_tco_date = None
    latest_tco_date = None
    if building.get('co_status') == 'TCO':
        # BISweb: first TCO
        tco_records = [r for r in co_records if (r.get('issue_type') or '').upper() == 'TEMPORARY']
        bisweb_dates = [r['c_o_issue_date'] for r in tco_records if r.get('c_o_issue_date')]
        if bisweb_dates:
            first_tco_date = str(min(bisweb_dates))
            latest_tco_date = str(max(bisweb_dates))
        
        # DOB NOW: check for newer renewals (dataset pkdm-hqz6)
        cur.execute("""
            SELECT c_of_o_issuance_date, c_of_o_filing_type
            FROM dobnow_certificates_of_occupancy
            WHERE bin = %s
            ORDER BY c_of_o_issuance_date DESC
        """, (bin_number,))
        dobnow_co = cur.fetchall()
        for rec in dobnow_co:
            raw_date = rec.get('c_of_o_issuance_date', '')
            if not raw_date:
                continue
            # Parse "12/16/24  4:13:04 PM" format
            try:
                from datetime import datetime as _dt
                parsed = _dt.strptime(raw_date.strip(), "%m/%d/%y %I:%M:%S %p")
                d = parsed.strftime("%Y-%m-%d")
            except Exception:
                continue
            if not first_tco_date or d < first_tco_date:
                first_tco_date = d
            if not latest_tco_date or d > latest_tco_date:
                latest_tco_date = d

    # Extract lat/long from first record that has it
    latitude = longitude = None
    for rec in co_records:
        if rec.get('latitude') and rec.get('longitude'):
            latitude = float(rec['latitude'])
            longitude = float(rec['longitude'])
            break
    
    # Active permits (DOB NOW - basic)
    cur.execute("""
        SELECT job_filing_number, job_type, filing_status, current_status_date
        FROM dobnow_jobs
        WHERE bin = %s
        ORDER BY current_status_date DESC NULLS LAST
        LIMIT 30
    """, (bin_number,))
    permits = cur.fetchall()
    
    # DOB NOW detailed permits (with work type, signoff, descriptions)
    HIGH_RISK_WORK = ('Plumbing', 'Sprinklers', 'Mechanical Systems', 'Boiler Equipment', 
                      'Standpipe', 'Structural', 'Foundation')
    cur.execute("""
        SELECT job_filing_number, work_type, permit_status, job_description,
            issued_date, approved_date, expired_date, work_on_floor,
            owner_name, owner_business_name, applicant_business_name,
            estimated_job_costs, filing_reason
        FROM dobnow_permits
        WHERE bin = %s
        ORDER BY issued_date DESC NULLS LAST
    """, (bin_number,))
    detailed_permits = cur.fetchall()
    
    # Flag uninspected work with risk tiers
    today = date.today()
    for p in detailed_permits:
        wt = p.get('work_type') or ''
        status = p.get('permit_status') or ''
        p['is_high_risk'] = wt in HIGH_RISK_WORK
        p['signed_off'] = status == 'Signed-off'
        p['is_expired'] = bool(p.get('expired_date')) and p['expired_date'] < today
        
        # Risk tier: critical > warning > watch > clear
        if p['signed_off']:
            p['risk_tier'] = 'clear'
        elif p['is_high_risk'] and p['is_expired']:
            p['risk_tier'] = 'critical'  # High-risk work, expired, never inspected
        elif p['is_expired']:
            p['risk_tier'] = 'warning'   # Expired without signoff
        else:
            p['risk_tier'] = 'watch'     # Active, not yet signed off
        
        p['uninspected_risk'] = p['risk_tier'] == 'critical'
    
    # BIS jobs — all, with signoff status
    cur.execute("""
        SELECT DISTINCT ON (job) job, job_type, job_status_descrp, signoff_date, 
            latest_action_date, job_description, initial_cost
        FROM bis_job_filings
        WHERE bin = %s
        ORDER BY job DESC, latest_action_date DESC
        LIMIT 50
    """, (bin_number,))
    bis_jobs = cur.fetchall()
    
    # Flag unsigned jobs
    unsigned_jobs = [j for j in bis_jobs if 
        j['job_type'] in ('A1', 'NB') and
        not j.get('signoff_date') and
        'SIGNED OFF' not in (j.get('job_status_descrp') or '') and
        'NO WORK' not in (j.get('job_description') or '').upper()]
    
    # Build lookup of DOB NOW permit details for risk tiers
    dobnow_detail = {}
    cur.execute("""
        SELECT job_filing_number, work_type, permit_status, expired_date
        FROM dobnow_permits WHERE bin = %s
    """, (bin_number,))
    for dp in cur.fetchall():
        dobnow_detail[dp['job_filing_number']] = dp

    # Flag permits with no final inspection + risk tiers
    for j in bis_jobs:
        status = (j.get('job_status_descrp') or '').upper()
        has_signoff = bool(j.get('signoff_date')) or 'SIGNED OFF' in status
        is_issued = 'PERMIT ISSUED' in status
        j['no_final_inspection'] = is_issued and not has_signoff
        j['signed_off'] = has_signoff

        # Check for "NO WORK" filings
        job_desc = (j.get('job_description') or '')
        is_no_work = 'NO WORK' in job_desc.upper()

        # Check DOB NOW permit info for richer risk tiers
        dp = dobnow_detail.get(j.get('job'))
        if is_no_work:
            j['risk_tier'] = 'none'
            j['work_type'] = dp.get('work_type') if dp else None
        elif dp:
            wt = dp.get('work_type') or ''
            ps = dp.get('permit_status') or ''
            is_high_risk = wt in HIGH_RISK_WORK
            is_dp_signed = ps == 'Signed-off'
            expired_date = dp.get('expired_date')
            is_expired = bool(expired_date) and expired_date < today
            j['work_type'] = wt
            if is_dp_signed:
                j['risk_tier'] = 'clear'
            elif is_expired and expired_date:
                days_uninspected = (today - expired_date).days
                if is_high_risk and days_uninspected >= 730:
                    j['risk_tier'] = 'critical'
                elif is_high_risk or days_uninspected >= 1825:
                    j['risk_tier'] = 'high'
                elif days_uninspected >= 365:
                    j['risk_tier'] = 'warning'
                else:
                    j['risk_tier'] = 'low'
            elif not is_dp_signed:
                j['risk_tier'] = 'none'
            else:
                j['risk_tier'] = 'none'
        elif has_signoff:
            j['risk_tier'] = 'clear'
            j['work_type'] = None
        elif is_issued and not has_signoff:
            # BIS job without DOBNOW data — use latest_action_date
            latest = j.get('latest_action_date')
            if latest:
                days_uninspected = (today - latest).days
                if days_uninspected >= 1825:
                    j['risk_tier'] = 'high'
                elif days_uninspected >= 365:
                    j['risk_tier'] = 'warning'
                elif days_uninspected >= 0:
                    j['risk_tier'] = 'low'
                else:
                    j['risk_tier'] = 'none'
            else:
                j['risk_tier'] = 'warning'
            j['work_type'] = None
        else:
            j['risk_tier'] = 'none'
            j['work_type'] = None
    
    # Annotate permits and BIS jobs if apt filter
    if apt:
        for v in permits:
            v['is_unit_match'] = False
        for v in bis_jobs:
            desc = (v.get('job_description') or '').upper()
            v['is_unit_match'] = apt_upper in desc

    # DOB Safety Violations (elevators, boilers, facades, etc.)
    cur.execute("""
        SELECT violation_number, violation_issue_date, violation_type, violation_remarks,
            violation_status, device_number, device_type
        FROM dob_safety_violations
        WHERE bin = %s
        ORDER BY violation_issue_date DESC NULLS LAST
        LIMIT 50
    """, (bin_number,))
    safety_violations = cur.fetchall()

    cur.execute("SELECT COUNT(*) FROM dob_safety_violations WHERE bin = %s", (bin_number,))
    total_safety = cur.fetchone()['count']

    # DOB Complaints
    cur.execute("""
        SELECT complaint_number, status, date_entered, complaint_category,
            unit, disposition_date, disposition_code, inspection_date
        FROM dob_complaints
        WHERE bin = %s
        ORDER BY TO_DATE(date_entered, 'MM/DD/YYYY') DESC NULLS LAST
        LIMIT 50
    """, (bin_number,))
    complaints = cur.fetchall()

    # Total complaints count
    cur.execute("SELECT COUNT(*) FROM dob_complaints WHERE bin = %s", (bin_number,))
    total_complaints = cur.fetchone()['count']

    # Enrich complaints with descriptions + BISweb scraped data
    bisweb_map = {}
    try:
        cur.execute("""
            SELECT complaint_number, description, category_full, category_subcategory,
                   priority, assigned_to, ref_311, owner,
                   last_inspection_date, last_inspection_badge,
                   disposition_date as bisweb_disp_date, disposition_code as bisweb_disp_code,
                   disposition_text, comments
            FROM bisweb_complaint_details WHERE bin = %s
        """, (bin_number,))
        for row in cur.fetchall():
            bisweb_map[row['complaint_number']] = row
    except:
        pass

    for c in complaints:
        c['category_description'] = COMPLAINT_CATEGORIES.get(c.get('complaint_category', ''), c.get('complaint_category', ''))
        c['disposition_description'] = DISPOSITION_CODES.get(c.get('disposition_code', ''), c.get('disposition_code', ''))
        c['tags'] = tag_complaint(c.get('complaint_category', ''))
        bw = bisweb_map.get(c.get('complaint_number'))
        if bw:
            c['bisweb'] = {k: v for k, v in bw.items() if v is not None}

    # HPD contacts (owner, agent, officer, manager)
    cur.execute("""
        SELECT c.type, c.contactdescription, c.corporationname,
            c.firstname, c.lastname,
            c.businesshousenumber, c.businessstreetname, c.businesscity, c.businessstate, c.businesszip
        FROM hpd_contacts c
        JOIN hpd_registrations r ON c.registrationid = r.registrationid
        WHERE r.bin = %s
        ORDER BY
            CASE c.type
                WHEN 'CorporateOwner' THEN 0
                WHEN 'IndividualOwner' THEN 1
                WHEN 'Agent' THEN 2
                WHEN 'HeadOfficer' THEN 3
                WHEN 'SiteManager' THEN 4
                ELSE 5
            END
    """, (bin_number,))
    contacts = cur.fetchall()

    # HPD Litigations — by BIN + by owner name (across all buildings)
    owner_name = building.get('owner_name', '') if building else ''
    cur.execute("""
        SELECT * FROM (
            SELECT DISTINCT ON (litigationid) litigationid, casetype, caseopendate, casestatus, casejudgement, respondent, bin
            FROM hpd_litigations
            WHERE bin = %s
            ORDER BY litigationid, caseopendate DESC NULLS LAST
        ) t ORDER BY caseopendate DESC NULLS LAST
    """, (bin_number,))
    building_litigations = cur.fetchall()
    
    # Owner-wide litigations (respondent matches owner name)
    owner_litigations = []
    if owner_name and len(owner_name) > 3:
        cur.execute("""
            SELECT litigationid, casetype, caseopendate, casestatus, casejudgement, respondent, bin
            FROM hpd_litigations
            WHERE respondent ILIKE %s AND bin != %s
            ORDER BY caseopendate DESC NULLS LAST
            LIMIT 100
        """, (f"%{owner_name}%", bin_number))
        owner_litigations = cur.fetchall()
    
    # Mark source
    for l in building_litigations:
        l['source'] = 'building'
    for l in owner_litigations:
        l['source'] = 'owner'
    
    litigations = sorted(building_litigations + owner_litigations, key=lambda l: l.get('caseopendate') or '', reverse=True)

    cur.close()
    conn.close()
    
    return {
        "building": building,
        "latitude": latitude or (float(building['latitude']) if building.get('latitude') else None),
        "longitude": longitude or (float(building['longitude']) if building.get('longitude') else None),
        "open_violations": open_violations,
        "ecb_violations": ecb_violations,
        "co_records": co_records,
        "first_tco_date": first_tco_date,
        "latest_tco_date": latest_tco_date,
        "permits": permits,
        "detailed_permits": detailed_permits,
        "bis_jobs": bis_jobs,
        "unsigned_jobs": unsigned_jobs,
        "contacts": contacts,
        "complaints": complaints,
        "total_complaints": total_complaints,
        "safety_violations": safety_violations,
        "total_safety_violations": total_safety,
        "litigations": litigations,
    }


# ─── HPD Litigations (full list) ──────────────────────────

@app.get("/api/building/{bin_number}/litigations/all")
def get_litigations(bin_number: str, page: int = 1, per_page: int = 50, search: str = ""):
    """Get all HPD litigations for a building."""
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    where = "WHERE bin = %s"
    params = [bin_number]
    if search:
        where += " AND (casetype ILIKE %s OR respondent ILIKE %s OR casestatus ILIKE %s)"
        s = f"%{search}%"
        params.extend([s, s, s])
    
    cur.execute(f"SELECT COUNT(*) FROM hpd_litigations {where}", params)
    total = cur.fetchone()['count']
    
    offset = (page - 1) * per_page
    cur.execute(f"""
        SELECT litigationid, casetype, caseopendate, casestatus, casejudgement, respondent
        FROM hpd_litigations {where}
        ORDER BY caseopendate DESC NULLS LAST
        LIMIT %s OFFSET %s
    """, params + [per_page, offset])
    rows = cur.fetchall()
    
    cur.close()
    conn.close()
    return {"items": rows, "total": total, "page": page, "per_page": per_page}


# ─── Apartment View ───────────────────────────────────────

@app.get("/api/building/{bin_number}/apartment/{unit}")
def get_apartment(bin_number: str, unit: str):
    """Get apartment-specific violations."""
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    # HPD violations for this specific apartment
    cur.execute("""
        SELECT violationid, class, inspectiondate, currentstatus,
            novdescription, apartment, story
        FROM hpd_violations
        WHERE bin = %s AND UPPER(apartment) = UPPER(%s)
        ORDER BY inspectiondate DESC
    """, (bin_number, unit))
    apt_violations = cur.fetchall()
    
    # Also get open building-wide violations
    cur.execute("""
        SELECT violationid, class, inspectiondate, currentstatus,
            novdescription, apartment, story
        FROM hpd_violations
        WHERE bin = %s AND violationstatus = 'Open'
            AND (apartment IS NULL OR apartment = '' OR apartment = 'BLDG')
        ORDER BY inspectiondate DESC
        LIMIT 20
    """, (bin_number,))
    building_violations = cur.fetchall()
    
    cur.close()
    conn.close()
    
    return {
        "apartment": unit,
        "apartment_violations": apt_violations,
        "building_wide_violations": building_violations,
        "total_apartment": len(apt_violations),
    }


# ─── Owner Portfolio ──────────────────────────────────────

@app.get("/api/owner")
def get_owner_portfolio(
    name: str = Query(..., min_length=2),
    mode: Optional[str] = None,  # "contact" = search hpd_contacts, default = search building_scores.owner_name
    sort: Optional[str] = None,
    order: Optional[str] = "desc",
    grade: Optional[str] = None,
    borough: Optional[str] = None,
    tco_expired: Optional[str] = None,
):
    """Get all buildings owned by a given owner/entity with coordinates.
    
    mode=contact: Find all buildings where this person appears in HPD contacts
    (matches firstname+lastname, corporationname, or building_scores.owner_name).
    Default: search building_scores.owner_name only.
    """
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    if mode == "contact":
        # Find all BINs where this person/entity appears in HPD contacts
        # Search by full name (firstname + lastname), corporationname, or owner_name
        name_parts = name.strip().split()
        contact_conditions = []
        contact_params = []
        
        # Match corporationname
        contact_conditions.append("c.corporationname ILIKE %s")
        contact_params.append(f'%{name}%')
        
        # Match firstname + lastname (if name has 2+ parts)
        if len(name_parts) >= 2:
            contact_conditions.append("(c.firstname ILIKE %s AND c.lastname ILIKE %s)")
            contact_params.append(f'%{name_parts[0]}%')
            contact_params.append(f'%{name_parts[-1]}%')
        else:
            contact_conditions.append("c.lastname ILIKE %s")
            contact_params.append(f'%{name}%')
        
        contact_where = " OR ".join(contact_conditions)
        
        cur.execute(f"""
            SELECT DISTINCT r.bin::text as bin
            FROM hpd_contacts c
            JOIN hpd_registrations r ON c.registrationid = r.registrationid
            WHERE ({contact_where})
            AND r.bin IS NOT NULL
        """, contact_params)
        contact_bins = [row['bin'] for row in cur.fetchall()]
        
        # Also include buildings matched by owner_name in building_scores
        cur.execute("SELECT bin::text FROM building_scores WHERE owner_name ILIKE %s", (f'%{name}%',))
        owner_bins = [row['bin'] for row in cur.fetchall()]
        
        all_bins = list(set(contact_bins + owner_bins))
        
        if not all_bins:
            cur.close()
            conn.close()
            return {"owner": name, "summary": None, "buildings": []}
        
        conditions = ["bs.bin::text = ANY(%s)"]
        params: list = [all_bins]
    else:
        conditions = ["owner_name ILIKE %s"]
        params = [f'%{name}%']
    
    if grade:
        conditions.append("score_grade = %s")
        params.append(grade.upper())
    if borough:
        conditions.append("borough ILIKE %s")
        params.append(f'%{borough}%')
    if tco_expired and tco_expired.lower() in ("true", "yes", "1"):
        conditions.append("tco_expired = TRUE")
    
    where = " AND ".join(conditions)
    
    sort_map = {
        "grade": "score_grade",
        "violations": "total_hpd_violations",
        "penalties": "ecb_penalties",
        "address": "address",
        "open_class_c": "open_class_c",
    }
    sort_col = sort_map.get(sort or "", "open_class_c")
    sort_dir = "ASC" if (order or "").lower() == "asc" else "DESC"
    
    cur.execute(f"""
        SELECT bs.bin, bs.address, bs.aliases, bs.borough, bs.zip, bs.score_grade,
            bs.open_class_c, bs.total_hpd_violations, bs.total_ecb_violations,
            bs.ecb_penalties, bs.co_status, bs.tco_expired, bs.unsigned_jobs, bs.owner_name,
            bs.latitude, bs.longitude
        FROM building_scores bs
        WHERE {where}
        ORDER BY {sort_col} {sort_dir} NULLS LAST
    """, params)
    
    buildings = cur.fetchall()
    
    # Portfolio summary
    total_buildings = len(buildings)
    total_open_c = sum(b['open_class_c'] or 0 for b in buildings)
    total_hpd = sum(b['total_hpd_violations'] or 0 for b in buildings)
    total_ecb_violations = sum(b['total_ecb_violations'] or 0 for b in buildings)
    total_ecb = sum(float(b['ecb_penalties'] or 0) for b in buildings)
    expired_tcos_count = sum(1 for b in buildings if b['tco_expired'])
    unsigned_count = sum(b['unsigned_jobs'] or 0 for b in buildings)
    grade_dist = {}
    for b in buildings:
        g = b['score_grade'] or '?'
        grade_dist[g] = grade_dist.get(g, 0) + 1
    
    # Get unique boroughs for filter options
    boroughs = sorted(set(b['borough'] for b in buildings if b['borough']))
    
    # HPD litigations across all buildings + respondent name match
    all_bin_list = [b['bin'] for b in buildings if b['bin']]
    total_litigations = 0
    open_litigations = 0
    litigation_records = []
    if all_bin_list:
        cur.execute("""
            SELECT COUNT(*) as total,
                   COUNT(*) FILTER (WHERE casestatus = 'OPEN') as open
            FROM hpd_litigations WHERE bin = ANY(%s)
        """, (all_bin_list,))
        lit_row = cur.fetchone()
        total_litigations = lit_row['total'] or 0
        open_litigations = lit_row['open'] or 0
        
        # Also find litigations by respondent name match (catches cases at non-portfolio buildings)
        cur.execute("""
            SELECT litigationid, casetype, caseopendate, casestatus, casejudgement, respondent, bin
            FROM hpd_litigations
            WHERE bin = ANY(%s) OR respondent ILIKE %s
            ORDER BY caseopendate DESC NULLS LAST
            LIMIT 200
        """, (all_bin_list, f"%{name}%"))
        litigation_records = cur.fetchall()
        total_litigations = max(total_litigations, len(litigation_records))
        open_litigations = sum(1 for l in litigation_records if l.get('casestatus') == 'OPEN')
    
    # --- Comparison / percentile stats ---
    owner_building_count = total_buildings if total_buildings else 1  # avoid /0

    # City-wide averages + percentile ranking (owners with 2+ buildings)
    # Compute percentile by counting how many owners have fewer violations/penalties than this owner
    cur.execute("""
        WITH owner_stats AS (
            SELECT
                owner_name,
                COUNT(*) AS bldg_count,
                SUM(COALESCE(total_hpd_violations, 0)) AS sum_violations,
                SUM(COALESCE(open_class_c, 0)) AS sum_open_c,
                SUM(COALESCE(ecb_penalties, 0)) AS sum_penalties,
                SUM(CASE WHEN score_grade = 'F' THEN 1 ELSE 0 END) AS f_count
            FROM building_scores
            WHERE owner_name IS NOT NULL
            GROUP BY owner_name
            HAVING COUNT(*) >= 2
        )
        SELECT
            AVG(sum_violations::float / bldg_count) AS avg_viol_per_bldg,
            AVG(sum_open_c::float / bldg_count) AS avg_open_c_per_bldg,
            AVG(sum_penalties::float / bldg_count) AS avg_penalty_per_bldg,
            AVG(f_count::float / bldg_count * 100) AS avg_pct_f,
            COUNT(*) AS total_owners,
            COUNT(*) FILTER (WHERE sum_violations < %s)::float / GREATEST(COUNT(*), 1) AS viol_prank,
            COUNT(*) FILTER (WHERE sum_penalties < %s)::float / GREATEST(COUNT(*), 1) AS penalty_prank
        FROM owner_stats
    """, (total_hpd, total_ecb))
    comp_row = cur.fetchone()

    # Litigation city-wide avg
    cur.execute("""
        WITH owner_lit AS (
            SELECT bs.owner_name, COUNT(DISTINCT hl.litigationid) AS lit_count, COUNT(DISTINCT bs.bin) AS bldg_count
            FROM building_scores bs
            LEFT JOIN hpd_litigations hl ON hl.bin = bs.bin
            WHERE bs.owner_name IS NOT NULL
            GROUP BY bs.owner_name
            HAVING COUNT(DISTINCT bs.bin) >= 2
        )
        SELECT AVG(lit_count::float / bldg_count) AS avg_lit_rate FROM owner_lit
    """)
    lit_row = cur.fetchone()
    city_lit_rate = float(lit_row["avg_lit_rate"]) if lit_row and lit_row["avg_lit_rate"] else 0.0

    cur.close()
    conn.close()

    # Build comparisons dict
    if comp_row and comp_row.get("avg_viol_per_bldg") is not None:
        cr = comp_row
        owner_avg_viol = total_hpd / owner_building_count
        owner_avg_open_c = total_open_c / owner_building_count
        owner_avg_penalty = total_ecb / owner_building_count
        f_count = grade_dist.get("F", 0)
        owner_pct_f = (f_count / owner_building_count) * 100
        owner_lit_rate = total_litigations / owner_building_count

        viol_pct = round((cr["viol_prank"] or 0) * 100, 1)
        penalty_pct = round((cr["penalty_prank"] or 0) * 100, 1)

        comparisons = {
            "avg_violations_per_building": {
                "value": round(owner_avg_viol, 2),
                "city_avg": round(float(cr["avg_viol_per_bldg"]), 2),
            },
            "avg_open_class_c_per_building": {
                "value": round(owner_avg_open_c, 2),
                "city_avg": round(float(cr["avg_open_c_per_bldg"]), 2),
            },
            "avg_ecb_penalties_per_building": {
                "value": round(owner_avg_penalty, 2),
                "city_avg": round(float(cr["avg_penalty_per_bldg"]), 2),
            },
            "pct_f_grade": {
                "value": round(owner_pct_f, 1),
                "city_avg": round(float(cr["avg_pct_f"]), 1),
            },
            "violation_percentile": {
                "value": total_hpd,
                "percentile": viol_pct,
            },
            "penalty_percentile": {
                "value": round(total_ecb, 2),
                "percentile": penalty_pct,
            },
            "litigation_rate": {
                "value": round(owner_lit_rate, 2),
                "city_avg": round(city_lit_rate, 2),
            },
        }
    else:
        comparisons = None

    summary = {
        "total_buildings": total_buildings,
        "total_open_class_c": total_open_c,
        "total_hpd_violations": total_hpd,
        "total_ecb_violations": total_ecb_violations,
        "total_ecb_penalties": total_ecb,
        "expired_tcos": expired_tcos_count,
        "unsigned_jobs": unsigned_count,
        "grade_distribution": grade_dist,
        "boroughs": boroughs,
        "total_litigations": total_litigations,
        "open_litigations": open_litigations,
    }
    if comparisons:
        summary["comparisons"] = comparisons

    return {
        "owner": name,
        "summary": summary,
        "buildings": buildings,
        "litigations": litigation_records,
    }


@app.get("/api/search/owner")
def search_owners(q: str = Query(..., min_length=2)):
    """Search for owner names matching query. Searches both building_scores.owner_name
    and HPD contacts (firstname+lastname, corporationname)."""
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    # Search building_scores owner_name
    cur.execute("""
        SELECT owner_name as name, 'llc' as match_type, COUNT(*) as building_count,
            SUM(open_class_c) as total_open_c,
            SUM(total_hpd_violations) as total_hpd
        FROM building_scores
        WHERE owner_name ILIKE %s AND owner_name IS NOT NULL
        GROUP BY owner_name
        ORDER BY COUNT(*) DESC
        LIMIT 5
    """, (f'%{q}%',))
    llc_results = cur.fetchall()
    
    # Search HPD contacts by person name (firstname + lastname)
    q_parts = q.strip().split()
    if len(q_parts) >= 2:
        person_where = "c.firstname ILIKE %s AND c.lastname ILIKE %s"
        person_params = [f'%{q_parts[0]}%', f'%{q_parts[-1]}%']
    else:
        person_where = "c.lastname ILIKE %s"
        person_params = [f'%{q}%']
    
    cur.execute(f"""
        SELECT TRIM(UPPER(c.firstname)) || ' ' || TRIM(UPPER(c.lastname)) as name,
            'person' as match_type,
            COUNT(DISTINCT r.bin) as building_count
        FROM hpd_contacts c
        JOIN hpd_registrations r ON c.registrationid = r.registrationid
        WHERE {person_where}
            AND c.firstname IS NOT NULL AND c.firstname != ''
            AND c.lastname IS NOT NULL AND c.lastname != ''
        GROUP BY TRIM(UPPER(c.firstname)), TRIM(UPPER(c.lastname))
        HAVING COUNT(DISTINCT r.bin) >= 2
        ORDER BY COUNT(DISTINCT r.bin) DESC
        LIMIT 5
    """, person_params)
    person_results = cur.fetchall()
    
    # Combine, dedup, sort by building count
    all_results = list(llc_results) + list(person_results)
    all_results.sort(key=lambda r: r.get('building_count', 0), reverse=True)
    
    cur.close()
    conn.close()
    
    return {"results": all_results[:10], "count": len(all_results)}


# ─── Owner Network ────────────────────────────────────────

def _fuzzy_cluster_key(name: str) -> str:
    """Normalize a corporate name for fuzzy clustering.
    Strips common suffixes (LLC, CORP, INC, CO, LTD, LP, L.L.C., etc.),
    removes punctuation, collapses whitespace, and lowercases.
    Also normalizes common typos via simple phonetic-ish approach (just strip doubles).
    """
    if not name:
        return ""
    import re as _re
    s = name.upper().strip()
    # Remove common suffixes
    s = _re.sub(r'\b(LLC|L\.?L\.?C\.?|CORP\.?|CORPORATION|INC\.?|INCORPORATED|CO\.?|COMPANY|LTD\.?|LIMITED|LP|L\.?P\.?|ASSOCIATES?|MGMT|MANAGEMENT|REALTY|REAL\s*ESTATE|PROPERTIES|GROUP|HOLDINGS?)\b', '', s)
    # Remove punctuation
    s = _re.sub(r'[^A-Z0-9\s]', '', s)
    # Collapse whitespace
    s = _re.sub(r'\s+', ' ', s).strip()
    # Remove consecutive duplicate letters (helps with typos like EINENSTEIN vs EISENSTEIN)
    # Actually, just return the cleaned version — true fuzzy matching below
    return s


def _cluster_entities(names: list) -> dict:
    """Given a list of corporate names, return a mapping of original -> canonical.
    Uses normalized keys to cluster similar names together."""
    from difflib import SequenceMatcher
    
    key_map = {}  # normalized_key -> list of original names
    for name in names:
        if not name:
            continue
        key = _fuzzy_cluster_key(name)
        if not key:
            continue
        # Try to find an existing cluster this belongs to
        matched = False
        for existing_key in list(key_map.keys()):
            # Check similarity
            if key == existing_key:
                key_map[existing_key].append(name)
                matched = True
                break
            ratio = SequenceMatcher(None, key, existing_key).ratio()
            if ratio > 0.85:
                key_map[existing_key].append(name)
                matched = True
                break
        if not matched:
            key_map[key] = [name]
    
    # Build original -> canonical mapping (canonical = most common variant)
    result = {}
    for key, variants in key_map.items():
        # Pick the most common variant as canonical
        from collections import Counter
        canonical = Counter(variants).most_common(1)[0][0]
        for v in variants:
            result[v] = canonical
    return result


@app.get("/api/owner-network")
def get_owner_network(name: str = Query(..., min_length=2)):
    """Build a network graph of an owner/entity and their connected people, entities, and buildings."""
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    name_parts = name.strip().split()
    
    # Step 1-4: Single big CTE query to get the full 2-hop network
    # Build name matching conditions
    contact_conditions = ["c.corporationname ILIKE %(name_pattern)s"]
    params = {"name_pattern": f"%{name}%"}
    
    if len(name_parts) >= 2:
        contact_conditions.append("(c.firstname ILIKE %(first)s AND c.lastname ILIKE %(last)s)")
        params["first"] = f"%{name_parts[0]}%"
        params["last"] = f"%{name_parts[-1]}%"
    else:
        contact_conditions.append("c.lastname ILIKE %(name_pattern)s")
    
    seed_where = " OR ".join(contact_conditions)
    
    cur.execute(f"""
    WITH RECURSIVE
    -- Step 1: Find seed registrations where this person/entity appears
    seed_registrations AS (
        SELECT DISTINCT c.registrationid
        FROM hpd_contacts c
        WHERE ({seed_where})
          AND c.type != 'SiteManager'
    ),
    -- Step 2: Get BINs from seed registrations
    seed_bins AS (
        SELECT DISTINCT r.bin
        FROM hpd_registrations r
        JOIN seed_registrations sr ON r.registrationid = sr.registrationid
        WHERE r.bin IS NOT NULL
    ),
    -- Step 3: Get ALL contacts on those registrations (1-hop)
    hop1_contacts AS (
        SELECT DISTINCT c.registrationcontactid, c.registrationid, c.type, c.contactdescription,
               c.corporationname, c.firstname, c.lastname
        FROM hpd_contacts c
        JOIN hpd_registrations r ON c.registrationid = r.registrationid
        JOIN seed_bins sb ON r.bin = sb.bin
        WHERE c.type != 'SiteManager'
    ),
    -- Step 4: Find all OTHER registrations for hop1 people/entities (2-hop)
    hop1_person_keys AS (
        SELECT DISTINCT UPPER(TRIM(firstname)) as fn, UPPER(TRIM(lastname)) as ln
        FROM hop1_contacts
        WHERE firstname IS NOT NULL AND firstname != '' AND lastname IS NOT NULL AND lastname != ''
    ),
    hop1_entity_keys AS (
        SELECT DISTINCT UPPER(TRIM(corporationname)) as corpname
        FROM hop1_contacts
        WHERE corporationname IS NOT NULL AND corporationname != ''
    ),
    hop2_registrations AS (
        SELECT DISTINCT c.registrationid
        FROM hpd_contacts c
        WHERE c.type != 'SiteManager'
          AND (
            EXISTS (SELECT 1 FROM hop1_person_keys pk WHERE UPPER(TRIM(c.firstname)) = pk.fn AND UPPER(TRIM(c.lastname)) = pk.ln)
            OR EXISTS (SELECT 1 FROM hop1_entity_keys ek WHERE UPPER(TRIM(c.corporationname)) = ek.corpname)
          )
    ),
    -- All BINs in the network (seed + 2-hop)
    all_network_bins AS (
        SELECT DISTINCT r.bin
        FROM hpd_registrations r
        WHERE r.registrationid IN (SELECT registrationid FROM seed_registrations UNION SELECT registrationid FROM hop2_registrations)
          AND r.bin IS NOT NULL
        LIMIT 500
    ),
    -- All contacts across the full network
    all_network_contacts AS (
        SELECT DISTINCT c.registrationcontactid, c.registrationid, c.type, c.contactdescription,
               c.corporationname, c.firstname, c.lastname, r.bin
        FROM hpd_contacts c
        JOIN hpd_registrations r ON c.registrationid = r.registrationid
        JOIN all_network_bins ab ON r.bin = ab.bin
        WHERE c.type != 'SiteManager'
    )
    -- Return contacts and building info
    SELECT
        nc.registrationcontactid, nc.type, nc.contactdescription,
        nc.corporationname, nc.firstname, nc.lastname, nc.bin,
        bs.address, bs.borough, bs.score_grade, bs.open_class_c,
        bs.latitude, bs.longitude
    FROM all_network_contacts nc
    LEFT JOIN building_scores bs ON nc.bin = bs.bin
    """, params)
    
    rows = cur.fetchall()
    cur.close()
    conn.close()
    
    if not rows:
        return {"center": name, "nodes": [], "edges": [], "stats": {"total_buildings": 0, "total_people": 0, "total_entities": 0, "boroughs": []}}
    
    # Process rows into nodes and edges
    people = {}       # (fn, ln) -> {roles, bins}
    entities = {}     # corpname -> {bins}
    buildings = {}    # bin -> info
    edges = []        # list of edge dicts
    
    all_corpnames = set()
    for r in rows:
        if r['corporationname']:
            all_corpnames.add(r['corporationname'].strip().upper())
    
    # Cluster corporate names
    corp_canonical = _cluster_entities(list(all_corpnames))
    
    for r in rows:
        bin_val = str(r['bin']) if r['bin'] else None
        
        # Track building
        if bin_val and bin_val not in buildings:
            buildings[bin_val] = {
                "address": r['address'] or '',
                "borough": r['borough'] or '',
                "score_grade": r['score_grade'] or '',
                "open_class_c": r['open_class_c'],
                "latitude": float(r['latitude']) if r['latitude'] else None,
                "longitude": float(r['longitude']) if r['longitude'] else None,
            }
        
        fn = (r['firstname'] or '').strip().upper()
        ln = (r['lastname'] or '').strip().upper()
        corp = (r['corporationname'] or '').strip().upper()
        contact_desc = r['contactdescription'] or r['type'] or ''
        
        # Track person
        if fn and ln:
            key = (fn, ln)
            if key not in people:
                people[key] = {"roles": set(), "bins": set()}
            people[key]["roles"].add(contact_desc)
            if bin_val:
                people[key]["bins"].add(bin_val)
                # Edge: person -> building
                edges.append({"source": f"person:{fn}_{ln}", "target": f"building:{bin_val}", "relation": contact_desc})
        
        # Track entity
        if corp:
            canonical = corp_canonical.get(corp, corp)
            if canonical not in entities:
                entities[canonical] = {"bins": set()}
            if bin_val:
                entities[canonical]["bins"].add(bin_val)
                edges.append({"source": f"entity:{canonical.replace(' ', '_')}", "target": f"building:{bin_val}", "relation": contact_desc})
            
            # Edge: person -> entity (if both present on same registration)
            if fn and ln:
                edges.append({"source": f"person:{fn}_{ln}", "target": f"entity:{canonical.replace(' ', '_')}", "relation": contact_desc})
    
    # Deduplicate edges
    seen_edges = set()
    unique_edges = []
    for e in edges:
        key = (e["source"], e["target"], e["relation"])
        if key not in seen_edges:
            seen_edges.add(key)
            unique_edges.append(e)
    
    # Build node list
    nodes = []
    for (fn, ln), info in people.items():
        nodes.append({
            "id": f"person:{fn}_{ln}",
            "type": "person",
            "label": f"{fn.title()} {ln.title()}",
            "roles": sorted(info["roles"]),
            "building_count": len(info["bins"]),
        })
    
    for corp, info in entities.items():
        nodes.append({
            "id": f"entity:{corp.replace(' ', '_')}",
            "type": "entity",
            "label": corp.title(),
            "building_count": len(info["bins"]),
        })
    
    for bin_val, info in buildings.items():
        nodes.append({
            "id": f"building:{bin_val}",
            "type": "building",
            "label": info["address"],
            "address": info["address"],
            "borough": info["borough"],
            "grade": info["score_grade"],
            "open_class_c": info["open_class_c"],
            "latitude": info["latitude"],
            "longitude": info["longitude"],
        })
    
    boroughs = sorted(set(b["borough"] for b in buildings.values() if b["borough"]))
    
    return {
        "center": name.upper(),
        "nodes": nodes,
        "edges": unique_edges,
        "stats": {
            "total_buildings": len(buildings),
            "total_people": len(people),
            "total_entities": len(entities),
            "boroughs": boroughs,
        }
    }


# ─── Stats ────────────────────────────────────────────────

@app.get("/api/explore/expired-tcos")
def explore_expired_tcos(
    sort: Optional[str] = None,
    order: Optional[str] = "desc",
    grade: Optional[str] = None,
    borough: Optional[str] = None,
):
    """Get all buildings with expired Temporary Certificates of Occupancy."""
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    conditions = ["tco_expired = TRUE"]
    params: list = []
    
    if grade:
        conditions.append("score_grade = %s")
        params.append(grade.upper())
    if borough:
        conditions.append("borough ILIKE %s")
        params.append(f'%{borough}%')
    
    where = " AND ".join(conditions)
    
    sort_map = {
        "grade": "score_grade",
        "violations": "total_hpd_violations",
        "penalties": "ecb_penalties",
        "address": "address",
        "open_class_c": "open_class_c",
        "tco_date": "latest_tco_date",
    }
    sort_col = sort_map.get(sort or "", "latest_tco_date")
    sort_dir = "ASC" if (order or "").lower() == "asc" else "DESC"
    
    cur.execute(f"""
        SELECT bs.bin, bs.address, bs.aliases, bs.borough, bs.zip, bs.score_grade,
            bs.open_class_c, bs.total_hpd_violations, bs.total_ecb_violations,
            bs.ecb_penalties, bs.co_status, bs.tco_expired, bs.latest_tco_date, bs.unsigned_jobs, bs.owner_name,
            bs.latitude, bs.longitude,
            first_tco.first_tco_date,
            (first_tco.first_tco_date + INTERVAL '2 years')::date as legal_expiration_date
        FROM building_scores bs
        LEFT JOIN LATERAL (
            SELECT MIN(c_o_issue_date) as first_tco_date
            FROM certificates_of_occupancy co
            WHERE co.bin = bs.bin AND co.issue_type = 'Temporary'
        ) first_tco ON TRUE
        WHERE {where}
        ORDER BY {sort_col} {sort_dir} NULLS LAST
    """, params)
    
    buildings = cur.fetchall()
    
    total_buildings = len(buildings)
    total_open_c = sum(b['open_class_c'] or 0 for b in buildings)
    total_hpd = sum(b['total_hpd_violations'] or 0 for b in buildings)
    total_ecb = sum(float(b['ecb_penalties'] or 0) for b in buildings)
    unsigned_count = sum(b['unsigned_jobs'] or 0 for b in buildings)
    grade_dist = {}
    for b in buildings:
        g = b['score_grade'] or '?'
        grade_dist[g] = grade_dist.get(g, 0) + 1
    boroughs = sorted(set(b['borough'] for b in buildings if b['borough']))
    
    cur.close()
    conn.close()
    
    return {
        "summary": {
            "total_buildings": total_buildings,
            "total_open_class_c": total_open_c,
            "total_hpd_violations": total_hpd,
            "total_ecb_penalties": total_ecb,
            "unsigned_jobs": unsigned_count,
            "grade_distribution": grade_dist,
            "boroughs": boroughs,
        },
        "buildings": buildings,
    }


@app.get("/api/stats")
def get_stats():
    """Get overall database statistics."""
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    cur.execute("""
        SELECT 
            COUNT(*) as total_buildings,
            SUM(open_class_c) as total_open_class_c,
            SUM(total_ecb_violations) as total_ecb_violations,
            SUM(ecb_penalties) as total_ecb_penalties,
            COUNT(*) FILTER (WHERE tco_expired = TRUE) as expired_tcos,
            COUNT(*) FILTER (WHERE score_grade = 'F') as grade_f,
            COUNT(*) FILTER (WHERE score_grade = 'D') as grade_d,
            COUNT(*) FILTER (WHERE score_grade = 'C') as grade_c,
            COUNT(*) FILTER (WHERE score_grade = 'B') as grade_b,
            COUNT(*) FILTER (WHERE score_grade = 'A') as grade_a
        FROM building_scores
    """)
    stats = cur.fetchone()
    
    # Data freshness
    cur.execute("""
        SELECT 
            (SELECT MAX(inspectiondate) FROM hpd_violations) as hpd_latest,
            (SELECT MAX(issue_date)::text FROM ecb_violations) as ecb_latest,
            (SELECT MAX(date_entered) FROM dob_complaints) as complaints_latest,
            (SELECT MAX(violation_issue_date) FROM dob_safety_violations) as safety_latest,
            (SELECT MAX(updated_at) FROM building_scores) as scores_updated
    """)
    freshness = cur.fetchone()
    stats['data_freshness'] = freshness
    
    cur.close()
    conn.close()
    return stats


# ─── Paginated List Endpoints ──────────────────────────────

ALLOWED_HPD_SORT = {"class", "inspectiondate", "currentstatus", "violationstatus", "apartment", "severity"}
ALLOWED_ECB_SORT = {"severity", "issue_date", "ecb_violation_status", "penality_imposed"}
ALLOWED_PERMIT_SORT = {"job_type", "latest_action_date", "job_status_descrp"}


@app.get("/api/building/{bin_number}/violations/all")
def get_all_violations(
    bin_number: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    sort: str = Query("inspectiondate"),
    order: str = Query("desc"),
    search: Optional[str] = None,
    status: Optional[str] = None,
    violation_class: Optional[str] = Query(None, alias="class"),
    apt: Optional[str] = None,
):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    conditions = ["bin = %s"]
    params: list = [bin_number]

    if status:
        conditions.append("violationstatus = %s")
        params.append(status)
    if violation_class:
        conditions.append("class = %s")
        params.append(violation_class)
    if search:
        conditions.append("novdescription ILIKE %s")
        params.append(f"%{search}%")

    where = " AND ".join(conditions)
    sort_col = sort if sort in ALLOWED_HPD_SORT else "inspectiondate"
    sort_dir = "ASC" if order.lower() == "asc" else "DESC"

    # Severity sort: open first, then C > B > A, then by date
    if sort_col == "severity":
        order_clause = f"""CASE violationstatus WHEN 'Open' THEN 0 ELSE 1 END {"ASC" if sort_dir == "DESC" else "DESC"},
            CASE class WHEN 'C' THEN 0 WHEN 'B' THEN 1 ELSE 2 END {"ASC" if sort_dir == "DESC" else "DESC"},
            inspectiondate DESC NULLS LAST"""
    else:
        order_clause = f"{sort_col} {sort_dir} NULLS LAST"

    cur.execute(f"SELECT COUNT(*) as total FROM hpd_violations WHERE {where}", params)
    total = cur.fetchone()["total"]

    offset = (page - 1) * per_page
    cur.execute(f"""
        SELECT violationid, class, inspectiondate, currentstatus, violationstatus,
            novdescription, apartment, story, novissueddate, novtype
        FROM hpd_violations
        WHERE {where}
        ORDER BY {order_clause}
        LIMIT %s OFFSET %s
    """, params + [per_page, offset])
    rows = cur.fetchall()

    if apt:
        apt_upper = apt.upper()
        floor_match = re.match(r'(\d+)', apt_upper)
        apt_floor = floor_match.group(1) if floor_match else None
        apt_pat = re.compile(r'APT\s+' + re.escape(apt_upper), re.IGNORECASE)
        for v in rows:
            v_apt = (v.get('apartment') or '').upper().strip()
            v_desc = v.get('novdescription') or ''
            v['is_unit_match'] = (v_apt == apt_upper) or bool(apt_pat.search(v_desc))
            v_story = str(v.get('story') or '').strip()
            v['is_floor_match'] = bool(apt_floor and v_story == apt_floor and not v['is_unit_match'])

    # Tag HPD violations
    for v in rows:
        v['tags'] = tag_ecb_violation(v.get('novdescription') or '')

    cur.close()
    conn.close()
    return {"rows": rows, "total": total, "page": page, "per_page": per_page}


@app.get("/api/building/{bin_number}/ecb/all")
def get_all_ecb(
    bin_number: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    sort: str = Query("issue_date"),
    order: str = Query("desc"),
    search: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    has_balance: Optional[str] = None,
    apt: Optional[str] = None,
):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    conditions = ["bin = %s"]
    params: list = [bin_number]

    if severity:
        conditions.append("severity = %s")
        params.append(severity)
    if status:
        conditions.append("ecb_violation_status = %s")
        params.append(status)
    if has_balance and has_balance.lower() in ("true", "yes", "1"):
        conditions.append("balance_due > 0")
    if search:
        conditions.append("violation_description ILIKE %s")
        params.append(f"%{search}%")

    where = " AND ".join(conditions)
    sort_col = sort if sort in ALLOWED_ECB_SORT else "issue_date"
    sort_dir = "ASC" if order.lower() == "asc" else "DESC"

    cur.execute(f"SELECT COUNT(*) as total FROM ecb_violations WHERE {where}", params)
    total = cur.fetchone()["total"]

    offset = (page - 1) * per_page
    cur.execute(f"""
        SELECT ecb_violation_number, issue_date, violation_description, violation_type,
            penality_imposed, amount_paid, balance_due, ecb_violation_status, severity,
            respondent_name, hearing_date, hearing_status, certification_status,
            served_date, section_law_description1, infraction_code1, aggravated_level
        FROM ecb_violations
        WHERE {where}
        ORDER BY {sort_col} {sort_dir} NULLS LAST
        LIMIT %s OFFSET %s
    """, params + [per_page, offset])
    rows = cur.fetchall()

    for v in rows:
        desc = v.get('violation_description') or ''
        v['tags'] = tag_ecb_violation(desc)
        v['cross_references'] = extract_cross_references(desc)
        v['extracted_apartments'] = extract_apartments_from_description(desc)
        if apt:
            v['is_unit_match'] = apt.upper() in desc.upper()

    cur.close()
    conn.close()
    return {"rows": rows, "total": total, "page": page, "per_page": per_page}


@app.get("/api/building/{bin_number}/ecb/references/{ref_id}")
def get_ecb_references(bin_number: str, ref_id: str):
    """Find all ECB violations that reference a given job, violation, or CO number."""
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT ecb_violation_number, issue_date, violation_description, 
            ecb_violation_status, severity, penality_imposed
        FROM ecb_violations 
        WHERE bin = %s AND UPPER(violation_description) LIKE %s
        ORDER BY issue_date DESC
    """, [bin_number, f"%{ref_id.upper()}%"])
    rows = cur.fetchall()
    for v in rows:
        desc = v.get('violation_description') or ''
        v['tags'] = tag_ecb_violation(desc)
        v['cross_references'] = extract_cross_references(desc)
    cur.close()
    conn.close()
    return {"rows": rows, "ref_id": ref_id}


# ─── Complaints ───────────────────────────────────────────

COMPLAINT_CATEGORIES = {
    "01": "Accident - Construction/Plumbing",
    "02": "Accident - To Public",
    "03": "Adjacent Buildings - Not Protected",
    "04": "After Hours Work - Illegal",
    "05": "Permit - None (Building/PA/Demo etc.)",
    "06": "Construction - Change Grade/Watercourse",
    "07": "Construction - Change Watercourse",
    "08": "Contractor's Sign - None",
    "09": "Debris - Excessive",
    "10": "Debris/Building - Falling or In Danger of Falling",
    "11": "Demolition - No Permit",
    "12": "Demolition - Unsafe/Illegal/Mechanical Demo",
    "13": "Elevator In (FDNY) Readiness - None",
    "14": "Excavation - Undermining Adjacent Building",
    "15": "Fence - None/Inadequate/Illegal",
    "16": "Inadequate Support/Shoring",
    "17": "Material/Personnel Hoist - No Permit",
    "18": "Material Storage - Unsafe",
    "19": "Mechanical Demolition - Illegal",
    "1A": "Illegal Conversion Commercial to Dwelling",
    "1B": "Illegal Tree Removal/Topo Change in SNAD",
    "1C": "Damage Assessment Request (Disaster)",
    "1D": "Con Edison Referral",
    "1E": "Suspended Scaffolds - No Permit/Dangerous/Accident",
    "1F": "Failure to Comply with Annual Crane Inspection",
    "1G": "Stalled Construction Site",
    "1H": "Emergency Asbestos Response Inspection",
    "1J": "Gas Piping Removed w/o Permit",
    "1K": "Bowstring Truss Tracking Complaint",
    "1L": "Gas Utility Referral",
    "1N": "COVID-19 Related",
    "1U": "Special Operations Compliance Inspection",
    "1V": "Electrical Enforcement Work Order (DOB)",
    "1W": "Plumbing Enforcement Work Order (DOB)",
    "1X": "Construction Enforcement Work Order (DOB)",
    "1Y": "Enforcement Work Order (DOB)",
    "1Z": "Enforcement Work Order (DOB)",
    "20": "Landmark Building - Illegal Work",
    "21": "Safety Net/Guard Rail - Damaged/Inadequate/None (>6 stories)",
    "22": "Safety Netting - None",
    "23": "Sidewalk Shed/Scaffold - Inadequate/Defect/None/No Permit",
    "24": "Sidewalk Shed - None",
    "25": "Warning Signs/Lights - None",
    "26": "Watchman - None",
    "27": "Auto Repair - Illegal",
    "28": "Building - In Danger of Collapse",
    "29": "Building - Vacant, Open and Unguarded",
    "2A": "Posted Notice or Order Removed/Tampered With",
    "2B": "Failure to Comply with Vacate Order",
    "2C": "Smoking Ban - Smoking on Construction Site",
    "2D": "Smoking Signs - Not Observed on Construction Site",
    "2E": "Tracking Complaint for Full Demolition Notification",
    "2F": "Building Under Structural Monitoring",
    "2G": "Advertising Sign/Billboard/Posters - Illegal",
    "2H": "Second Avenue Subway Construction",
    "2J": "SANDY: Building Destroyed",
    "2K": "Structurally Compromised Building (LL33/08)",
    "2L": "Facade (LL11/98) - Unsafe Notification",
    "2M": "Monopole Tracking Complaint",
    "2N": "COVID-19 Executive Order",
    "2P": "Facades Unit Compliance Inspection",
    "2Y": "Facade Safety",
    "30": "Building Shaking/Vibrating/Struct Stability Affected",
    "31": "Certificate of Occupancy - None/Illegal/Contrary to CO",
    "32": "C of O - Not Being Complied With",
    "33": "Commercial Use - Illegal",
    "34": "Compactor Room/Refuse Chute - Illegal",
    "35": "Curb Cut/Driveway/Carport - Illegal",
    "36": "Driveway/Carport - Illegal",
    "37": "Egress - Locked/Blocked/Improper/No Secondary Means",
    "38": "Egress - Exit Door Not Proper",
    "39": "Egress - No Secondary Means",
    "3A": "Unlicensed/Illegal/Improper Electrical Work In Progress",
    "3B": "Routine Inspection",
    "3C": "Plan Compliance Inspection",
    "3D": "Bicycle Access Waiver Request - Elevator Safety",
    "3E": "Bicycle Access Waiver Request - Alternate Parking",
    "3G": "Restroom Non-Compliance (LL79/16)",
    "3H": "DCP/BSA Compliance Inspection",
    "40": "Falling - Part of Building",
    "41": "Falling - Part of Building in Danger of",
    "42": "Fence - Illegal",
    "43": "Structural Stability Affected",
    "44": "Fireplace/Wood Stove - Illegal",
    "45": "Illegal Conversion",
    "46": "PA Permit - None",
    "47": "PA Permit - Not Being Complied With",
    "48": "Residential Use - Illegal",
    "49": "Storefront/Business Sign/Awning/Marquee - Illegal",
    "4A": "Illegal Hotel Rooms in Residential Buildings",
    "4B": "SEP - Professional Certification Compliance Audit",
    "4C": "DOB Safety Inspection",
    "4D": "Compliance Audit",
    "4E": "Stalled Sites Tracking Complaint",
    "4F": "Scaffolding",
    "4G": "Illegal Conversion No Access Follow-Up",
    "4H": "V.E.S.T. Program (DOB & NYPD)",
    "4J": "M.A.R.C.H. Program (Interagency)",
    "4K": "CSC: DM Tracking Complaint",
    "4L": "CSC: High-Rise Tracking Complaint",
    "4M": "CSC: Low-Rise Tracking Complaint",
    "4N": "Retaining Wall Tracking Complaint",
    "4P": "Legal/Padlock Tracking Complaint",
    "4Q": "Quality of Life",
    "4S": "Sustainability Enforcement Work Order",
    "4W": "Woodside Settlement Project",
    "4X": "After Hours Work - With AHV Permit",
    "50": "Sign Falling/Danger/Illegal Erection",
    "51": "Illegal Social Club",
    "52": "Sprinkler System - Inadequate",
    "53": "Vent/Exhaust - Illegal/Improper",
    "54": "Wall/Retaining Wall - Bulging/Cracked",
    "55": "Zoning - Non-Conforming",
    "56": "Boiler - Fumes/Smoke/Carbon Monoxide",
    "57": "Boiler - Illegal",
    "58": "Boiler - Defective/Inoperative/No Permit",
    "59": "Electrical Wiring - Defective/Exposed/In Progress",
    "5A": "Request for Joint FDNY/DOB Inspection",
    "5B": "Non-Compliance with Lightweight Materials",
    "5C": "Structural Stability - New Building Under Construction",
    "5D": "Non-Compliance with TPPN 1/00 - Vertical Enlargements",
    "5E": "Amusement Ride Accident/Incident",
    "5F": "Compliance Inspection",
    "5G": "Unlicensed/Illegal/Improper Work In Progress",
    "5H": "Illegal Activity",
    "5J": "Multi Agency Joint Inspection",
    "60": "Electrical Work - Improper",
    "61": "Electrical Work - Unlicensed, In Progress",
    "62": "Elevator - Danger Condition/Shaft Open/Unguarded",
    "63": "Elevator - Defective/Inoperative",
    "64": "Elevator Shaft - Open and Unguarded",
    "65": "Gas Hook-Up/Piping - Illegal or Defective",
    "66": "Plumbing Work - Illegal/No Permit (Sprinkler/Standpipe)",
    "67": "Crane - No Permit/License/Cert/Unsafe/Illegal",
    "68": "Crane/Scaffold - Unsafe/Illegal Operations",
    "69": "Crane/Scaffold - Unsafe Installation/Equipment",
    "6A": "Vesting Inspection",
    "6B": "Semi-Annual Homeless Shelter Inspection: Plumbing",
    "6C": "Semi-Annual Homeless Shelter Inspection: Construction",
    "6D": "Semi-Annual Homeless Shelter Inspection: Electrical",
    "6M": "Elevator - Multiple Devices on Property",
    "6S": "Elevator - Single Device/No Alternate Service",
    "6V": "Tenant Safety Inspection",
    "6W": "Tenant Safety - Failure to Post/Distribute",
    "6X": "Work Without Permits Watch List Compliance",
    "6Y": "Local Law Audits",
    "6Z": "Training Compliance",
    "70": "Suspension Scaffold Hanging - No Work In Progress",
    "71": "SRO - Illegal Work/No Permit/Change in Occupancy",
    "72": "SRO - Change in Occupancy/Use",
    "73": "Failure to Maintain",
    "74": "Illegal Commercial/Manufacturing Use in Residential Zone",
    "75": "Adult Establishment",
    "76": "Unlicensed/Illegal/Improper Plumbing Work In Progress",
    "77": "Contrary to LL58/87 (Handicap Access)",
    "78": "Privately Owned Public Space - Non-Compliance",
    "79": "Lights from Parking Lot Shining on Building",
    "7F": "CSE: Tracking Compliance",
    "7G": "CSE: Sweep",
    "7J": "Work Without a Permit - Occupied Multiple Dwelling",
    "7K": "Local Law 188/17 Compliance - Active Jobs",
    "7L": "DOHMH Referral - Tenant Protection Non-Compliance",
    "7N": "Privately Owned Public Space - Compliance Inspection",
    "7P": "Facade Compliance",
    "7Q": "Facade Safety Inspection",
    "7R": "Construction Safety Compliance",
    "7S": "Site Safety Compliance",
    "80": "Elevator Not Inspected/Illegal/No Permit",
    "81": "Elevator - Accident",
    "82": "Boiler - Accident/Explosion",
    "83": "Construction - Contrary/Beyond Approved Plans/Permits",
    "84": "Facade - Defective/Cracking",
    "85": "Failure to Retain Water/Improper Drainage (LL103/89)",
    "86": "Work Contrary to Stop Work Order",
    "87": "Request for Deck Safety Inspection",
    "88": "Safety Net/Guard Rail - Damaged/Inadequate/None (≤6 stories)",
    "89": "Accident - Cranes/Derricks/Suspension",
    "8A": "Construction Safety Compliance (CSC) Action",
    "8P": "Priority Inspection",
    "90": "Unlicensed/Illegal Activity",
    "91": "Site Conditions Endangering Workers",
    "92": "Illegal Conversion of Manufacturing/Industrial Space",
    "93": "Request for Retaining Wall Safety Inspection",
    "94": "Plumbing - Defective/Leaking/Not Maintained",
    "95": "Bronx 2nd Offense Pilot Project",
    "96": "Unlicensed Boiler/Electrical/Plumbing/Sign Work Completed",
    "97": "Other Agency Jurisdiction",
    "98": "Refer to Operations for Determination",
    "99": "Other",
}

DISPOSITION_CODES = {
    "A1": "Violation Issued", "A2": "Warning Issued",
    "A3": "Partial Stop Work Order", "A4": "Full Stop Work Order",
    "A5": "Vacate Order", "A6": "Unsafe Building",
    "A8": "Referred", "A9": "No Action Necessary",
    "I1": "No Access", "I2": "Unable to Locate",
}


@app.get("/api/building/{bin_number}/complaints/all")
def get_all_complaints(
    bin_number: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    sort: str = Query("date_entered"),
    order: str = Query("desc"),
    search: Optional[str] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    conditions = ["bin = %s"]
    params: list = [bin_number]
    if status:
        conditions.append("status = %s")
        params.append(status)
    if category:
        conditions.append("complaint_category = %s")
        params.append(category)
    if search:
        conditions.append("""(complaint_category ILIKE %s OR unit ILIKE %s
            OR EXISTS (SELECT 1 FROM bisweb_complaint_details bw 
                WHERE bw.complaint_number = dob_complaints.complaint_number::text
                AND (bw.description ILIKE %s OR bw.comments ILIKE %s OR bw.category_full ILIKE %s)))""")
        params.extend([f"%{search}%"] * 5)

    where = " AND ".join(conditions)
    ALLOWED_SORT = {"date_entered", "complaint_number", "status", "complaint_category", "disposition_date"}
    sort_col = sort if sort in ALLOWED_SORT else "date_entered"
    sort_dir = "ASC" if order.lower() == "asc" else "DESC"
    # date columns stored as MM/DD/YYYY text — need TO_DATE for proper sorting
    DATE_COLS = {"date_entered", "disposition_date"}
    order_expr = f"TO_DATE({sort_col}, 'MM/DD/YYYY') {sort_dir}" if sort_col in DATE_COLS else f"{sort_col} {sort_dir}"

    cur.execute(f"SELECT COUNT(*) as total FROM dob_complaints WHERE {where}", params)
    total = cur.fetchone()["total"]

    offset_val = (page - 1) * per_page
    cur.execute(f"""
        SELECT complaint_number, status, date_entered, complaint_category,
            unit, disposition_date, disposition_code, inspection_date
        FROM dob_complaints WHERE {where}
        ORDER BY {order_expr} NULLS LAST
        LIMIT %s OFFSET %s
    """, params + [per_page, offset_val])
    rows = cur.fetchall()

    # BISweb enrichment
    bisweb_map = {}
    try:
        complaint_nums = [r['complaint_number'] for r in rows if r.get('complaint_number')]
        if complaint_nums:
            placeholders = ','.join(['%s'] * len(complaint_nums))
            cur.execute(f"""
                SELECT complaint_number, description, category_full, category_subcategory,
                       priority, assigned_to, ref_311, owner,
                       last_inspection_date, last_inspection_badge,
                       disposition_date as bisweb_disp_date, disposition_code as bisweb_disp_code,
                       disposition_text, comments
                FROM bisweb_complaint_details WHERE complaint_number IN ({placeholders})
            """, complaint_nums)
            for bw in cur.fetchall():
                bisweb_map[bw['complaint_number']] = bw
    except:
        pass

    for r in rows:
        r['category_description'] = COMPLAINT_CATEGORIES.get(r.get('complaint_category', ''), r.get('complaint_category', ''))
        r['disposition_description'] = DISPOSITION_CODES.get(r.get('disposition_code', ''), r.get('disposition_code', ''))
        r['tags'] = tag_complaint(r.get('complaint_category', ''))
        bw = bisweb_map.get(r.get('complaint_number'))
        if bw:
            r['bisweb'] = {k: v for k, v in bw.items() if v is not None}

    cur.close()
    conn.close()
    return {"rows": rows, "total": total, "page": page, "per_page": per_page}


@app.get("/api/building/{bin_number}/permits/all")
def get_all_permits(
    bin_number: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    sort: str = Query("latest_action_date"),
    order: str = Query("desc"),
    search: Optional[str] = None,
    job_type: Optional[str] = None,
    signed_off: Optional[str] = None,
    no_final_inspection: Optional[str] = None,
    risk_tier: Optional[str] = None,
    apt: Optional[str] = None,
):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # BIS jobs
    bis_conds = ["bin = %s"]
    bis_params: list = [bin_number]
    if job_type:
        bis_conds.append("job_type = %s")
        bis_params.append(job_type)
    if search:
        bis_conds.append("job_description ILIKE %s")
        bis_params.append(f"%{search}%")

    bis_where = " AND ".join(bis_conds)
    cur.execute(f"""
        SELECT DISTINCT ON (job) job, job_type, job_status_descrp, signoff_date,
            latest_action_date, job_description, initial_cost, building_type,
            existing_dwelling_units, proposed_dwelling_units,
            owner_first_name, owner_last_name, owner_business_name,
            'BIS' as source
        FROM bis_job_filings
        WHERE {bis_where}
        ORDER BY job DESC, latest_action_date DESC
    """, bis_params)
    bis_rows = cur.fetchall()

    # Get DOB NOW detailed permits for this building (for risk tiers)
    HIGH_RISK_WORK = ('Plumbing', 'Sprinklers', 'Mechanical Systems', 'Boiler Equipment', 
                      'Standpipe', 'Structural', 'Foundation')
    dobnow_permit_info = {}
    try:
        cur2 = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur2.execute("""
            SELECT job_filing_number, work_type, permit_status, issued_date, expired_date
            FROM dobnow_permits WHERE bin = %s
        """, (bin_number,))
        for p in cur2.fetchall():
            dobnow_permit_info[p['job_filing_number']] = p
        cur2.close()
    except:
        pass

    # Annotate BIS
    today = date.today()
    for j in bis_rows:
        status = (j.get('job_status_descrp') or '').upper()
        has_signoff = bool(j.get('signoff_date')) or 'SIGNED OFF' in status
        is_issued = 'PERMIT ISSUED' in status
        j['no_final_inspection'] = is_issued and not has_signoff
        j['signed_off'] = has_signoff
        # Check for "NO WORK" filings
        job_desc = (j.get('job_description') or '')
        is_no_work = 'NO WORK' in job_desc.upper()
        # Risk tier for BIS jobs
        if is_no_work:
            j['risk_tier'] = 'none'
        elif has_signoff:
            j['risk_tier'] = 'clear'
        elif is_issued and not has_signoff:
            latest = j.get('latest_action_date')
            if latest:
                days_uninspected = (today - latest).days
                if days_uninspected >= 1825:
                    j['risk_tier'] = 'high'
                elif days_uninspected >= 365:
                    j['risk_tier'] = 'warning'
                elif days_uninspected >= 0:
                    j['risk_tier'] = 'low'
                else:
                    j['risk_tier'] = 'none'
            else:
                j['risk_tier'] = 'warning'
        else:
            j['risk_tier'] = 'none'

    # DOB NOW jobs
    dobnow_conds = ["bin = %s"]
    dobnow_params: list = [bin_number]
    if job_type:
        dobnow_conds.append("job_type = %s")
        dobnow_params.append(job_type)

    dobnow_where = " AND ".join(dobnow_conds)
    cur.execute(f"""
        SELECT job_filing_number as job, job_type, filing_status as job_status_descrp,
            NULL as signoff_date, current_status_date as latest_action_date,
            NULL as job_description, NULL as initial_cost, building_type,
            NULL as existing_dwelling_units, NULL as proposed_dwelling_units,
            NULL as owner_first_name, NULL as owner_last_name, NULL as owner_business_name,
            'DOBNOW' as source
        FROM dobnow_jobs
        WHERE {dobnow_where}
        ORDER BY current_status_date DESC NULLS LAST
    """, dobnow_params)
    dobnow_rows = cur.fetchall()
    for j in dobnow_rows:
        # Enrich with dobnow_permits data if available
        pinfo = dobnow_permit_info.get(j.get('job'))
        if pinfo:
            wt = pinfo.get('work_type') or ''
            ps = pinfo.get('permit_status') or ''
            is_high_risk = wt in HIGH_RISK_WORK
            is_signed = ps == 'Signed-off'
            is_expired = bool(pinfo.get('expired_date')) and pinfo['expired_date'] < today
            j['signed_off'] = is_signed
            j['no_final_inspection'] = not is_signed and is_expired
            j['work_type'] = wt
            expired_date = pinfo.get('expired_date')
            if is_signed:
                j['risk_tier'] = 'clear'
            elif is_expired and expired_date:
                days_uninspected = (today - expired_date).days
                if is_high_risk and days_uninspected >= 730:
                    j['risk_tier'] = 'critical'
                elif is_high_risk or days_uninspected >= 1825:
                    j['risk_tier'] = 'high'
                elif days_uninspected >= 365:
                    j['risk_tier'] = 'warning'
                else:
                    j['risk_tier'] = 'low'
            elif not is_signed:
                j['risk_tier'] = 'none'
            else:
                j['risk_tier'] = 'none'
        else:
            j['no_final_inspection'] = False
            j['signed_off'] = False
            j['risk_tier'] = 'none'
            j['work_type'] = None

    cur.close()
    conn.close()

    # Combine and filter
    all_rows = bis_rows + dobnow_rows

    if signed_off:
        val = signed_off.lower() in ("true", "yes", "1")
        all_rows = [r for r in all_rows if r['signed_off'] == val]
    if no_final_inspection and no_final_inspection.lower() in ("true", "yes", "1"):
        all_rows = [r for r in all_rows if r['no_final_inspection']]
    if risk_tier:
        all_rows = [r for r in all_rows if r.get('risk_tier') == risk_tier]

    # Sort
    RISK_ORDER = {'critical': 0, 'high': 1, 'warning': 2, 'low': 3, 'active': 4, 'none': 5, 'clear': 6}
    if sort == "risk":
        def inspect_order(r):
            nfi = r.get('no_final_inspection', False)
            so = r.get('signed_off', False)
            rt = r.get('risk_tier', 'none')
            if nfi and not so: return 0
            if not so and rt in ('active', 'watch'): return 1
            if not so: return 2
            return 3
        all_rows.sort(key=lambda r: (inspect_order(r), RISK_ORDER.get(r.get('risk_tier', 'none'), 3), r.get('latest_action_date') is None, r.get('latest_action_date') or ''), reverse=False)
    else:
        sort_col = sort if sort in ALLOWED_PERMIT_SORT else "latest_action_date"
        reverse = order.lower() != "asc"
        all_rows.sort(key=lambda r: (r.get(sort_col) is None, r.get(sort_col) or ''), reverse=reverse)

    # Apt annotation
    if apt:
        apt_upper = apt.upper()
        for v in all_rows:
            desc = (v.get('job_description') or '').upper()
            v['is_unit_match'] = apt_upper in desc

    total = len(all_rows)
    offset = (page - 1) * per_page
    paged = all_rows[offset:offset + per_page]

    return {"rows": paged, "total": total, "page": page, "per_page": per_page}


###############################################################################
# BISweb Complaint Detail Enrichment (on-demand scraping)
###############################################################################

import threading

@app.get("/api/building/{bin_number}/complaints/enriched")
def get_enriched_complaints(bin_number: str):
    """Return BISweb-scraped complaint details. Returns cached data if fresh,
    otherwise triggers a background scrape and returns status."""
    try:
        import sys
        sys.path.insert(0, 'api')
        sys.path.insert(0, '.')
        from bisweb_scraper import get_cached, scrape_complaints, ensure_table, SCRAPE_STATUS
        ensure_table()
    except ImportError:
        raise HTTPException(status_code=501, detail="BISweb scraper not available")

    # Check cache first
    cached = get_cached(bin_number)
    if cached is not None:
        return {"status": "done", "data": cached, "total": len(cached)}

    # Check if scrape is in progress
    status = SCRAPE_STATUS.get(bin_number)
    if status and status.get("status") == "scraping":
        return {"status": "scraping", "progress": status.get("progress", 0),
                "total": status.get("total", 0), "message": status.get("message", "")}

    # Trigger background scrape
    def bg_scrape():
        try:
            scrape_complaints(bin_number)
        except Exception as e:
            SCRAPE_STATUS[bin_number] = {"status": "error", "message": str(e)}

    thread = threading.Thread(target=bg_scrape, daemon=True)
    thread.start()

    return {"status": "scraping", "progress": 0, "total": 0, "message": "Starting scrape..."}


###############################################################################
# AI Summary Generation
###############################################################################

import os

def gather_building_context(bin_number: str) -> dict:
    """Gather all relevant data for a building to feed into AI summary."""
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    ctx = {}

    # Scores
    cur.execute("SELECT * FROM building_scores WHERE bin = %s", (bin_number,))
    scores = cur.fetchone()
    if not scores:
        conn.close()
        return {}
    ctx['address'] = scores.get('address', 'Unknown')
    ctx['grade'] = scores.get('score_grade')
    ctx['open_class_c'] = scores.get('open_class_c', 0)
    ctx['total_hpd'] = scores.get('total_hpd_violations', 0)
    ctx['total_ecb'] = scores.get('total_ecb_violations', 0)
    ctx['ecb_penalties'] = float(scores.get('ecb_penalties', 0) or 0)
    ctx['co_type'] = scores.get('co_status')
    ctx['tco_expired'] = scores.get('tco_expired')
    ctx['unsigned_jobs'] = scores.get('unsigned_jobs', 0)
    ctx['owner'] = scores.get('owner_name', '')

    # Open HPD by class
    cur.execute("""SELECT class, count(*) as cnt FROM hpd_violations
        WHERE bin = %s AND violationstatus = 'Open' GROUP BY class""", (bin_number,))
    ctx['open_by_class'] = {r['class']: r['cnt'] for r in cur.fetchall()}

    # Top complaint categories
    cur.execute("""SELECT complaint_category, count(*) as cnt FROM dob_complaints
        WHERE bin = %s GROUP BY complaint_category ORDER BY cnt DESC LIMIT 8""", (bin_number,))
    ctx['top_complaints'] = [(r['complaint_category'],
        COMPLAINT_CATEGORIES.get(r['complaint_category'], r['complaint_category']),
        r['cnt']) for r in cur.fetchall()]
    cur.execute("SELECT count(*) FROM dob_complaints WHERE bin = %s", (bin_number,))
    ctx['total_complaints'] = cur.fetchone()['count']

    # BISweb enriched descriptions (most recent)
    try:
        cur.execute("""SELECT description, comments, category_full
            FROM bisweb_complaint_details WHERE bin = %s AND description IS NOT NULL
            ORDER BY complaint_number DESC LIMIT 15""", (bin_number,))
        ctx['complaint_details'] = [dict(r) for r in cur.fetchall()]
    except:
        ctx['complaint_details'] = []

    # Top HPD violation descriptions
    cur.execute("""SELECT novdescription, class, count(*) as cnt FROM hpd_violations
        WHERE bin = %s AND violationstatus = 'Open' AND novdescription IS NOT NULL
        GROUP BY novdescription, class ORDER BY cnt DESC LIMIT 10""", (bin_number,))
    ctx['top_violations'] = [dict(r) for r in cur.fetchall()]

    # Permit risk
    cur.execute("""SELECT work_type, permit_status, expired_date FROM dobnow_permits
        WHERE bin = %s AND permit_status != 'SIGNED OFF' ORDER BY expired_date DESC NULLS LAST LIMIT 10""", (bin_number,))
    ctx['open_permits'] = [dict(r) for r in cur.fetchall()]

    conn.close()
    return ctx


def build_summary_prompt(ctx: dict) -> str:
    """Build a prompt for AI summary generation."""
    lines = [
        "Write a concise, factual building safety summary for NYC tenants. Use plain language.",
        "Focus on what matters to someone living there or considering moving in.",
        "Reference specific numbers and violation types. Do not editorialize or use alarming language — just state the facts clearly.",
        "Keep it to 3-4 short paragraphs. Use Inter font style — clean, readable.",
        "",
        f"Building: {ctx.get('address', 'Unknown')}",
        f"Safety Grade: {ctx.get('grade', 'N/A')}",
        f"Owner: {ctx.get('owner', 'Unknown')}",
        f"Certificate of Occupancy: {ctx.get('co_type', 'Unknown')}, Expired: {ctx.get('tco_expired', False)}",
        f"Open Class C (immediately hazardous) violations: {ctx.get('open_class_c', 0)}",
        f"Open Class B violations: {ctx.get('open_by_class', {}).get('B', 0)}",
        f"Open Class A violations: {ctx.get('open_by_class', {}).get('A', 0)}",
        f"Total HPD violations: {ctx.get('total_hpd', 0)}",
        f"Total ECB violations: {ctx.get('total_ecb', 0)}, Penalties: ${ctx.get('ecb_penalties', 0):,.0f}",
        f"Total DOB complaints: {ctx.get('total_complaints', 0)}",
        f"Unsigned major jobs: {ctx.get('unsigned_jobs', 0)}",
    ]

    if ctx.get('top_complaints'):
        lines.append("\nTop complaint categories:")
        for code, desc, cnt in ctx['top_complaints']:
            lines.append(f"  {code} {desc}: {cnt}")

    if ctx.get('top_violations'):
        lines.append("\nTop open HPD violations:")
        for v in ctx['top_violations']:
            lines.append(f"  Class {v['class']}: {v['novdescription'][:120]} (×{v['cnt']})")

    if ctx.get('complaint_details'):
        lines.append("\nRecent complaint descriptions (from BISweb):")
        for d in ctx['complaint_details'][:8]:
            if d.get('description'):
                lines.append(f"  - {d['description'][:200]}")
            if d.get('comments'):
                lines.append(f"    Inspector: {d['comments'][:150]}")

    return "\n".join(lines)


@app.post("/api/building/{bin_number}/generate-summary")
def generate_summary(bin_number: str):
    """Generate an AI summary for a building. Uses Anthropic API if key is set,
    otherwise returns the prompt for manual generation."""
    ctx = gather_building_context(bin_number)
    if not ctx:
        raise HTTPException(status_code=404, detail="Building not found")

    prompt = build_summary_prompt(ctx)
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")

    if api_key:
        import requests as req
        resp = req.post("https://api.anthropic.com/v1/messages", headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }, json={
            "model": "claude-3-5-haiku-latest",
            "max_tokens": 1024,
            "messages": [{"role": "user", "content": prompt}],
        }, timeout=30)

        if resp.status_code == 200:
            data = resp.json()
            summary = data["content"][0]["text"]
        else:
            raise HTTPException(status_code=502, detail=f"Anthropic API error: {resp.status_code}")
    else:
        # No API key — generate a template-based summary
        summary = _template_summary(ctx)

    # Save to DB
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE building_scores SET ai_summary = %s, ai_summary_updated = NOW() WHERE bin = %s",
                (summary, bin_number))
    conn.commit()
    conn.close()

    return {"summary": summary, "generated_at": date.today().isoformat()}


def _template_summary(ctx: dict) -> str:
    """Generate a template-based summary when no AI API key is available."""
    parts = []
    addr = ctx.get('address', 'This building')
    grade = ctx.get('grade', '?')
    owner = ctx.get('owner', 'Unknown')
    open_c = ctx.get('open_class_c', 0)
    open_b = ctx.get('open_by_class', {}).get('B', 0)
    total_hpd = ctx.get('total_hpd', 0)
    total_ecb = ctx.get('total_ecb', 0)
    penalties = ctx.get('ecb_penalties', 0)
    tco_expired = ctx.get('tco_expired', False)
    co_type = ctx.get('co_type', '')
    total_complaints = ctx.get('total_complaints', 0)

    # Paragraph 1: Overview
    p1 = f"{addr} is rated Grade {grade}"
    if owner:
        p1 += f", owned by {owner}"
    p1 += "."
    if tco_expired:
        p1 += f" The building has been operating under an expired Temporary Certificate of Occupancy, in potential violation of MDL §301(4)."
    elif co_type == 'TCO':
        p1 += " The building is currently operating under a Temporary Certificate of Occupancy."
    parts.append(p1)

    # Paragraph 2: Violations
    if open_c > 0 or open_b > 0:
        p2 = f"There are currently {open_c} open Class C (immediately hazardous) violations"
        if open_b > 0:
            p2 += f" and {open_b} open Class B (hazardous) violations"
        p2 += f", out of {total_hpd} total HPD violations on record."
        if total_ecb > 0:
            p2 += f" The building also has {total_ecb} ECB violations with ${penalties:,.0f} in penalties."
        parts.append(p2)

    # Paragraph 3: Complaints
    if total_complaints > 0:
        top = ctx.get('top_complaints', [])
        p3 = f"DOB has received {total_complaints} complaints about this building."
        if top:
            top_items = [f"{desc.lower()} ({cnt})" for _, desc, cnt in top[:3]]
            p3 += f" The most common issues include {', '.join(top_items)}."
        parts.append(p3)

    # Paragraph 4: Details from BISweb
    details = ctx.get('complaint_details', [])
    if details:
        descs = [d['description'][:150] for d in details[:3] if d.get('description')]
        if descs:
            p4 = "Recent complaints describe: " + "; ".join(f'"{d}"' for d in descs) + "."
            parts.append(p4)

    return "\n\n".join(parts)


@app.get("/api/building/{bin_number}/percentiles")
def building_percentiles(bin_number: str):
    """Return percentile rankings for key building metrics."""
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        cur.execute("SELECT open_class_c, total_hpd_violations, ecb_penalties FROM building_scores WHERE bin = %s", (bin_number,))
        row = cur.fetchone()
        if not row:
            return {"percentiles": {}}

        cur.execute("SELECT COUNT(*) as count FROM building_scores WHERE open_class_c IS NOT NULL")
        total = cur.fetchone()['count']
        if total == 0:
            return {"percentiles": {}}

        results = {}
        field_map = {
            "class_c": "open_class_c",
            "hpd_total": "total_hpd_violations",
            "ecb_penalties": "ecb_penalties",
        }
        for key, col in field_map.items():
            value = row.get(col)
            if value is not None and value > 0:
                cur.execute(f"SELECT COUNT(*) as count FROM building_scores WHERE {col} <= %s AND {col} IS NOT NULL", (value,))
                count = cur.fetchone()['count']
                results[key] = round(count / total * 100)

        # Complaints percentile (compared against ALL buildings, not just those with complaints)
        cur.execute("SELECT COUNT(*) as count FROM dob_complaints WHERE bin = %s", (bin_number,))
        complaint_count = cur.fetchone()['count']
        if complaint_count > 0:
            cur.execute("""
                WITH bldg_complaints AS (
                    SELECT bin, COUNT(*) as cnt FROM dob_complaints GROUP BY bin
                )
                SELECT COUNT(*) as count FROM bldg_complaints WHERE cnt <= %s
            """, (complaint_count,))
            below = cur.fetchone()['count']
            # Add buildings with 0 complaints (in building_scores but not in dob_complaints)
            cur.execute("SELECT COUNT(*) as count FROM building_scores")
            total_buildings = cur.fetchone()['count']
            cur.execute("SELECT COUNT(DISTINCT bin) as count FROM dob_complaints")
            buildings_with_complaints = cur.fetchone()['count']
            zero_complaint_buildings = total_buildings - buildings_with_complaints
            # All zero-complaint buildings are "below" any building with complaints
            total_below = below + zero_complaint_buildings
            if total_buildings > 0:
                results["complaints"] = round(total_below / total_buildings * 100)

        # Average age of open violations by class (for this building + city-wide)
        cur.execute("""
            SELECT class, COUNT(*) as count,
                   ROUND(AVG(CURRENT_DATE - novissueddate::date)) as avg_days_open
            FROM hpd_violations
            WHERE bin = %s AND violationstatus = 'Open' AND novissueddate IS NOT NULL
            GROUP BY class ORDER BY class
        """, (bin_number,))
        building_ages = {r['class']: {"count": r['count'], "avg_days": int(r['avg_days_open'] or 0)} for r in cur.fetchall()}

        cur.execute("""
            SELECT class, ROUND(AVG(CURRENT_DATE - novissueddate::date)) as avg_days_open
            FROM hpd_violations
            WHERE violationstatus = 'Open' AND novissueddate IS NOT NULL AND class IN ('A','B','C')
            GROUP BY class ORDER BY class
        """)
        city_ages = {r['class']: int(r['avg_days_open'] or 0) for r in cur.fetchall()}

        return {
            "percentiles": results,
            "open_violation_ages": building_ages,
            "city_avg_violation_ages": city_ages,
        }
    finally:
        cur.close()
        conn.close()


###############################################################################
# ML Predictions — Complaint Resolution Time
###############################################################################

import json
import joblib
import datetime

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models')
try:
    resolution_model = joblib.load(os.path.join(MODELS_DIR, 'complaint_resolution_model.joblib'))
    _encoders = joblib.load(os.path.join(MODELS_DIR, 'complaint_resolution_encoders.joblib'))
    _le_category = _encoders['le_category']
    _le_borough = _encoders['le_borough']
    _city_avg_by_cat = _encoders['city_avg_by_category']
    _overall_city_avg = _encoders['overall_city_avg']
    ML_AVAILABLE = True
except Exception:
    ML_AVAILABLE = False


@app.get("/api/building/{bin_number}/predictions")
def building_predictions(bin_number: str):
    if not ML_AVAILABLE:
        return {"predictions": None, "error": "Model not available"}

    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        cur.execute("SELECT borough, open_class_c, total_hpd_violations, ecb_penalties, owner_name FROM building_scores WHERE bin = %s", (bin_number,))
        building = cur.fetchone()
        if not building:
            raise HTTPException(status_code=404, detail="Building not found")

        owner_hash = hash(building['owner_name'] or '') % 10000

        # Top complaint categories for this building
        cur.execute("""
            SELECT complaint_category, COUNT(*) as cnt,
                   COUNT(*) FILTER (WHERE disposition_date IS NOT NULL AND disposition_date != ''
                       AND date_entered IS NOT NULL AND date_entered != '') as resolved_cnt
            FROM dob_complaints WHERE bin = %s
            GROUP BY complaint_category
            ORDER BY cnt DESC
        """, (bin_number,))
        categories = cur.fetchall()

        # Historical avg per category for this building
        cur.execute("""
            SELECT complaint_category,
                   ROUND(AVG(TO_DATE(disposition_date, 'MM/DD/YYYY') - TO_DATE(date_entered, 'MM/DD/YYYY'))) as avg_days,
                   COUNT(*) as cnt
            FROM dob_complaints
            WHERE bin = %s AND disposition_date IS NOT NULL AND date_entered IS NOT NULL
              AND disposition_date != '' AND date_entered != ''
              AND (TO_DATE(disposition_date, 'MM/DD/YYYY') - TO_DATE(date_entered, 'MM/DD/YYYY')) > 0
              AND (TO_DATE(disposition_date, 'MM/DD/YYYY') - TO_DATE(date_entered, 'MM/DD/YYYY')) <= 1825
            GROUP BY complaint_category
        """, (bin_number,))
        hist_map = {r['complaint_category']: r for r in cur.fetchall()}

        borough = str(building['borough'] or '')
        if borough in _le_borough.classes_:
            bor_enc = _le_borough.transform([borough])[0]
        else:
            bor_enc = 0

        predictions = []
        predicted_days_list = []
        for cat_row in categories:
            cat = str(cat_row['complaint_category'])
            total_cnt = cat_row['cnt']

            if cat in _le_category.classes_:
                cat_enc = _le_category.transform([cat])[0]
            else:
                cat_enc = 0

            features = [[
                cat_enc, bor_enc,
                building['open_class_c'] or 0,
                building['total_hpd_violations'] or 0,
                float(building['ecb_penalties'] or 0),
                owner_hash,
            ]]

            predicted_days = max(1, round(resolution_model.predict(features)[0]))
            predicted_days_list.append(predicted_days)

            hist = hist_map.get(cat)
            historical_avg = int(hist['avg_days']) if hist and hist['avg_days'] else None
            hist_cnt = int(hist['cnt']) if hist else 0

            if hist_cnt >= 50:
                confidence = "high"
            elif hist_cnt >= 10:
                confidence = "medium"
            else:
                confidence = "low"

            city_avg = round(_city_avg_by_cat.get(cat, _overall_city_avg))

            predictions.append({
                'category': cat,
                'category_name': COMPLAINT_CATEGORIES.get(cat, cat),
                'predicted_days': predicted_days,
                'historical_avg_days': historical_avg,
                'city_avg_days': city_avg,
                'confidence': confidence,
                'complaint_count': total_cnt,
            })

        building_avg_predicted = round(sum(predicted_days_list) / len(predicted_days_list)) if predicted_days_list else None

        return {
            "predictions": predictions,
            "building_avg_predicted": building_avg_predicted,
            "city_avg": round(_overall_city_avg),
        }
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
