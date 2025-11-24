"""
Gesture Model Training Script

Loads gesture samples from CSV files, trains a RandomForest classifier,
and saves the trained model and label encoder.
"""

import os
import glob
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix
import joblib
from pathlib import Path
from typing import Tuple


def get_data_path() -> Path:
    """
    Get the path to the gesture_raw data directory.
    Uses __file__ to ensure correct relative path from ml/scripts/.
    
    Returns:
        Path object pointing to ../data/gesture_raw/ directory
    """
    script_path = Path(__file__).resolve()
    scripts_dir = script_path.parent
    ml_dir = scripts_dir.parent
    data_dir = ml_dir / 'data' / 'gesture_raw'
    return data_dir


def get_models_path() -> Path:
    """
    Get the path to the models directory.
    
    Returns:
        Path object pointing to ../models/ directory
    """
    script_path = Path(__file__).resolve()
    scripts_dir = script_path.parent
    ml_dir = scripts_dir.parent
    models_dir = ml_dir / 'models'
    return models_dir


def load_gesture_data(data_dir: Path) -> pd.DataFrame:
    """
    Load all gesture sample CSV files and combine into a single DataFrame.
    
    Args:
        data_dir: Path to directory containing CSV files
        
    Returns:
        Combined DataFrame with all samples
    """
    # Find all gesture sample CSV files
    csv_pattern = str(data_dir / 'gesture_samples_*.csv')
    csv_files = glob.glob(csv_pattern)
    
    if not csv_files:
        raise FileNotFoundError(
            f"No gesture sample CSV files found in {data_dir}. "
            "Please run collect_gestures.py first to collect data."
        )
    
    print(f"Found {len(csv_files)} CSV file(s)")
    
    # Load and concatenate all CSV files
    dataframes = []
    for csv_file in csv_files:
        print(f"  Loading: {os.path.basename(csv_file)}")
        df = pd.read_csv(csv_file)
        dataframes.append(df)
    
    # Combine all DataFrames
    combined_df = pd.concat(dataframes, ignore_index=True)
    print(f"\nTotal samples loaded: {len(combined_df)}")
    
    # Drop rows with any NaN values
    initial_count = len(combined_df)
    combined_df = combined_df.dropna()
    dropped_count = initial_count - len(combined_df)
    
    if dropped_count > 0:
        print(f"Dropped {dropped_count} rows with NaN values")
    
    print(f"Final dataset size: {len(combined_df)} samples")
    
    return combined_df


def prepare_features_and_labels(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series, LabelEncoder]:
    """
    Extract features and labels from the DataFrame.
    
    Args:
        df: DataFrame containing gesture samples
        
    Returns:
        Tuple of (features DataFrame, labels Series, fitted LabelEncoder)
    """
    # Check if 'gesture' column exists (handle both 'gesture' and 'gesture_label')
    if 'gesture' not in df.columns and 'gesture_label' in df.columns:
        print("Note: Found 'gesture_label' column, renaming to 'gesture'")
        df = df.rename(columns={'gesture_label': 'gesture'})
    elif 'gesture' not in df.columns:
        raise ValueError("DataFrame must contain a 'gesture' column")
    
    # Extract target labels
    y = df['gesture'].copy()
    
    # Extract features (all numeric columns except 'gesture' and metadata columns)
    metadata_cols = ['gesture', 'gesture_label', 'sample_index', 'timestamp']
    feature_cols = [col for col in df.columns 
                   if col not in metadata_cols and pd.api.types.is_numeric_dtype(df[col])]
    
    X = df[feature_cols].copy()
    
    print(f"\nFeatures: {len(feature_cols)} columns")
    print(f"Labels: {y.nunique()} unique gestures")
    print(f"Label distribution:\n{y.value_counts()}")
    
    # Encode labels to integers
    label_encoder = LabelEncoder()
    y_encoded = label_encoder.fit_transform(y)
    
    print(f"\nLabel mapping:")
    for i, label in enumerate(label_encoder.classes_):
        print(f"  {i}: {label}")
    
    return X, pd.Series(y_encoded), label_encoder


