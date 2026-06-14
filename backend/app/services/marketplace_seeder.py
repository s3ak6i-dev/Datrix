"""
Marketplace seeder — defines 11 built-in community assets (7 datasets + 4 pipelines)
and generates synthetic data for each dataset at install time.
Seeds are written to the store once at startup if they don't exist yet.
"""
from __future__ import annotations

from typing import Callable

import numpy as np
import polars as pl

from app.models.store import store, MarketplaceAsset

RNG = np.random.default_rng(42)


# ── Dataset generators ────────────────────────────────────────────────

def _gen_iris() -> pl.DataFrame:
    rng = np.random.default_rng(42)
    specs = [
        ([5.006, 3.428, 1.462, 0.246], [0.352, 0.379, 0.174, 0.105], 'setosa'),
        ([5.936, 2.770, 4.260, 1.326], [0.516, 0.314, 0.470, 0.198], 'versicolor'),
        ([6.588, 2.974, 5.552, 2.026], [0.636, 0.322, 0.552, 0.275], 'virginica'),
    ]
    rows = []
    for mean, std, species in specs:
        for _ in range(50):
            vals = [max(0.1, float(rng.normal(m, s))) for m, s in zip(mean, std)]
            rows.append((*[round(v, 1) for v in vals], species))
    sl, sw, pl_, pw, sp = zip(*rows)
    return pl.DataFrame({'sepal_length': list(sl), 'sepal_width': list(sw),
                         'petal_length': list(pl_), 'petal_width': list(pw), 'species': list(sp)})


def _gen_titanic() -> pl.DataFrame:
    rng = np.random.default_rng(42)
    n = 891
    pclass = rng.choice([1, 2, 3], n, p=[0.24, 0.21, 0.55])
    sex    = rng.choice(['male', 'female'], n, p=[0.65, 0.35])
    age    = np.where(rng.random(n) < 0.2, None, np.clip(rng.normal(29.7, 14.5, n), 0.5, 80))
    sibsp  = rng.choice([0,1,2,3,4,5], n, p=[0.68,0.23,0.06,0.015,0.01,0.005])
    parch  = rng.choice([0,1,2,3,4,5], n, p=[0.762,0.130,0.090,0.006,0.006,0.006])
    fare   = np.clip(rng.lognormal(2.8, 1.1, n), 0, 512).round(2)
    embarked = rng.choice(['S','C','Q'], n, p=[0.72, 0.19, 0.09])
    # Survival: women + 1st class have higher rate
    base = 0.38 * np.ones(n)
    base += (sex == 'female') * 0.28
    base -= (pclass == 3) * 0.2
    base += (pclass == 1) * 0.2
    survived = (rng.random(n) < np.clip(base, 0, 1)).astype(int)
    return pl.DataFrame({
        'survived': survived.tolist(), 'pclass': pclass.tolist(),
        'sex': sex.tolist(),
        'age': [None if v is None else round(float(v), 1) for v in age],
        'sibsp': sibsp.tolist(), 'parch': parch.tolist(),
        'fare': fare.tolist(),
        'embarked': [None if rng.random() < 0.002 else e for e in embarked.tolist()],
    })


def _gen_churn() -> pl.DataFrame:
    rng = np.random.default_rng(42)
    n = 7043
    gender   = rng.choice(['Male','Female'], n)
    senior   = (rng.random(n) < 0.16).astype(int)
    tenure   = rng.integers(0, 73, n)
    contract = rng.choice(['Month-to-month','One year','Two year'], n, p=[0.55, 0.21, 0.24])
    monthly  = np.clip(rng.normal(64.8, 30.1, n), 18, 119).round(2)
    total    = (monthly * tenure * np.clip(rng.normal(1.0, 0.05, n), 0.9, 1.1)).round(2)
    internet = rng.choice(['DSL','Fiber optic','No'], n, p=[0.34, 0.44, 0.22])
    payment  = rng.choice(['Electronic check','Mailed check','Bank transfer','Credit card'], n, p=[0.34, 0.23, 0.22, 0.21])
    # Churn: higher for month-to-month, fiber, low tenure
    base = 0.265 * np.ones(n)
    base += (contract == 'Month-to-month') * 0.2
    base -= (contract == 'Two year') * 0.22
    base += (internet == 'Fiber optic') * 0.1
    base -= tenure / 72 * 0.15
    churn = np.where(rng.random(n) < np.clip(base, 0, 1), 'Yes', 'No')
    return pl.DataFrame({
        'gender': gender.tolist(), 'senior_citizen': senior.tolist(),
        'tenure': tenure.tolist(), 'contract': contract.tolist(),
        'internet_service': internet.tolist(), 'payment_method': payment.tolist(),
        'monthly_charges': monthly.tolist(),
        'total_charges': [None if t == 0 else float(t) for t in total.tolist()],
        'churn': churn.tolist(),
    })


