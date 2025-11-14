import os
import cv2
import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers  # pyright: ignore[reportMissingImports]
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns
from tqdm import tqdm
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DeepfakeDetector:
    def __init__(self, input_shape=(224, 224, 3), num_classes=2):
        self.input_shape = input_shape
        self.num_classes = num_classes
        self.model = None
        self.history = None
        
    def create_xception_model(self):
        """Create XceptionNet model for deepfake detection"""
        inputs = keras.Input(shape=self.input_shape)
        
        # Xception backbone
        xception = keras.applications.Xception(
            weights='imagenet',
            include_top=False,
            input_tensor=inputs,
            input_shape=self.input_shape
        )
        
        # Freeze early layers
        for layer in xception.layers[:-20]:
            layer.trainable = False
            
        # Add custom classification head
        x = xception.output
        x = layers.GlobalAveragePooling2D()(x)
        x = layers.Dropout(0.5)(x)
        x = layers.Dense(512, activation='relu')(x)
        x = layers.Dropout(0.3)(x)
        x = layers.Dense(256, activation='relu')(x)
        x = layers.Dropout(0.2)(x)
        outputs = layers.Dense(self.num_classes, activation='softmax')(x)
        
        model = keras.Model(inputs, outputs)
        
        # Compile model
        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.0001),
            loss='categorical_crossentropy',
            metrics=['accuracy', 'precision', 'recall']
        )
        
        self.model = model
        logger.info("XceptionNet model created successfully")
        return model
    
    def load_dataset(self, dataset_path):
        """Load UADFV dataset and create training data"""
        logger.info("Loading UADFV dataset...")
        
        data = []
        labels = []
        
        # Load real videos
        real_path = os.path.join(dataset_path, 'real', 'frames')
        if os.path.exists(real_path):
            for video_folder in tqdm(os.listdir(real_path), desc="Loading real videos"):
                video_path = os.path.join(real_path, video_folder)
                if os.path.isdir(video_path):
                    frames = [f for f in os.listdir(video_path) if f.endswith('.png')]
                    for frame in frames[:10]:  # Limit frames per video
                        frame_path = os.path.join(video_path, frame)
                        data.append(frame_path)
                        labels.append(0)  # Real
        
        # Load fake videos
        fake_path = os.path.join(dataset_path, 'fake', 'frames')
        if os.path.exists(fake_path):
            for video_folder in tqdm(os.listdir(fake_path), desc="Loading fake videos"):
                video_path = os.path.join(fake_path, video_folder)
                if os.path.isdir(video_path):
                    frames = [f for f in os.listdir(video_path) if f.endswith('.png')]
                    for frame in frames[:10]:  # Limit frames per video
                        frame_path = os.path.join(video_path, frame)
                        data.append(frame_path)
                        labels.append(1)  # Fake
        
        logger.info(f"Loaded {len(data)} images: {labels.count(0)} real, {labels.count(1)} fake")
        return data, labels
    
    def preprocess_image(self, image_path):
        """Preprocess image for model input"""
        try:
            img = cv2.imread(image_path)
            if img is None:
                return None
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            img = cv2.resize(img, (self.input_shape[0], self.input_shape[1]))
            img = img.astype(np.float32) / 255.0
            return img
        except Exception as e:
            logger.error(f"Error preprocessing image {image_path}: {e}")
            return None
    
    def create_data_generator(self, data, labels, batch_size=32, shuffle=True):
        """Create data generator for training"""
        def generator():
            indices = list(range(len(data)))
            if shuffle:
                np.random.shuffle(indices)
            
            while True:
                for i in range(0, len(indices), batch_size):
                    batch_indices = indices[i:i+batch_size]
                    batch_images = []
                    batch_labels = []
                    
                    for idx in batch_indices:
                        img = self.preprocess_image(data[idx])
                        if img is not None:
                            batch_images.append(img)
                            batch_labels.append(labels[idx])
                    
                    if batch_images:
                        batch_images = np.array(batch_images)
                        batch_labels = keras.utils.to_categorical(batch_labels, self.num_classes)
                        yield batch_images, batch_labels
        
        return generator
    
    def load_and_preprocess_data(self, data, labels):
        """Load and preprocess all data at once"""
        images = []
        processed_labels = []
        
        for i, (img_path, label) in enumerate(tqdm(zip(data, labels), desc="Preprocessing images")):
            img = self.preprocess_image(img_path)
            if img is not None:
                images.append(img)
                processed_labels.append(label)
        
        images = np.array(images)
        processed_labels = keras.utils.to_categorical(processed_labels, self.num_classes)
        
        return images, processed_labels
    
    def train_model(self, dataset_path, epochs=50, batch_size=32, validation_split=0.2):
        """Train the deepfake detection model"""
        logger.info("Starting model training...")
        
        # Load dataset
        data, labels = self.load_dataset(dataset_path)
        
        if len(data) == 0:
            logger.error("No data found in dataset")
            return None
        
        # Split data
        X_train, X_val, y_train, y_val = train_test_split(
            data, labels, test_size=validation_split, random_state=42, stratify=labels
        )
        
        # Preprocess data
        logger.info("Preprocessing training data...")
        X_train_processed, y_train_processed = self.load_and_preprocess_data(X_train, y_train)
        
        logger.info("Preprocessing validation data...")
        X_val_processed, y_val_processed = self.load_and_preprocess_data(X_val, y_val)
        
        # Create model
        if self.model is None:
            self.create_xception_model()
        
        # Callbacks
        callbacks = [
            keras.callbacks.EarlyStopping(patience=10, restore_best_weights=True),
            keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=5),
            keras.callbacks.ModelCheckpoint(
                'models/deepfake_model_50e.h5', 
                save_best_only=True, 
                monitor='val_accuracy'
            )
        ]
        
        # Train model
        self.history = self.model.fit(
            X_train_processed, y_train_processed,
            batch_size=batch_size,
            epochs=epochs,
            validation_data=(X_val_processed, y_val_processed),
            callbacks=callbacks,
            verbose=1
        )
        
        logger.info("Model training completed")
        return self.history
    
    def evaluate_model(self, dataset_path, batch_size=32):
        """Evaluate model performance"""
        logger.info("Evaluating model...")
        
        data, labels = self.load_dataset(dataset_path)
        
        # Preprocess data
        logger.info("Preprocessing evaluation data...")
        X_processed, y_processed = self.load_and_preprocess_data(data, labels)
        
        # Predict
        predictions = self.model.predict(X_processed, batch_size=batch_size)
        predicted_classes = np.argmax(predictions, axis=1)
        true_classes = np.argmax(y_processed, axis=1)
        
        # Calculate metrics
        report = classification_report(true_classes, predicted_classes, target_names=['Real', 'Fake'])
        cm = confusion_matrix(true_classes, predicted_classes)
        
        logger.info("Classification Report:")
        logger.info(report)
        
        # Plot confusion matrix
        plt.figure(figsize=(8, 6))
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                   xticklabels=['Real', 'Fake'], yticklabels=['Real', 'Fake'])
        plt.title('Confusion Matrix')
        plt.ylabel('True Label')
        plt.xlabel('Predicted Label')
        plt.savefig('models/confusion_matrix.png')
        plt.close()
        
        return report, cm
    
    def predict_video(self, video_path):
        """Predict if a video contains deepfakes"""
        logger.info(f"Analyzing video: {video_path}")
        
        if self.model is None:
            logger.error("Model not loaded. Please train or load a model first.")
            return None
        
        # Extract frames from video
        cap = cv2.VideoCapture(video_path)
        frames = []
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frames.append(frame)
        
        cap.release()
        
        if len(frames) == 0:
            logger.error("No frames extracted from video")
            return None
        
        # Process frames
        processed_frames = []
        for frame in frames[::5]:  # Sample every 5th frame
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frame_resized = cv2.resize(frame_rgb, (self.input_shape[0], self.input_shape[1]))
            frame_normalized = frame_resized.astype(np.float32) / 255.0
            processed_frames.append(frame_normalized)
        
        if len(processed_frames) == 0:
            logger.error("No frames processed")
            return None
        
        # Predict
        X = np.array(processed_frames)
        predictions = self.model.predict(X)
        
        # Calculate average prediction
        avg_prediction = np.mean(predictions, axis=0)
        predicted_class = np.argmax(avg_prediction)
        confidence = avg_prediction[predicted_class]
        
        result = {
            'prediction': 'fake' if predicted_class == 1 else 'real',
            'confidence': float(confidence),
            'fake_probability': float(avg_prediction[1]),
            'real_probability': float(avg_prediction[0]),
            'frames_analyzed': len(processed_frames)
        }
        
        logger.info(f"Prediction: {result['prediction']} (confidence: {confidence:.3f})")
        return result
    
    def save_model(self, path='models/deepfake_model_50e.h5'):
        """Save trained model"""
        if self.model is not None:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            self.model.save(path)
            logger.info(f"Model saved to {path}")
        else:
            logger.error("No model to save")
    
    def load_model(self, path='models/deepfake_model_50e.h5'):
        """Load pre-trained model"""
        if os.path.exists(path):
            self.model = keras.models.load_model(path)
            logger.info(f"Model loaded from {path}")
        else:
            logger.error(f"Model file not found: {path}")

if __name__ == "__main__":
    # Initialize detector
    detector = DeepfakeDetector()
    
    # Train model
    dataset_path = "../UADFV"  # Adjust path as needed
    if os.path.exists(dataset_path):
        detector.train_model(dataset_path, epochs=30)
        detector.evaluate_model(dataset_path)
        detector.save_model()
    else:
        logger.error(f"Dataset path not found: {dataset_path}")

