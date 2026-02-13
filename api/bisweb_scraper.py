#!/usr/bin/env python3
"""On-demand BISweb complaint detail scraper.
Connects to the OpenClaw-managed browser via CDP to bypass Akamai bot detection.
Each detail page is opened in a fresh tab to avoid navigation stalls."""

import re
import time
import psycopg2
import psycopg2.extras
from datetime import datetime
from typing import Optional

DB = "dbname=nyc_buildings"
BISWEB = "https://a810-bisweb.nyc.gov/bisweb"
CDP_URL = "http://127.0.0.1:18800"

CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS bisweb_complaint_details (
    complaint_number TEXT PRIMARY KEY,
    bin TEXT NOT NULL,
    description TEXT,
    category_code TEXT,
    category_full TEXT,
    category_subcategory TEXT,
    priority TEXT,
    assigned_to TEXT,
    ref_311 TEXT,
    owner TEXT,
    last_inspection_date TEXT,
    last_inspection_badge TEXT,
    disposition_date TEXT,
    disposition_code TEXT,
    disposition_text TEXT,
    comments TEXT,
    scraped_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bisweb_complaints_bin ON bisweb_complaint_details(bin);
"""

SCRAPE_STATUS = {}


def ensure_table():
    conn = psycopg2.connect(DB)
    conn.cursor().execute(CREATE_TABLE)
    conn.commit()
    conn.close()


def get_cached(bin_number: str) -> Optional[list]:
    """Return cached details if fresh (< 7 days)."""
    conn = psycopg2.connect(DB)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT MAX(scraped_at) FROM bisweb_complaint_details WHERE bin = %s", (bin_number,))
    row = cur.fetchone()
    if row and row['max']:
        age = (datetime.now() - row['max']).total_seconds() / 86400
        if age < 7:
            cur.execute("""
                SELECT complaint_number, description, category_code, category_full,
                       category_subcategory, priority, assigned_to, ref_311, owner,
                       last_inspection_date, last_inspection_badge,
                       disposition_date, disposition_code, disposition_text, comments
                FROM bisweb_complaint_details WHERE bin = %s
                ORDER BY complaint_number DESC
            """, (bin_number,))
            rows = cur.fetchall()
            conn.close()
            return rows
    conn.close()
    return None


def _clean(text):
    """Strip HTML, &nbsp;, normalize whitespace."""
    if not text:
        return None
    text = re.sub(r'<[^>]+>', '', text)
    text = text.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&#39;', "'")
    text = re.sub(r'\s+', ' ', text).strip()
    return text if text else None


def scrape_complaints(bin_number: str) -> list:
    """Scrape all complaint details from BISweb via CDP."""
    from playwright.sync_api import sync_playwright

    ensure_table()
    SCRAPE_STATUS[bin_number] = {"status": "scraping", "progress": 0, "total": 0, "message": "Connecting..."}
    results = []

    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0]

        try:
            # Step 1: Collect all complaint detail keys from all pages
            detail_keys = []
            page = ctx.new_page()
            page.goto(f"{BISWEB}/ComplaintsByAddressServlet?allbin={bin_number}&requestid=0",
                      wait_until="domcontentloaded", timeout=30000)
            time.sleep(2)

            page_num = 0
            while True:
                page_num += 1
                html = page.content()
                if 'Access Denied' in html:
                    print("Blocked on list page", flush=True)
                    break

                links = re.findall(r'vlcompdetlkey=(\d+)', html)
                nums = re.findall(r'>(\d{7})</a>', html)
                for num, key in zip(nums, links):
                    detail_keys.append((num, key))
                print(f"  Page {page_num}: {len(nums)} complaints (total: {len(detail_keys)})", flush=True)

                # Pagination — Next is input[type=image] inside form[name=frmnext]
                has_next = page.evaluate('!!document.querySelector("form[name=frmnext]")')
                if has_next:
                    try:
                        with page.expect_navigation(wait_until="domcontentloaded", timeout=15000):
                            page.evaluate('document.querySelector("form[name=frmnext]").submit()')
                        time.sleep(1)
                    except Exception as e:
                        print(f"  Pagination error: {e}", flush=True)
                        break
                else:
                    break

            page.close()
            total = len(detail_keys)
            SCRAPE_STATUS[bin_number] = {"status": "scraping", "progress": 0, "total": total,
                                         "message": f"Scraping {total} complaints..."}
            print(f"Found {total} complaints for BIN {bin_number}", flush=True)

            # Step 2: Scrape each detail — new tab per request, rate limited
            consecutive_errors = 0
            for i, (cnum, key) in enumerate(detail_keys):
                dp = ctx.new_page()
                try:
                    dp.goto(f"{BISWEB}/OverviewForComplaintServlet?requestid=1&vlcompdetlkey={key}",
                            wait_until="domcontentloaded", timeout=20000)
                    time.sleep(0.5)
                    html = dp.content()
                    if 'Access Denied' in html:
                        print(f"  Blocked at {i+1}/{total}, backing off 30s...", flush=True)
                        dp.close()
                        time.sleep(30)
                        consecutive_errors += 1
                        if consecutive_errors > 5:
                            print("  Too many blocks, stopping", flush=True)
                            break
                        continue
                    detail = parse_complaint_detail(html, cnum, bin_number)
                    results.append(detail)
                    consecutive_errors = 0
                except Exception as e:
                    print(f"  Error {cnum}: {e}", flush=True)
                    results.append({'complaint_number': cnum, 'bin': bin_number})
                    consecutive_errors += 1
                    if consecutive_errors > 10:
                        print("  Too many consecutive errors, backing off 60s...", flush=True)
                        time.sleep(60)
                        consecutive_errors = 0
                finally:
                    try:
                        dp.close()
                    except:
                        pass

                # Rate limit: 2s between requests
                time.sleep(2)

                SCRAPE_STATUS[bin_number]["progress"] = i + 1
                if (i + 1) % 25 == 0:
                    print(f"  Scraped {i+1}/{total}", flush=True)
                    save_results(results, bin_number)

        finally:
            pass

    save_results(results, bin_number)
    SCRAPE_STATUS[bin_number] = {"status": "done", "progress": len(results), "total": len(results), "message": "Complete"}
    print(f"Done: {len(results)} complaint details for BIN {bin_number}", flush=True)
    return results


def parse_complaint_detail(html: str, complaint_num: str, bin_number: str) -> dict:
    """Parse a BISweb complaint detail page HTML."""
    r = {'complaint_number': complaint_num, 'bin': bin_number}

    # "Re:" description
    m = re.search(r'Re:(.*?)(?:</td|</font|</TR|</tr)', html, re.DOTALL | re.IGNORECASE)
    if m:
        desc = _clean(m.group(1))
        if desc and len(desc) > 2:
            r['description'] = desc

    # Category code + full text: "7J WORK WITHOUT A PERMIT..."
    m = re.search(r'Category Code:.*?<td[^>]*>(.*?)</td>', html, re.DOTALL)
    if m:
        cat = _clean(m.group(1))
        if cat:
            parts = cat.split(None, 1)
            r['category_code'] = parts[0]
            if len(parts) > 1:
                r['category_full'] = parts[1]

    # Subcategory — row after category, e.g. "WORK WITHOUT A PERMIT : DEMOLITION"
    m = re.search(r'Category Code:.*?</tr>\s*<tr[^>]*>.*?<td[^>]*>(.*?)</td>', html, re.DOTALL)
    if m:
        sub = _clean(m.group(1))
        if sub and len(sub) > 5 and sub != r.get('category_full'):
            r['category_subcategory'] = sub

    # Priority
    m = re.search(r'Priority:\s*(\w)', html)
    if m:
        r['priority'] = m.group(1)

    # Assigned To
    m = re.search(r'Assigned\s*To:.*?<td[^>]*>(.*?)</td>', html, re.DOTALL)
    if m:
        r['assigned_to'] = _clean(m.group(1))

    # 311 Reference
    m = re.search(r'311 Reference Number:\s*([\d-]+)', html)
    if m:
        r['ref_311'] = m.group(1)

    # Owner
    m = re.search(r'Owner:.*?<td[^>]*>(.*?)</td>', html, re.DOTALL)
    if m:
        r['owner'] = _clean(m.group(1))

    # Last Inspection + badge
    m = re.search(r'Last Inspection:.*?(\d{2}/\d{2}/\d{4}).*?BADGE\s*#?\s*(\d+)', html, re.DOTALL)
    if m:
        r['last_inspection_date'] = m.group(1)
        r['last_inspection_badge'] = m.group(2)
    else:
        m = re.search(r'Last Inspection:.*?(\d{2}/\d{2}/\d{4})', html, re.DOTALL)
        if m:
            r['last_inspection_date'] = m.group(1)

    # Disposition — "02/03/2026 - I2 - NO VIOLATION WARRANTED..."
    m = re.search(r'Disposition:.*?<td[^>]*>(.*?)</td>', html, re.DOTALL)
    if m:
        disp = _clean(m.group(1))
        if disp:
            dm = re.match(r'(\d{2}/\d{2}/\d{4})\s*-\s*(\w+)\s*-\s*(.*)', disp)
            if dm:
                r['disposition_date'] = dm.group(1)
                r['disposition_code'] = dm.group(2)
                r['disposition_text'] = dm.group(3).strip()

    # Comments — area between "Comments:" and "Complaint Disposition History"
    m = re.search(r'Comments:(.*?)Complaint Disposition', html, re.DOTALL | re.IGNORECASE)
    if m:
        # Get all text content from this region
        txt = _clean(m.group(1))
        if txt and len(txt) > 5:
            r['comments'] = txt

    return r


def save_results(results: list, bin_number: str):
    """Save/upsert results to Postgres."""
    if not results:
        return
    conn = psycopg2.connect(DB)
    cur = conn.cursor()
    for row in results:
        cur.execute("""
            INSERT INTO bisweb_complaint_details 
            (complaint_number, bin, description, category_code, category_full, category_subcategory,
             priority, assigned_to, ref_311, owner, last_inspection_date, last_inspection_badge,
             disposition_date, disposition_code, disposition_text, comments)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (complaint_number) DO UPDATE SET
                description=EXCLUDED.description, category_full=EXCLUDED.category_full,
                category_subcategory=EXCLUDED.category_subcategory,
                priority=EXCLUDED.priority, assigned_to=EXCLUDED.assigned_to,
                ref_311=EXCLUDED.ref_311, owner=EXCLUDED.owner,
                last_inspection_date=EXCLUDED.last_inspection_date,
                last_inspection_badge=EXCLUDED.last_inspection_badge,
                disposition_date=EXCLUDED.disposition_date, disposition_code=EXCLUDED.disposition_code,
                disposition_text=EXCLUDED.disposition_text, comments=EXCLUDED.comments,
                scraped_at=NOW()
        """, (
            row.get('complaint_number'), row.get('bin'), row.get('description'),
            row.get('category_code'), row.get('category_full'), row.get('category_subcategory'),
            row.get('priority'), row.get('assigned_to'), row.get('ref_311'), row.get('owner'),
            row.get('last_inspection_date'), row.get('last_inspection_badge'),
            row.get('disposition_date'), row.get('disposition_code'), row.get('disposition_text'),
            row.get('comments'),
        ))
    conn.commit()
    conn.close()


if __name__ == "__main__":
    import sys
    ensure_table()
    bin_num = sys.argv[1] if len(sys.argv) > 1 else "1033611"
    print(f"Scraping BIN {bin_num}...")
    results = scrape_complaints(bin_num)
    for row in results[:5]:
        print(f"\n--- {row.get('complaint_number')} ---")
        for k, v in row.items():
            if v and k != 'bin':
                print(f"  {k}: {str(v)[:120]}")