def _gen_ecommerce() -> pl.DataFrame:
    rng = np.random.default_rng(42)
    n = 10_000
    categories = rng.choice(['Electronics','Clothing','Books','Home & Kitchen','Sports','Beauty','Toys'], n,
                             p=[0.22, 0.20, 0.15, 0.18, 0.10, 0.09, 0.06])
    price      = np.where(categories == 'Electronics',
                          np.clip(rng.lognormal(4.5, 0.8, n), 20, 2000),
                          np.clip(rng.lognormal(3.2, 0.9, n), 5, 500)).round(2)
    quantity   = rng.integers(1, 6, n)
    delivery   = rng.integers(1, 15, n)
    age        = rng.integers(18, 70, n)
    region     = rng.choice(['North','South','East','West','Central'], n)
    rating     = np.clip(rng.normal(3.8, 0.9, n), 1, 5).round(1)
    # Label based on revenue
    revenue = price * quantity
    label   = np.where(revenue > 300, 'high_value',
              np.where(revenue > 80, 'medium_value', 'low_value'))
    return pl.DataFrame({
        'product_category': categories.tolist(), 'product_price': price.tolist(),
        'quantity': quantity.tolist(), 'delivery_days': delivery.tolist(),
        'customer_age': age.tolist(), 'customer_region': region.tolist(),
        'product_rating': rating.tolist(), 'label': label.tolist(),
    })


def _gen_house_prices() -> pl.DataFrame:
    rng = np.random.default_rng(42)
    n = 1460
    qual      = rng.integers(1, 11, n)
    area      = np.clip(rng.normal(1515, 525, n), 400, 5000).astype(int)
    yearbuilt = rng.integers(1872, 2011, n)
    lotarea   = np.clip(rng.lognormal(9.1, 0.5, n), 1300, 215245).astype(int)
    bedrooms  = rng.integers(0, 9, n)
    bathrooms = rng.integers(1, 4, n)
    garage    = rng.integers(0, 4, n)
    nbhd      = rng.choice(['NAmes','CollgCr','OldTown','Edwards','Somerst','Gilbert','NridgHt','Sawyer'], n)
    # Sale price correlated with quality + area
    price = (qual * 15000 + area * 60 + (2010 - yearbuilt) * (-150)
             + rng.normal(0, 15000, n)).clip(50000, 755000).astype(int)
    return pl.DataFrame({
        'lot_area': lotarea.tolist(), 'year_built': yearbuilt.tolist(),
        'overall_qual': qual.tolist(), 'gr_liv_area': area.tolist(),
        'bedroom': bedrooms.tolist(), 'full_bath': bathrooms.tolist(),
        'garage_cars': garage.tolist(), 'neighborhood': nbhd.tolist(),
        'sale_price': price.tolist(),
    })


def _gen_attrition() -> pl.DataFrame:
    rng = np.random.default_rng(42)
    n = 1470
    age       = rng.integers(18, 61, n)
    dept      = rng.choice(['Sales','R&D','HR'], n, p=[0.30, 0.56, 0.14])
    role      = rng.choice(['Sales Exec','Research Scientist','Lab Technician','Manager',
                            'Healthcare Rep','Manufacturing Dir','HR'], n)
    dist      = rng.integers(1, 30, n)
    edu       = rng.integers(1, 6, n)
    income    = np.clip(rng.lognormal(8.7, 0.6, n), 1009, 19999).astype(int)
    overtime  = rng.choice(['Yes','No'], n, p=[0.29, 0.71])
    years     = rng.integers(0, 41, n)
    satisf    = rng.integers(1, 5, n)
    base = 0.161 * np.ones(n)
    base += (overtime == 'Yes') * 0.12
    base += (dist > 20) * 0.05
    base -= satisf / 4 * 0.08
    base -= years / 40 * 0.06
    attrition = np.where(rng.random(n) < np.clip(base, 0, 1), 'Yes', 'No')
    return pl.DataFrame({
        'age': age.tolist(), 'department': dept.tolist(), 'job_role': role.tolist(),
        'distance_from_home': dist.tolist(), 'education': edu.tolist(),
        'monthly_income': income.tolist(), 'overtime': overtime.tolist(),
        'years_at_company': years.tolist(), 'job_satisfaction': satisf.tolist(),
        'attrition': attrition.tolist(),
    })


