import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.preprocessing import LabelEncoder
import joblib
import json

# Load data
df = pd.read_csv('/tmp/complaint_training_data.csv')

# Features
# Encode categoricals
le_category = LabelEncoder()
df['category_encoded'] = le_category.fit_transform(df['complaint_category'].astype(str))

le_borough = LabelEncoder()
df['borough_encoded'] = le_borough.fit_transform(df['borough'].astype(str))

features = ['category_encoded', 'borough_encoded', 'open_class_c', 
            'total_hpd_violations', 'ecb_penalties', 'tco_expired',
            'unsigned_jobs', 'month_filed', 'dow_filed']

df['tco_expired'] = df['tco_expired'].map({'t': 1, 'f': 0, True: 1, False: 0}).fillna(0).astype(int)
X = df[features]
y = df['days_to_resolve']

# Split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Train
model = GradientBoostingRegressor(
    n_estimators=200,
    max_depth=5,
    learning_rate=0.1,
    subsample=0.8,
    random_state=42
)
model.fit(X_train, y_train)

# Evaluate
y_pred = model.predict(X_test)
mae = mean_absolute_error(y_test, y_pred)
r2 = r2_score(y_test, y_pred)
print(f"MAE: {mae:.1f} days")
print(f"R²: {r2:.3f}")
print(f"Feature importances:")
for feat, imp in sorted(zip(features, model.feature_importances_), key=lambda x: -x[1]):
    print(f"  {feat}: {imp:.3f}")

# Save model and encoders
output_dir = '/Users/mcgunky/.openclaw/workspace/wocket-demo/ml'
joblib.dump(model, f'{output_dir}/resolution_model.joblib')
joblib.dump(le_category, f'{output_dir}/le_category.joblib')
joblib.dump(le_borough, f'{output_dir}/le_borough.joblib')

# Save metadata
metadata = {
    'mae_days': round(mae, 1),
    'r2': round(r2, 3),
    'training_samples': len(X_train),
    'test_samples': len(X_test),
    'features': features,
    'categories': le_category.classes_.tolist(),
    'boroughs': le_borough.classes_.tolist(),
}
with open(f'{output_dir}/model_metadata.json', 'w') as f:
    json.dump(metadata, f, indent=2)

print(f"\nModel saved. Training samples: {len(X_train)}, Test: {len(X_test)}")