def train_model(X_train: pd.DataFrame, y_train: pd.Series) -> RandomForestClassifier:
    """
    Train a RandomForest classifier on the training data.
    
    Args:
        X_train: Training features
        y_train: Training labels (encoded)
        
    Returns:
        Trained RandomForestClassifier
    """
    print("\nTraining RandomForest classifier...")
    
    model = RandomForestClassifier(
        n_estimators=200,
        random_state=42,
        n_jobs=-1,
        verbose=1
    )
    
    model.fit(X_train, y_train)
    
    print("Training completed!")
    
    return model


def evaluate_model(model: RandomForestClassifier, X_test: pd.DataFrame, 
                   y_test: pd.Series, label_encoder: LabelEncoder) -> None:
    """
    Evaluate the model on test data and print metrics.
    
    Args:
        model: Trained classifier
        X_test: Test features
        y_test: Test labels (encoded)
        label_encoder: LabelEncoder to decode predictions
    """
    print("\nEvaluating model on test set...")
    
    # Make predictions
    y_pred = model.predict(X_test)
    
    # Decode labels for reporting
    y_test_decoded = label_encoder.inverse_transform(y_test)
    y_pred_decoded = label_encoder.inverse_transform(y_pred)
    
    # Print classification report
    print("\n" + "="*60)
    print("Classification Report:")
    print("="*60)
    print(classification_report(y_test_decoded, y_pred_decoded))
    
    # Print confusion matrix
    print("\n" + "="*60)
    print("Confusion Matrix:")
    print("="*60)
    cm = confusion_matrix(y_test_decoded, y_pred_decoded, labels=label_encoder.classes_)
    print(cm)
    print(f"\nLabels: {list(label_encoder.classes_)}")


def save_model_and_encoder(model: RandomForestClassifier, 
                           label_encoder: LabelEncoder, 
                           models_dir: Path) -> None:
    """
    Save the trained model and label encoder to disk.
    
    Args:
        model: Trained RandomForestClassifier
        label_encoder: Fitted LabelEncoder
        models_dir: Directory to save models
    """
    # Create models directory if it doesn't exist
    models_dir.mkdir(parents=True, exist_ok=True)
    
    # Save model
    model_path = models_dir / 'gesture_rf.joblib'
    joblib.dump(model, model_path)
    print(f"\nSaved model to: {model_path}")
    
    # Save label encoder
    encoder_path = models_dir / 'gesture_label_encoder.joblib'
    joblib.dump(label_encoder, encoder_path)
    print(f"Saved label encoder to: {encoder_path}")


def main() -> None:
    """Main function to run the training pipeline."""
    
    print("="*60)
    print("Gesture Model Training")
    print("="*60)
    
    # Step 1: Get paths
    data_dir = get_data_path()
    models_dir = get_models_path()
    
    print(f"\nData directory: {data_dir}")
    print(f"Models directory: {models_dir}")
    
    # Step 2: Load and combine all CSV files
    print("\n" + "-"*60)
    print("Step 1: Loading gesture data")
    print("-"*60)
    df = load_gesture_data(data_dir)
    
    # Step 3: Prepare features and labels
    print("\n" + "-"*60)
    print("Step 2: Preparing features and labels")
    print("-"*60)
    X, y_encoded, label_encoder = prepare_features_and_labels(df)
    
    # Step 4: Split into train/test sets
    print("\n" + "-"*60)
    print("Step 3: Splitting data into train/test sets")
    print("-"*60)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded,
        test_size=0.2,
        random_state=42,
        stratify=y_encoded
    )
    
    print(f"Training set: {len(X_train)} samples")
    print(f"Test set: {len(X_test)} samples")
    
    # Step 5: Train the model
    print("\n" + "-"*60)
    print("Step 4: Training model")
    print("-"*60)
    model = train_model(X_train, y_train)
    
    # Step 6: Evaluate the model
    print("\n" + "-"*60)
    print("Step 5: Evaluating model")
    print("-"*60)
    evaluate_model(model, X_test, y_test, label_encoder)
    
    # Step 7: Save model and encoder
    print("\n" + "-"*60)
    print("Step 6: Saving model and encoder")
    print("-"*60)
    save_model_and_encoder(model, label_encoder, models_dir)
    
    print("\n" + "="*60)
    print("Training pipeline completed successfully!")
    print("="*60)


if __name__ == "__main__":
    main()