def _gen_fraud() -> pl.DataFrame:
    rng = np.random.default_rng(42)
    n = 5000
    merchant    = rng.choice(['grocery','entertainment','gas_transport','misc_net',
                              'shopping_net','food_dining'], n, p=[0.20,0.12,0.15,0.18,0.17,0.18])
    amount      = np.clip(rng.lognormal(3.5, 1.3, n), 0.01, 28948).round(2)
    hour        = rng.integers(0, 24, n)
    day         = rng.integers(0, 7, n)
    dist_home   = np.clip(rng.lognormal(2.6, 1.5, n), 0.003, 10632).round(3)
    txn_24h     = rng.integers(1, 10, n)
    # Fraud: large amount, night hours, far from home
    base = 0.057 * np.ones(n)
    base += (amount > 500) * 0.15
    base += ((hour < 6) | (hour > 22)) * 0.08
    base += (dist_home > 200) * 0.12
    base += (merchant == 'shopping_net') * 0.06
    is_fraud = (rng.random(n) < np.clip(base, 0, 1)).astype(int)
    return pl.DataFrame({
        'amount': amount.tolist(), 'merchant_category': merchant.tolist(),
        'hour_of_day': hour.tolist(), 'day_of_week': day.tolist(),
        'distance_from_home': dist_home.tolist(),
        'transaction_count_24h': txn_24h.tolist(),
        'is_fraud': is_fraud.tolist(),
    })


# ── Seed definitions ──────────────────────────────────────────────────

DATASET_SEEDS: list[dict] = [
    {
        'key': 'iris',
        'title': 'Iris Flower Classification',
        'description': 'Classic 3-class flower species dataset. Ideal for learning classification algorithms.',
        'long_description': 'The Iris dataset contains measurements of 150 iris flowers from three species (setosa, versicolor, virginica). Four features: sepal length, sepal width, petal length, petal width. Perfect for benchmarking and learning.',
        'category': 'general',
        'tags': ['classification', 'multiclass', 'beginner', 'flowers'],
        'author_name': 'Fisher / Community',
        'license': 'cc_by',
        'version': '1.0.0',
        'generator': _gen_iris,
        'row_count': 150,
        'rating_avg': 4.8, 'rating_count': 142,
        'download_count': 1840,
    },
    {
        'key': 'titanic',
        'title': 'Titanic Survival Prediction',
        'description': 'Predict passenger survival from the Titanic disaster. A go-to binary classification benchmark.',
        'long_description': 'Contains 891 passengers with features like passenger class, age, sex, number of relatives aboard, and fare. Target: survived (0/1). Includes missing values in age and embarked columns for realistic data cleaning practice.',
        'category': 'general',
        'tags': ['classification', 'binary', 'missing-values', 'beginner'],
        'author_name': 'Kaggle / Community',
        'license': 'cc_by',
        'version': '1.0.0',
        'generator': _gen_titanic,
        'row_count': 891,
        'rating_avg': 4.7, 'rating_count': 218,
        'download_count': 3120,
    },
    {
        'key': 'churn',
        'title': 'Telecom Customer Churn',
        'description': 'Predict whether a telecom customer will churn. Classic marketing and CRM use-case.',
        'long_description': 'Inspired by the IBM Telco Churn dataset. 7,043 customers with contract details, billing info, and service usage. Target: churn (Yes/No). Useful for understanding class imbalance handling.',
        'category': 'marketing',
        'tags': ['classification', 'binary', 'churn', 'imbalanced', 'crm'],
        'author_name': 'IBM / Community',
        'license': 'cc_by',
        'version': '1.0.0',
        'generator': _gen_churn,
        'row_count': 7043,
        'rating_avg': 4.6, 'rating_count': 89,
        'download_count': 2210,
    },
    {
        'key': 'ecommerce',
        'title': 'E-commerce Order Value Classification',
        'description': 'Classify orders as high, medium, or low value based on product and customer features.',
        'long_description': '10,000 synthetic e-commerce orders with product category, price, quantity, delivery days, customer age, and region. Three-class target: high_value / medium_value / low_value.',
        'category': 'ecommerce',
        'tags': ['classification', 'multiclass', 'retail', 'orders'],
        'author_name': 'Community',
        'license': 'mit',
        'version': '1.0.0',
        'generator': _gen_ecommerce,
        'row_count': 10000,
        'rating_avg': 4.4, 'rating_count': 47,
        'download_count': 890,
    },
    {
        'key': 'house_prices',
        'title': 'House Price Regression',
        'description': 'Predict residential property sale prices from structural and neighborhood features.',
        'long_description': 'Inspired by the Ames Housing dataset. 1,460 homes with lot area, year built, overall quality, living area, bedrooms, bathrooms, garage capacity, and neighborhood. Target: sale_price (continuous).',
        'category': 'finance',
        'tags': ['regression', 'real-estate', 'housing', 'prices'],
        'author_name': 'Ames / Community',
        'license': 'cc_by',
        'version': '1.0.0',
        'generator': _gen_house_prices,
        'row_count': 1460,
        'rating_avg': 4.5, 'rating_count': 73,
        'download_count': 1450,
    },
    {
        'key': 'attrition',
        'title': 'Employee Attrition Prediction',
        'description': 'Predict whether an employee will leave the company. Classic HR analytics dataset.',
        'long_description': 'Inspired by the IBM HR Analytics dataset. 1,470 employees with age, department, job role, distance from home, education level, income, overtime, and job satisfaction. Target: attrition (Yes/No). ~16% positive rate.',
        'category': 'hr',
        'tags': ['classification', 'binary', 'hr', 'attrition', 'imbalanced'],
        'author_name': 'IBM / Community',
        'license': 'cc_by',
        'version': '1.0.0',
        'generator': _gen_attrition,
        'row_count': 1470,
        'rating_avg': 4.5, 'rating_count': 61,
        'download_count': 980,
    },
    {
        'key': 'fraud',
        'title': 'Credit Card Fraud Detection',
        'description': 'Detect fraudulent transactions from merchant, amount, timing, and location features.',
        'long_description': '5,000 transactions with amount, merchant category, hour of day, day of week, distance from home, and transaction count in last 24h. Binary target: is_fraud. ~6% positive rate — useful for imbalanced classification practice.',
        'category': 'finance',
        'tags': ['classification', 'binary', 'fraud', 'imbalanced', 'finance'],
        'author_name': 'Community',
        'license': 'mit',
        'version': '1.0.0',
        'generator': _gen_fraud,
        'row_count': 5000,
        'rating_avg': 4.7, 'rating_count': 94,
        'download_count': 1670,
    },
]

