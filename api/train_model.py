#!/usr/bin/env python3
"""Train complaint resolution time prediction model."""
import psycopg2
import psycopg2.extras
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import lightgbm as lgb
import joblib
import os

DB = 'postgresql://postgres:NiUnSAhtsDlvRnbWiDZpJQSZLbgvlHNE@yamanote.proxy.rlwy.net:29748/railway'

print("Extracting data...")
conn = psycopg2.connect(DB)
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("""
    SELECT 
        c.complaint_category,
        b.borough,
        b.open_class_c,
        b.total_hpd_violations,
        b.ecb_penalties,
        b.owner_name,
        (TO_DATE(c.disposition_date, 'MM/DD/YYYY') - TO_DATE(c.date_entered, 'MM/DD/YYYY')) as days_to_resolve
    FROM dob_complaints c
    JOIN building_scores b ON c.bin = b.bin
    WHERE c.disposition_date IS NOT NULL 
        AND c.date_entered IS NOT NULL
        AND c.disposition_date != ''
        AND c.date_entered != ''
        AND c.disposition_date ~ '^\d{2}/\d{2}/\d{4}$'
        AND c.date_entered ~ '^\d{2}/\d{2}/\d{4}$'
""")
rows = cur.fetchall()
cur.close()
conn.close()

print(f"Fetched {len(rows)} rows")
df = pd.DataFrame(rows)

# Clean
df['days_to_resolve'] = pd.to_numeric(df['days_to_resolve'], errors='coerce')
df = df.dropna(subset=['days_to_resolve'])
df = df[(df['days_to_resolve'] > 0) & (df['days_to_resolve'] <= 1825)]
print(f"After cleaning: {len(df)} rows")

# Encode
le_cat = LabelEncoder()
le_boro = LabelEncoder()
df['cat_encoded'] = le_cat.fit_transform(df['complaint_category'].fillna('UNK'))
df['boro_encoded'] = le_boro.fit_transform(df['borough'].fillna('UNK'))
df['owner_hash'] = df['owner_name'].fillna('').apply(lambda x: hash(x) % 10000)
df['ecb_penalties'] = pd.to_numeric(df['ecb_penalties'], errors='coerce').fillna(0)
df['open_class_c'] = pd.to_numeric(df['open_class_c'], errors='coerce').fillna(0)
df['total_hpd_violations'] = pd.to_numeric(df['total_hpd_violations'], errors='coerce').fillna(0)

features = ['cat_encoded', 'boro_encoded', 'open_class_c', 'total_hpd_violations', 'ecb_penalties', 'owner_hash']
X = df[features].values
y = df['days_to_resolve'].values

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

print(f"Training on {len(X_train)} samples, testing on {len(X_test)}...")
model = lgb.LGBMRegressor(
    n_estimators=500, learning_rate=0.05, max_depth=8,
    num_leaves=63, min_child_samples=100, subsample=0.8,
    colsample_bytree=0.8, random_state=42, verbose=-1
)
model.fit(X_train, y_train, eval_set=[(X_test, y_test)])

y_pred = model.predict(X_test)
mae = mean_absolute_error(y_test, y_pred)
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
r2 = r2_score(y_test, y_pred)

print(f"\n=== Model Performance ===")
print(f"MAE:  {mae:.1f} days")
print(f"RMSE: {rmse:.1f} days")
print(f"R²:   {r2:.4f}")

# Also compute city-wide average by category
city_avg = df.groupby('complaint_category')['days_to_resolve'].mean().to_dict()
overall_avg = df['days_to_resolve'].mean()

out_dir = os.path.dirname(os.path.abspath(__file__)) + '/models'
os.makedirs(out_dir, exist_ok=True)

joblib.dump(model, f'{out_dir}/complaint_resolution_model.joblib')
joblib.dump({
    'le_category': le_cat,
    'le_borough': le_boro,
    'city_avg_by_category': city_avg,
    'overall_city_avg': overall_avg,
    'features': features,
}, f'{out_dir}/complaint_resolution_encoders.joblib')

print(f"\nModel saved to {out_dir}/")
print(f"City-wide average: {overall_avg:.1f} days")
print(f"Feature importances: {dict(zip(features, model.feature_importances_))}")
