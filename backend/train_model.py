#!/usr/bin/env python3
"""
Training script for Deepfake Detection Model using XceptionNet
"""

import os
import sys
import argparse
import logging
from deepfake_detector import DeepfakeDetector

def main():
    parser = argparse.ArgumentParser(description='Train Deepfake Detection Model')
    parser.add_argument('--dataset', type=str, default='../UADFV', 
                       help='Path to UADFV dataset')
    parser.add_argument('--epochs', type=int, default=50, 
                       help='Number of training epochs')
    parser.add_argument('--batch-size', type=int, default=32, 
                       help='Batch size for training')
    parser.add_argument('--model-path', type=str, default='models/deepfake_model_50e.h5', 
                       help='Path to save the trained model')
    
    args = parser.parse_args()
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    logger = logging.getLogger(__name__)
    
    # Check if dataset exists
    if not os.path.exists(args.dataset):
        logger.error(f"Dataset path not found: {args.dataset}")
        sys.exit(1)
    
    # Initialize detector
    logger.info("Initializing Deepfake Detector...")
    detector = DeepfakeDetector()
    
    # Train model
    logger.info(f"Starting training with {args.epochs} epochs...")
    history = detector.train_model(
        dataset_path=args.dataset,
        epochs=args.epochs,
        batch_size=args.batch_size
    )
    
    if history is not None:
        # Save model
        detector.save_model(args.model_path)
        
        # Evaluate model
        logger.info("Evaluating model...")
        detector.evaluate_model(args.dataset)
        
        logger.info("Training completed successfully!")
        
        # Print final metrics
        final_accuracy = history.history['accuracy'][-1]
        final_val_accuracy = history.history['val_accuracy'][-1]
        
        print(f"\nFinal Training Accuracy: {final_accuracy:.4f}")
        print(f"Final Validation Accuracy: {final_val_accuracy:.4f}")
        print(f"Model saved to: {args.model_path}")
        
    else:
        logger.error("Training failed!")
        sys.exit(1)

if __name__ == '__main__':
    main()