PIPELINE_SEEDS: list[dict] = [
    {
        'key': 'pipeline_cleaning',
        'title': 'Data Cleaning Starter',
        'description': 'Deduplicate rows, fill missing values with column means, and lowercase all string columns.',
        'long_description': 'A sensible first pipeline for any raw dataset. Removes duplicate rows, fills numeric nulls with column median, fills categorical nulls with most frequent value, and lowercases all string columns for consistency.',
        'category': 'general',
        'tags': ['cleaning', 'nulls', 'duplicates', 'starter'],
        'author_name': 'Community',
        'license': 'mit',
        'version': '1.0.0',
        'steps': [
            {'type': 'deduplicate', 'config': {}},
            {'type': 'fill_nulls', 'config': {'method': 'mean'}},
            {'type': 'lowercase', 'config': {}},
        ],
        'rating_avg': 4.6, 'rating_count': 38, 'download_count': 720,
    },
    {
        'key': 'pipeline_ml_prep',
        'title': 'ML Feature Preparation',
        'description': 'Encode categorical columns and normalize numeric columns for ML model training.',
        'long_description': 'Prepares a dataset for use with scikit-learn. Encodes categorical string columns using label encoding and normalizes numeric columns to [0,1] range. Run this after your cleaning pipeline.',
        'category': 'general',
        'tags': ['ml', 'encoding', 'normalization', 'features'],
        'author_name': 'Community',
        'license': 'mit',
        'version': '1.0.0',
        'steps': [
            {'type': 'fill_nulls', 'config': {'method': 'mean'}},
            {'type': 'encode_categorical', 'config': {}},
            {'type': 'normalize', 'config': {}},
        ],
        'rating_avg': 4.4, 'rating_count': 29, 'download_count': 540,
    },
    {
        'key': 'pipeline_ecommerce',
        'title': 'E-commerce ETL',
        'description': 'Standard transformation pipeline for e-commerce order datasets — fill nulls, deduplicate, encode.',
        'long_description': 'Designed for order-level e-commerce datasets. Fills missing product and customer fields, removes duplicates (same order_id), and encodes categorical columns like region and category for downstream ML.',
        'category': 'ecommerce',
        'tags': ['ecommerce', 'etl', 'orders', 'retail'],
        'author_name': 'Community',
        'license': 'mit',
        'version': '1.0.0',
        'steps': [
            {'type': 'fill_nulls', 'config': {'method': 'most_frequent'}},
            {'type': 'deduplicate', 'config': {}},
            {'type': 'encode_categorical', 'config': {}},
        ],
        'rating_avg': 4.3, 'rating_count': 18, 'download_count': 310,
    },
    {
        'key': 'pipeline_timeseries',
        'title': 'Time Series Prep',
        'description': 'Sort by date, forward-fill missing values, and normalize numeric columns for time series data.',
        'long_description': 'Prepares time series datasets for analysis or modelling. Sorts rows by a date column (configure column name in the sort step), forward-fills null values to preserve temporal continuity, then normalizes numeric columns.',
        'category': 'timeseries',
        'tags': ['timeseries', 'sort', 'forward-fill', 'normalization'],
        'author_name': 'Community',
        'license': 'mit',
        'version': '1.0.0',
        'steps': [
            {'type': 'sort', 'config': {'column': 'date', 'ascending': True}},
            {'type': 'fill_nulls', 'config': {'method': 'mean'}},
            {'type': 'normalize', 'config': {}},
        ],
        'rating_avg': 4.2, 'rating_count': 14, 'download_count': 220,
    },
]


