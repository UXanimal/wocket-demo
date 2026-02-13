#!/usr/bin/env python3
"""
Create demo database with curated subset of NYC buildings data.
Run this after setting up your Supabase database.
"""

import psycopg2
import psycopg2.extras
import os

# You'll need to set this environment variable with your Supabase connection string
DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    print("ERROR: Please set DATABASE_URL environment variable")
    print("Example: export DATABASE_URL='postgresql://user:pass@host:port/dbname'")
    exit(1)

# Use the connection string directly for psycopg2 
# (Python 3.14 has issues with urlparse on some hostnames)
DB_CONFIG = DATABASE_URL

def create_tables():
    """Create all necessary tables."""
    
    conn = psycopg2.connect(DB_CONFIG)
    cur = conn.cursor()
    
    # Building scores (main table)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS building_scores (
            bin TEXT PRIMARY KEY,
            address TEXT,
            aliases TEXT,
            borough TEXT,
            zip TEXT,
            block TEXT,
            lot TEXT,
            score_grade TEXT,
            open_class_c INTEGER DEFAULT 0,
            open_class_b INTEGER DEFAULT 0,
            open_class_a INTEGER DEFAULT 0,
            total_hpd_violations INTEGER DEFAULT 0,
            total_ecb_violations INTEGER DEFAULT 0,
            ecb_penalties NUMERIC DEFAULT 0,
            co_status TEXT,
            tco_expired BOOLEAN DEFAULT FALSE,
            latest_tco_date TEXT,
            unsigned_jobs INTEGER DEFAULT 0,
            owner_name TEXT,
            latitude NUMERIC,
            longitude NUMERIC,
            ai_summary TEXT,
            ai_summary_updated TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_building_scores_borough ON building_scores(borough);
        CREATE INDEX IF NOT EXISTS idx_building_scores_grade ON building_scores(score_grade);
        CREATE INDEX IF NOT EXISTS idx_building_scores_owner ON building_scores(owner_name);
        CREATE INDEX IF NOT EXISTS idx_building_scores_address ON building_scores USING gin(to_tsvector('english', address));
    """)
    
    # HPD violations
    cur.execute("""
        CREATE TABLE IF NOT EXISTS hpd_violations (
            violationid TEXT PRIMARY KEY,
            bin TEXT,
            class TEXT,
            apartment TEXT,
            story TEXT,
            inspectiondate TEXT,
            novissueddate TEXT,
            violationstatus TEXT,
            currentstatus TEXT,
            novtype TEXT,
            novdescription TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_hpd_violations_bin ON hpd_violations(bin);
        CREATE INDEX IF NOT EXISTS idx_hpd_violations_status ON hpd_violations(violationstatus);
        CREATE INDEX IF NOT EXISTS idx_hpd_violations_class ON hpd_violations(class);
    """)
    
    # ECB violations
    cur.execute("""
        CREATE TABLE IF NOT EXISTS ecb_violations (
            ecb_violation_number TEXT PRIMARY KEY,
            bin TEXT,
            issue_date TEXT,
            violation_description TEXT,
            penality_imposed NUMERIC,
            ecb_violation_status TEXT,
            severity TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_ecb_violations_bin ON ecb_violations(bin);
    """)
    
    # DOB complaints
    cur.execute("""
        CREATE TABLE IF NOT EXISTS dob_complaints (
            complaint_number TEXT PRIMARY KEY,
            bin TEXT,
            status TEXT,
            date_entered TEXT,
            complaint_category TEXT,
            unit TEXT,
            disposition_date TEXT,
            disposition_code TEXT,
            inspection_date TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_dob_complaints_bin ON dob_complaints(bin);
    """)
    
    # HPD litigations
    cur.execute("""
        CREATE TABLE IF NOT EXISTS hpd_litigations (
            litigationid TEXT PRIMARY KEY,
            bin TEXT,
            casetype TEXT,
            caseopendate TEXT,
            casestatus TEXT,
            casejudgement TEXT,
            respondent TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_hpd_litigations_bin ON hpd_litigations(bin);
    """)
    
    # BIS job filings
    cur.execute("""
        CREATE TABLE IF NOT EXISTS bis_job_filings (
            job TEXT,
            bin TEXT,
            job_type TEXT,
            job_status_descrp TEXT,
            signoff_date TEXT,
            latest_action_date TEXT,
            job_description TEXT,
            initial_cost TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_bis_jobs_bin ON bis_job_filings(bin);
    """)
    
    # HPD contacts
    cur.execute("""
        CREATE TABLE IF NOT EXISTS hpd_contacts (
            registrationid TEXT,
            type TEXT,
            contactdescription TEXT,
            corporationname TEXT,
            firstname TEXT,
            lastname TEXT,
            businesshousenumber TEXT,
            businessstreetname TEXT,
            businesscity TEXT,
            businessstate TEXT,
            businesszip TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_hpd_contacts_reg ON hpd_contacts(registrationid);
    """)
    
    # HPD registrations
    cur.execute("""
        CREATE TABLE IF NOT EXISTS hpd_registrations (
            registrationid TEXT PRIMARY KEY,
            bin TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_hpd_registrations_bin ON hpd_registrations(bin);
    """)
    
    conn.commit()
    cur.close()
    conn.close()
    print("✓ Tables created successfully")

def load_demo_data():
    """Load curated demo data from the main database."""
    
    # Connect to both databases
    main_conn = psycopg2.connect("dbname=nyc_buildings")
    demo_conn = psycopg2.connect(DB_CONFIG)
    
    main_cur = main_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    demo_cur = demo_conn.cursor()
    
    print("Loading demo data...")
    
    # Get interesting buildings: Grade F, high violations, expired TCOs, famous addresses
    main_cur.execute("""
        SELECT * FROM building_scores 
        WHERE (score_grade = 'F' AND (open_class_c > 10 OR tco_expired = true))
           OR (score_grade IN ('D','E') AND open_class_c > 20)
           OR (ecb_penalties > 50000)
           OR (address ILIKE '%432 EAST 116%')
           OR (address ILIKE '%251 WEST 92%')
           OR (address ILIKE '%TRUMP%')
           OR (address ILIKE '%BROADWAY%' AND borough = 'MANHATTAN' AND score_grade = 'F')
        ORDER BY 
            CASE WHEN address ILIKE '%251 WEST 92%' THEN 0 ELSE 1 END,
            open_class_c DESC, ecb_penalties DESC
        LIMIT 500
    """)
    
    buildings = main_cur.fetchall()
    print(f"Selected {len(buildings)} demo buildings")
    
    # Insert buildings with explicit column mapping
    for building in buildings:
        demo_cur.execute("""
            INSERT INTO building_scores (
                bin, address, aliases, borough, zip, block, lot, score_grade,
                open_class_c, open_class_b, open_class_a, total_hpd_violations,
                total_ecb_violations, ecb_penalties, co_status, tco_expired,
                latest_tco_date, unsigned_jobs, owner_name, latitude, longitude,
                ai_summary, ai_summary_updated
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (bin) DO NOTHING
        """, (
            building['bin'], building['address'], building.get('aliases'), 
            building['borough'], building['zip'], building['block'], building['lot'],
            building['score_grade'], building.get('open_class_c', 0), 
            building.get('open_class_b', 0), building.get('open_class_a', 0),
            building.get('total_hpd_violations', 0), building.get('total_ecb_violations', 0),
            building.get('ecb_penalties', 0), building.get('co_status'),
            building.get('tco_expired', False), building.get('latest_tco_date'),
            building.get('unsigned_jobs', 0), building.get('owner_name'),
            building.get('latitude'), building.get('longitude'),
            building.get('ai_summary'), building.get('ai_summary_updated')
        ))
    
    demo_conn.commit()
    
    # Get BINs for related data
    demo_bins = [b['bin'] for b in buildings]
    bins_str = "','".join(demo_bins)
    
    # Load violations for these buildings
    print("Loading violations...")
    main_cur.execute(f"""
        SELECT * FROM hpd_violations 
        WHERE bin IN ('{bins_str}') AND violationstatus = 'Open'
        ORDER BY 
            CASE class WHEN 'C' THEN 0 WHEN 'B' THEN 1 ELSE 2 END,
            inspectiondate DESC
        LIMIT 1000
    """)
    
    for row in main_cur.fetchall():
        demo_cur.execute("""
            INSERT INTO hpd_violations (violationid, bin, class, apartment, story, 
                                      inspectiondate, novissueddate, violationstatus, 
                                      currentstatus, novtype, novdescription)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (violationid) DO NOTHING
        """, (row['violationid'], row['bin'], row['class'], row.get('apartment'),
              row.get('story'), row.get('inspectiondate'), row.get('novissueddate'),
              row.get('violationstatus'), row.get('currentstatus'), 
              row.get('novtype'), row.get('novdescription')))
    
    # Load ECB violations
    print("Loading ECB violations...")
    main_cur.execute(f"""
        SELECT * FROM ecb_violations 
        WHERE bin IN ('{bins_str}')
        ORDER BY issue_date DESC
        LIMIT 500
    """)
    
    for row in main_cur.fetchall():
        demo_cur.execute("""
            INSERT INTO ecb_violations (ecb_violation_number, bin, issue_date, 
                                      violation_description, penality_imposed, 
                                      ecb_violation_status, severity)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (ecb_violation_number) DO NOTHING
        """, (row['ecb_violation_number'], row['bin'], row.get('issue_date'),
              row.get('violation_description'), row.get('penality_imposed'),
              row.get('ecb_violation_status'), row.get('severity')))
    
    # Load complaints
    print("Loading complaints...")
    main_cur.execute(f"""
        SELECT * FROM dob_complaints 
        WHERE bin IN ('{bins_str}')
        ORDER BY date_entered DESC
        LIMIT 1000
    """)
    
    for row in main_cur.fetchall():
        demo_cur.execute("""
            INSERT INTO dob_complaints (complaint_number, bin, status, date_entered,
                                       complaint_category, unit, disposition_date,
                                       disposition_code, inspection_date)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (complaint_number) DO NOTHING
        """, (row['complaint_number'], row['bin'], row.get('status'),
              row.get('date_entered'), row.get('complaint_category'),
              row.get('unit'), row.get('disposition_date'),
              row.get('disposition_code'), row.get('inspection_date')))
    
    # Load litigations
    print("Loading litigations...")
    main_cur.execute(f"""
        SELECT * FROM hpd_litigations 
        WHERE bin IN ('{bins_str}')
        ORDER BY caseopendate DESC
        LIMIT 1000
    """)
    
    for row in main_cur.fetchall():
        demo_cur.execute("""
            INSERT INTO hpd_litigations (litigationid, bin, casetype, caseopendate,
                                       casestatus, casejudgement, respondent)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (litigationid) DO NOTHING
        """, (row['litigationid'], row['bin'], row.get('casetype'),
              row.get('caseopendate'), row.get('casestatus'),
              row.get('casejudgement'), row.get('respondent')))
    
    # Load BIS jobs
    print("Loading permits...")
    main_cur.execute(f"""
        SELECT DISTINCT ON (job) job, bin, job_type, job_status_descrp, signoff_date, 
               latest_action_date, job_description, initial_cost
        FROM bis_job_filings 
        WHERE bin IN ('{bins_str}')
        ORDER BY job, latest_action_date DESC
        LIMIT 500
    """)
    
    for row in main_cur.fetchall():
        demo_cur.execute("""
            INSERT INTO bis_job_filings (job, bin, job_type, job_status_descrp,
                                        signoff_date, latest_action_date,
                                        job_description, initial_cost)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        """, (row['job'], row['bin'], row.get('job_type'),
              row.get('job_status_descrp'), row.get('signoff_date'),
              row.get('latest_action_date'), row.get('job_description'),
              row.get('initial_cost')))
    
    # Load contacts
    print("Loading ownership contacts...")
    main_cur.execute(f"""
        SELECT c.* FROM hpd_contacts c
        JOIN hpd_registrations r ON c.registrationid = r.registrationid
        WHERE r.bin IN ('{bins_str}')
        LIMIT 500
    """)
    
    for row in main_cur.fetchall():
        demo_cur.execute("""
            INSERT INTO hpd_contacts (registrationid, type, contactdescription,
                                     corporationname, firstname, lastname,
                                     businesshousenumber, businessstreetname,
                                     businesscity, businessstate, businesszip)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (row['registrationid'], row.get('type'), row.get('contactdescription'),
              row.get('corporationname'), row.get('firstname'), row.get('lastname'),
              row.get('businesshousenumber'), row.get('businessstreetname'),
              row.get('businesscity'), row.get('businessstate'), row.get('businesszip')))
    
    # Load registrations
    main_cur.execute(f"""
        SELECT * FROM hpd_registrations WHERE bin IN ('{bins_str}')
    """)
    
    for row in main_cur.fetchall():
        demo_cur.execute("""
            INSERT INTO hpd_registrations (registrationid, bin)
            VALUES (%s,%s)
            ON CONFLICT (registrationid) DO NOTHING
        """, (row['registrationid'], row['bin']))
    
    demo_conn.commit()
    
    main_cur.close()
    main_conn.close()
    demo_cur.close()
    demo_conn.close()
    
    print("✓ Demo data loaded successfully!")
    print("Buildings included:")
    print("- 251 W 92nd St (Eisenstein - our test case)")
    print("- 432 E 116th St (high violations)")
    print("- Grade F buildings with 10+ Class C violations")
    print("- Buildings with expired TCOs")
    print("- High ECB penalty buildings")
    print("- Select Trump properties")
    print("- Broadway properties with issues")

if __name__ == "__main__":
    print("🚀 Setting up Wocket demo database...")
    create_tables()
    load_demo_data()
    print("✅ Demo setup complete!")