# ── Schema preview generators ─────────────────────────────────────────

def _dataset_preview(generator: Callable) -> dict:
    df = generator()
    schema = [{'name': c, 'dtype': str(df[c].dtype), 'nullable': df[c].null_count() > 0}
              for c in df.columns]
    sample = [df.row(i, named=True) for i in range(min(3, len(df)))]
    # Clean sample for JSON
    clean_sample = []
    for row in sample:
        clean_sample.append({k: (None if v != v else v) for k, v in row.items()})  # type: ignore[comparison-overlap]
    return {'schema': schema, 'sample_rows': clean_sample,
            'row_count': len(df), 'column_count': len(df.columns)}


def _pipeline_preview(steps: list, step_count: int) -> dict:
    return {'steps': steps, 'step_count': step_count}


# ── Seeder init ───────────────────────────────────────────────────────

def initialize_seeds() -> None:
    """Called at startup — insert seeded assets if not present."""
    existing_keys = {a.seed_key for a in store.list_marketplace_assets() if a.is_seeded}

    for spec in DATASET_SEEDS:
        if spec['key'] in existing_keys:
            continue
        preview = _dataset_preview(spec['generator'])
        asset = MarketplaceAsset(
            id=f"seed_{spec['key']}",
            title=spec['title'],
            description=spec['description'],
            long_description=spec['long_description'],
            asset_type='dataset',
            category=spec['category'],
            tags=spec['tags'],
            author_name=spec['author_name'],
            license=spec['license'],
            version=spec['version'],
            status='published',
            is_seeded=True,
            seed_key=spec['key'],
            download_count=spec['download_count'],
            view_count=spec['download_count'] * 4,
            rating_avg=spec['rating_avg'],
            rating_count=spec['rating_count'],
            preview=preview,
            file_size=preview['row_count'] * preview['column_count'] * 8,
        )
        store.add_marketplace_asset(asset)

    for spec in PIPELINE_SEEDS:
        if spec['key'] in existing_keys:
            continue
        preview = _pipeline_preview(spec['steps'], len(spec['steps']))
        asset = MarketplaceAsset(
            id=f"seed_{spec['key']}",
            title=spec['title'],
            description=spec['description'],
            long_description=spec['long_description'],
            asset_type='pipeline',
            category=spec['category'],
            tags=spec['tags'],
            author_name=spec['author_name'],
            license=spec['license'],
            version=spec['version'],
            status='published',
            is_seeded=True,
            seed_key=spec['key'],
            download_count=spec['download_count'],
            view_count=spec['download_count'] * 3,
            rating_avg=spec['rating_avg'],
            rating_count=spec['rating_count'],
            preview=preview,
        )
        store.add_marketplace_asset(asset)


# ── Install helpers ───────────────────────────────────────────────────

def generate_seeded_dataset(seed_key: str) -> pl.DataFrame:
    spec = next((s for s in DATASET_SEEDS if s['key'] == seed_key), None)
    if not spec:
        raise ValueError(f"Unknown seed key: {seed_key}")
    return spec['generator']()


def get_seeded_pipeline_steps(seed_key: str) -> list:
    spec = next((s for s in PIPELINE_SEEDS if s['key'] == seed_key), None)
    if not spec:
        raise ValueError(f"Unknown seed key: {seed_key}")
    return spec['steps']
