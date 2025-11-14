from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
import os
import tempfile
import logging
from werkzeug.utils import secure_filename
from werkzeug.security import check_password_hash, generate_password_hash
from deepfake_detector import DeepfakeDetector
import json
from datetime import datetime, timedelta
import pytz
import secrets
import sqlite3
from functools import wraps
import requests
import random
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
import base64
from io import BytesIO

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = secrets.token_hex(32)

# Database setup
DB_PATH = 'users.db'

def init_db():
    """Initialize the database with users table"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create history table
    c.execute('''
        CREATE TABLE IF NOT EXISTS history (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            action_type TEXT NOT NULL,
            file_name TEXT,
            prediction TEXT,
            confidence REAL,
            news_title TEXT,
            news_url TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            report_url TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    # Create reports table
    c.execute('''
        CREATE TABLE IF NOT EXISTS reports (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            file_name TEXT NOT NULL,
            prediction TEXT NOT NULL,
            confidence REAL NOT NULL,
            frames_analyzed INTEGER,
            report_url TEXT NOT NULL,
            model_version TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    # Create indexes for better query performance
    c.execute('CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at)')
    
    # Create analyses table
    c.execute('''
        CREATE TABLE IF NOT EXISTS analyses (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            file_name TEXT NOT NULL,
            prediction TEXT NOT NULL,
            confidence REAL NOT NULL,
            processing_time REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    # Create notifications table
    c.execute('''
        CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            type TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    # Create indexes for analyses and notifications
    c.execute('CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)')
    
    # Create admin_logs table for tracking admin actions
    c.execute('''
        CREATE TABLE IF NOT EXISTS admin_logs (
            id TEXT PRIMARY KEY,
            admin_id TEXT NOT NULL,
            admin_email TEXT NOT NULL,
            action TEXT NOT NULL,
            details TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (admin_id) REFERENCES users(id)
        )
    ''')
    
    c.execute('CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_admin_logs_timestamp ON admin_logs(timestamp)')
    
    # Create expert_requests table
    c.execute('''
        CREATE TABLE IF NOT EXISTS expert_requests (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            file_reference TEXT,
            description TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    # Create complaints table
    c.execute('''
        CREATE TABLE IF NOT EXISTS complaints (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            type TEXT NOT NULL,
            description TEXT NOT NULL,
            evidence_file TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    # Create subscriptions table
    c.execute('''
        CREATE TABLE IF NOT EXISTS subscriptions (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            email TEXT NOT NULL,
            subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_active INTEGER DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    # Create daily_tips table
    c.execute('''
        CREATE TABLE IF NOT EXISTS daily_tips (
            id TEXT PRIMARY KEY,
            tip_text TEXT NOT NULL,
            category TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create blogs table
    c.execute('''
        CREATE TABLE IF NOT EXISTS blogs (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            image_url TEXT,
            author TEXT NOT NULL,
            date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create forum_posts table
    c.execute('''
        CREATE TABLE IF NOT EXISTS forum_posts (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            username TEXT NOT NULL,
            topic TEXT NOT NULL,
            content TEXT NOT NULL,
            likes INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    # Create forum_comments table
    c.execute('''
        CREATE TABLE IF NOT EXISTS forum_comments (
            id TEXT PRIMARY KEY,
            post_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            username TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    # Create indexes
    c.execute('CREATE INDEX IF NOT EXISTS idx_expert_requests_user_id ON expert_requests(user_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_complaints_user_id ON complaints(user_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON subscriptions(email)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_daily_tips_is_active ON daily_tips(is_active)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_blogs_date ON blogs(date)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_forum_posts_user_id ON forum_posts(user_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_forum_posts_topic ON forum_posts(topic)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_forum_posts_created_at ON forum_posts(created_at)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_forum_comments_post_id ON forum_comments(post_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_forum_comments_user_id ON forum_comments(user_id)')
    
    # Insert default blogs if table is empty
    c.execute('SELECT COUNT(*) FROM blogs')
    if c.fetchone()[0] == 0:
        default_blogs = [
            (
                "How to Spot a Deepfake in 2025",
                """AI-generated faces are becoming increasingly realistic, but there are still telltale signs that can help you identify them. Look for unnatural blinking patterns, inconsistent lighting, or audio that doesn't match the video. Pay attention to facial movements that seem off, especially around the eyes and mouth. Remember, if something seems too good to be true, it might be.""",
                "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800",
                "Dr. Sarah Chen",
                "2025-01-15"
            ),
            (
                "Protecting Your Digital Identity Online",
                """Learn how to safeguard your content and report impersonation. Your digital identity is valuable, and protecting it requires vigilance. Use strong, unique passwords, enable two-factor authentication, and be cautious about what you share online. If you discover someone is impersonating you, document everything and report it immediately to the platform and relevant authorities.""",
                "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800",
                "Michael Torres",
                "2025-01-10"
            ),
            (
                "AI Ethics and the Future of Trust",
                """Understanding how AI shapes what we see and believe is crucial in today's digital landscape. As AI technology advances, we must remain critical consumers of media. Question sources, verify information through multiple channels, and stay informed about the latest detection techniques. Trust is earned, not given - especially in the age of AI.""",
                "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800",
                "Prof. James Wilson",
                "2025-01-05"
            ),
        ]
        for title, content, image_url, author, date in default_blogs:
            blog_id = secrets.token_hex(16)
            c.execute('''
                INSERT INTO blogs (id, title, content, image_url, author, date)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (blog_id, title, content, image_url, author, date))
        logger.info("Default blogs inserted")
    
    # Insert default daily tips if table is empty
    c.execute('SELECT COUNT(*) FROM daily_tips')
    if c.fetchone()[0] == 0:
        default_tips = [
            ("Verify media sources before sharing.", "verification"),
            ("Watch for unnatural blinking or inconsistent shadows.", "detection"),
            ("If unsure — reverse search or consult an expert.", "action"),
            ("Be skeptical of videos showing people saying things that seem out of character.", "awareness"),
            ("Check for inconsistencies in facial movements, lighting, or audio synchronization.", "detection"),
            ("Use reverse image search to verify if images or videos have been manipulated.", "verification"),
            ("Verify information through multiple trusted sources before believing viral videos.", "verification"),
            ("Pay attention to audio quality — deepfakes often have mismatched or synthetic audio.", "detection"),
            ("When in doubt, don't share — preventing the spread of misinformation is crucial.", "action"),
            ("Report suspected deepfakes to platform moderators to help protect others.", "action"),
        ]
        for tip_text, category in default_tips:
            tip_id = secrets.token_hex(16)
            c.execute('''
                INSERT INTO daily_tips (id, tip_text, category, is_active)
                VALUES (?, ?, ?, ?)
            ''', (tip_id, tip_text, category, 1))
        logger.info("Default daily tips inserted")
    
    # Insert default forum posts if table is empty
    c.execute('SELECT COUNT(*) FROM forum_posts')
    if c.fetchone()[0] == 0:
        # Get admin user ID for posts (we'll use admin user_id but with random Indian names)
        c.execute('SELECT id FROM users WHERE role = ? LIMIT 1', ('admin',))
        admin_user = c.fetchone()
        if admin_user:
            admin_id = admin_user[0]
            
            # Random Indian names
            indian_names = [
                "Priya Sharma", "Arjun Patel", "Ananya Reddy", "Rohan Kumar", "Kavya Nair",
                "Vikram Singh", "Meera Desai", "Aditya Joshi", "Sneha Iyer", "Rahul Menon",
                "Divya Rao", "Karan Malhotra", "Shreya Gupta", "Aman Verma", "Neha Kapoor"
            ]
            
            random.shuffle(indian_names)
            
            ist = pytz.timezone('Asia/Kolkata')
            current_time = datetime.now(ist)
            
            default_posts = [
                (
                    "Awareness",
                    "How can we better educate the general public about deepfake technology? I've noticed that many people still don't understand what deepfakes are or how to identify them. What are some effective ways to raise awareness in our communities?",
                    5
                ),
                (
                    "Awareness",
                    "I recently saw a video that I suspect might be a deepfake. The person's facial movements seemed slightly off, especially around the mouth area. Has anyone else noticed specific telltale signs that help identify deepfakes?",
                    3
                ),
                (
                    "Cyber Safety",
                    "What steps should I take if I discover someone has created a deepfake using my image or likeness? This is a serious privacy concern and I want to know the best practices for reporting and removing such content.",
                    8
                ),
                (
                    "Cyber Safety",
                    "Are there any tools or browser extensions that can help detect deepfakes in real-time? I'm looking for practical solutions to protect myself and my family from falling victim to deepfake scams.",
                    4
                ),
                (
                    "AI Technology",
                    "How advanced has deepfake technology become in 2025? I'm curious about the current state of AI-generated content and whether detection methods are keeping up with the technology.",
                    6
                ),
                (
                    "AI Technology",
                    "Can someone explain how deepfake detection algorithms work? I understand they use machine learning, but I'd like to know more about the technical aspects and what makes them effective.",
                    2
                ),
                (
                    "Law & Policy",
                    "What legal protections exist for victims of deepfake content? I'm concerned about the lack of clear legislation addressing this issue. Are there any countries with effective deepfake laws we should learn from?",
                    7
                ),
                (
                    "Law & Policy",
                    "Should there be stricter regulations on deepfake creation tools? While I understand the legitimate uses of this technology, I'm worried about its potential for misuse. What are your thoughts on balancing innovation with safety?",
                    4
                ),
                (
                    "General",
                    "Welcome to the DeepScan Community Forum! This is a space for discussing deepfake awareness, sharing experiences, and learning together. Feel free to ask questions, share tips, or start discussions on any related topic.",
                    12
                ),
                (
                    "General",
                    "Has anyone here successfully identified a deepfake in the wild? I'd love to hear about your experiences and what techniques you used to verify the authenticity of the content.",
                    5
                ),
            ]
            
            for idx, (topic, content, likes) in enumerate(default_posts):
                post_id = secrets.token_hex(16)
                timestamp_str = current_time.strftime('%Y-%m-%d %H:%M:%S')
                # Use different Indian name for each post
                username = indian_names[idx % len(indian_names)]
                # Offset time slightly for each post to make them appear at different times
                current_time = current_time - timedelta(hours=1)
                
                c.execute('''
                    INSERT INTO forum_posts (id, user_id, username, topic, content, likes, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (post_id, admin_id, username, topic, content, likes, timestamp_str))
            
            logger.info("Default forum posts inserted with Indian names")
    
    # Update existing posts that still have "Admin User" or admin email as username
    c.execute('SELECT COUNT(*) FROM forum_posts WHERE username IN (?, ?, ?)', ('Admin User', 'admin', 'admin@gmail.com'))
    existing_admin_posts = c.fetchone()[0]
    if existing_admin_posts > 0:
        indian_names = [
            "Priya Sharma", "Arjun Patel", "Ananya Reddy", "Rohan Kumar", "Kavya Nair",
            "Vikram Singh", "Meera Desai", "Aditya Joshi", "Sneha Iyer", "Rahul Menon",
            "Divya Rao", "Karan Malhotra", "Shreya Gupta", "Aman Verma", "Neha Kapoor"
        ]
        
        # Get all posts with admin usernames
        c.execute('SELECT id, username FROM forum_posts WHERE username IN (?, ?, ?)', ('Admin User', 'admin', 'admin@gmail.com'))
        admin_posts = c.fetchall()
        
        # Update each post with a random Indian name
        for idx, (post_id, old_username) in enumerate(admin_posts):
            new_username = indian_names[idx % len(indian_names)]
            c.execute('UPDATE forum_posts SET username = ? WHERE id = ?', (new_username, post_id))
        
        conn.commit()
        logger.info(f"Updated {len(admin_posts)} forum posts with Indian names")
    
    # Insert default comments for some forum posts if comments table is empty
    c.execute('SELECT COUNT(*) FROM forum_comments')
    if c.fetchone()[0] == 0:
        # Get some recent posts to add comments to
        c.execute('SELECT id FROM forum_posts ORDER BY created_at DESC LIMIT 5')
        posts_with_comments = c.fetchall()
        
        if posts_with_comments:
            # Indian names for comment authors
            comment_author_names = [
                "Rajesh Kumar", "Pooja Mehta", "Amit Shah", "Deepika Agarwal", "Siddharth Rao",
                "Nisha Patel", "Vivek Singh", "Riya Joshi", "Kunal Desai", "Anjali Nair"
            ]
            random.shuffle(comment_author_names)
            
            # Get admin user ID for comments
            c.execute('SELECT id FROM users WHERE role = ? LIMIT 1', ('admin',))
            admin_user = c.fetchone()
            if admin_user:
                admin_id = admin_user[0]
                
                ist = pytz.timezone('Asia/Kolkata')
                current_time = datetime.now(ist)
                
                # Comments for different posts
                comments_data = [
                    # Comments for first post (Awareness - education)
                    (
                        posts_with_comments[0][0],
                        "I think schools and colleges should include digital literacy programs that specifically cover deepfakes. Starting education early is key!",
                    ),
                    (
                        posts_with_comments[0][0],
                        "Social media platforms could also play a role by adding warning labels or verification badges. What do you all think?",
                    ),
                    # Comments for second post (Awareness - detection signs)
                    (
                        posts_with_comments[1][0] if len(posts_with_comments) > 1 else posts_with_comments[0][0],
                        "Yes! I've noticed that deepfakes often have issues with eye contact - the person's gaze might not match where they're looking.",
                    ),
                    (
                        posts_with_comments[1][0] if len(posts_with_comments) > 1 else posts_with_comments[0][0],
                        "Another sign is inconsistent lighting on the face compared to the background. Great observation!",
                    ),
                    # Comments for third post (Cyber Safety - reporting)
                    (
                        posts_with_comments[2][0] if len(posts_with_comments) > 2 else posts_with_comments[0][0],
                        "First, document everything - take screenshots, save URLs, and note timestamps. Then report to the platform immediately.",
                    ),
                    (
                        posts_with_comments[2][0] if len(posts_with_comments) > 2 else posts_with_comments[0][0],
                        "You should also consider filing a police report if it's causing harm. Many countries are updating their laws to address this.",
                    ),
                    # Comments for fourth post (AI Technology - advancement)
                    (
                        posts_with_comments[3][0] if len(posts_with_comments) > 3 else posts_with_comments[0][0],
                        "The technology has become incredibly sophisticated. Some deepfakes are now almost impossible to detect with the naked eye.",
                    ),
                    (
                        posts_with_comments[3][0] if len(posts_with_comments) > 3 else posts_with_comments[0][0],
                        "That's why we need better detection tools. This platform is a great step in that direction!",
                    ),
                    # Comments for fifth post (General - welcome)
                    (
                        posts_with_comments[4][0] if len(posts_with_comments) > 4 else posts_with_comments[0][0],
                        "Thanks for creating this space! It's so important to have a community where we can discuss these issues openly.",
                    ),
                    (
                        posts_with_comments[4][0] if len(posts_with_comments) > 4 else posts_with_comments[0][0],
                        "I'm looking forward to learning from everyone here. Let's keep the conversation going!",
                    ),
                ]
                
                for idx, (post_id, comment_content) in enumerate(comments_data):
                    comment_id = secrets.token_hex(16)
                    author_name = comment_author_names[idx % len(comment_author_names)]
                    timestamp_str = current_time.strftime('%Y-%m-%d %H:%M:%S')
                    # Offset time slightly for each comment
                    current_time = current_time - timedelta(minutes=10)
                    
                    c.execute('''
                        INSERT INTO forum_comments (id, post_id, user_id, username, content, created_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (comment_id, post_id, admin_id, author_name, comment_content, timestamp_str))
                
                conn.commit()
                logger.info(f"Inserted {len(comments_data)} default comments for forum posts")
    
    # Insert default admin user if not exists
    c.execute('SELECT COUNT(*) FROM users WHERE email = ?', ('admin@gmail.com',))
    if c.fetchone()[0] == 0:
        admin_id = secrets.token_hex(16)
        admin_password = generate_password_hash('admin@123')
        c.execute('''
            INSERT INTO users (id, email, password, role, name)
            VALUES (?, ?, ?, ?, ?)
        ''', (admin_id, 'admin@gmail.com', admin_password, 'admin', 'Admin User'))
        logger.info("Default admin user created: admin@gmail.com / admin@123")
    
    # Insert default normal user if not exists
    c.execute('SELECT COUNT(*) FROM users WHERE email = ?', ('apurva@gmail.com',))
    if c.fetchone()[0] == 0:
        user_id = secrets.token_hex(16)
        user_password = generate_password_hash('apurva@29')
        c.execute('''
            INSERT INTO users (id, email, password, role, name)
            VALUES (?, ?, ?, ?, ?)
        ''', (user_id, 'apurva@gmail.com', user_password, 'user', 'Apurva User'))
        logger.info("Default user created: apurva@gmail.com / apurva@29")
    
    conn.commit()
    conn.close()

# Initialize database on startup
init_db()

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    # SQLite foreign keys are disabled by default, but we'll handle them explicitly
    conn.execute('PRAGMA foreign_keys = ON')
    return conn

def verify_admin(user_id):
    """Verify that a user is an admin"""
    if not user_id:
        return False, None
    
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT id, email, role FROM users WHERE id = ?', (user_id,))
    user = c.fetchone()
    conn.close()
    
    if not user:
        return False, None
    
    user_id_db, email, role = user
    if role != 'admin':
        return False, None
    
    return True, {'id': user_id_db, 'email': email, 'role': role}

def log_admin_action(admin_id, admin_email, action, details=None):
    """Log an admin action to admin_logs table"""
    try:
        conn = get_db()
        c = conn.cursor()
        log_id = secrets.token_hex(16)
        
        ist = pytz.timezone('Asia/Kolkata')
        current_time = datetime.now(ist)
        timestamp_str = current_time.strftime('%Y-%m-%d %H:%M:%S')
        
        c.execute('''
            INSERT INTO admin_logs (id, admin_id, admin_email, action, details, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (log_id, admin_id, admin_email, action, details, timestamp_str))
        
        conn.commit()
        conn.close()
        logger.info(f"Admin action logged: {action} by {admin_email}")
    except Exception as e:
        logger.error(f"Failed to log admin action: {str(e)}")

def verify_token(f):
    """Decorator to verify JWT token"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(' ')[1]  # Bearer <token>
            except IndexError:
                pass
        
        if not token:
            return jsonify({
                'status': 'error',
                'message': 'Token is missing'
            }), 401
        
        # For now, we'll use a simple token validation
        # In production, use proper JWT tokens
        conn = get_db()
        c = conn.cursor()
        # Store tokens in a simple way (in production, use Redis or JWT)
        # For simplicity, we'll validate based on user session
        conn.close()
        
        return f(*args, **kwargs)
    return decorated_function

# Configuration
UPLOAD_FOLDER = 'uploads'
MODEL_PATH = 'models/deepfake_model_50e.h5'
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'webm', 'mkv'}

# Create necessary directories
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs('models', exist_ok=True)

# Initialize detector
detector = DeepfakeDetector()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/auth/login', methods=['POST'])
def login():
    """User login endpoint"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        if not email or not password:
            return jsonify({
                'status': 'error',
                'message': 'Email and password are required'
            }), 400
        
        conn = get_db()
        c = conn.cursor()
        c.execute('SELECT id, email, password, role, name FROM users WHERE email = ?', (email,))
        user = c.fetchone()
        conn.close()
        
        if not user:
            return jsonify({
                'status': 'error',
                'message': 'Invalid email or password'
            }), 401
        
        user_id, user_email, hashed_password, role, name = user
        
        if not check_password_hash(hashed_password, password):
            return jsonify({
                'status': 'error',
                'message': 'Invalid email or password'
            }), 401
        
        # Generate token (in production, use JWT)
        token = secrets.token_hex(32)
        
        return jsonify({
            'status': 'success',
            'message': 'Login successful',
            'user': {
                'id': user_id,
                'email': user_email,
                'role': role,
                'name': name or user_email.split('@')[0]
            },
            'token': token
        })
        
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Login failed. Please try again.'
        }), 500

@app.route('/api/auth/verify', methods=['POST'])
def verify_token_endpoint():
    """Verify authentication token"""
    try:
        data = request.get_json()
        token = data.get('token')
        
        if not token:
            return jsonify({
                'status': 'error',
                'message': 'Token is required'
            }), 400
        
        # In production, decode and verify JWT token
        # For now, we'll accept any token format
        # You can enhance this with proper JWT validation
        
        return jsonify({
            'status': 'success',
            'message': 'Token is valid'
        })
        
    except Exception as e:
        logger.error(f"Token verification error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Token verification failed'
        }), 401

@app.route('/api/news', methods=['GET'])
def get_news():
    """Proxy endpoint to fetch news from NewsAPI (avoids CORS issues)"""
    try:
        api_key = request.args.get('apiKey')
        query = request.args.get('q', 'deepfake')
        language = request.args.get('language', 'en')
        sort_by = request.args.get('sortBy', 'publishedAt')
        page_size = request.args.get('pageSize', '15')
        
        if not api_key:
            return jsonify({
                'status': 'error',
                'message': 'API key is required'
            }), 400
        
        # Build NewsAPI URL
        news_api_url = f"https://newsapi.org/v2/everything"
        params = {
            'q': query,
            'language': language,
            'sortBy': sort_by,
            'pageSize': page_size,
            'apiKey': api_key
        }
        
        # Fetch from NewsAPI
        response = requests.get(news_api_url, params=params, timeout=10)
        
        if response.status_code != 200:
            return jsonify({
                'status': 'error',
                'message': f'NewsAPI request failed: {response.status_code}',
                'details': response.text
            }), response.status_code
        
        data = response.json()
        
        # Check for NewsAPI errors
        if data.get('status') == 'error':
            return jsonify({
                'status': 'error',
                'message': data.get('message', 'Failed to fetch news')
            }), 400
        
        # Return articles
        return jsonify({
            'status': 'success',
            'articles': data.get('articles', []),
            'totalResults': data.get('totalResults', 0)
        })
        
    except requests.exceptions.Timeout:
        return jsonify({
            'status': 'error',
            'message': 'Request timeout. Please try again later.'
        }), 504
    except requests.exceptions.RequestException as e:
        logger.error(f"NewsAPI request error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch news: {str(e)}'
        }), 500
    except Exception as e:
        logger.error(f"News endpoint error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'An error occurred while fetching news'
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'success',
        'result': {
            'timestamp': datetime.now().isoformat(),
            'model_loaded': detector.model is not None
        }
    })

@app.route('/api/train', methods=['POST'])
def train_model():
    """Train the deepfake detection model"""
    try:
        data = request.get_json()
        dataset_path = data.get('dataset_path', '../UADFV')
        epochs = data.get('epochs', 30)
        
        logger.info(f"Starting training with dataset: {dataset_path}")
        
        # Train model
        history = detector.train_model(dataset_path, epochs=epochs)
        
        if history is not None:
            # Save model
            detector.save_model(MODEL_PATH)
            
            # Get training metrics
            final_accuracy = history.history['accuracy'][-1]
            final_val_accuracy = history.history['val_accuracy'][-1]
            
            return jsonify({
                'status': 'success',
                'message': 'Model trained successfully',
                'final_accuracy': final_accuracy,
                'final_val_accuracy': final_val_accuracy,
                'epochs_trained': len(history.history['accuracy'])
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Training failed'
            }), 500
            
    except Exception as e:
        logger.error(f"Training error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Training failed: {str(e)}'
        }), 500

@app.route('/api/load-model', methods=['POST'])
def load_model():
    """Load a pre-trained model"""
    try:
        data = request.get_json()
        model_path = data.get('model_path', MODEL_PATH)
        
        detector.load_model(model_path)
        
        return jsonify({
            'status': 'success',
            'message': 'Model loaded successfully',
            'model_path': model_path
        })
        
    except Exception as e:
        logger.error(f"Model loading error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Model loading failed: {str(e)}'
        }), 500

@app.route('/api/predict', methods=['POST'])
def predict_video():
    """Predict if uploaded video contains deepfakes"""
    try:
        if 'file' not in request.files:
            return jsonify({
                'status': 'error',
                'message': 'No file uploaded'
            }), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({
                'status': 'error',
                'message': 'No file selected'
            }), 400
        
        if not allowed_file(file.filename):
            return jsonify({
                'status': 'error',
                'message': 'Invalid file type. Supported formats: MP4, AVI, MOV, WebM, MKV'
            }), 400
        
        if detector.model is None:
            return jsonify({
                'status': 'error',
                'message': 'Model not loaded. Please train or load a model first.'
            }), 400
        
        # Save uploaded file
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{timestamp}_{filename}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        logger.info(f"Processing video: {filename}")
        
        # Predict
        result = detector.predict_video(filepath)
        
        if result is not None:
            # Clean up uploaded file
            os.remove(filepath)
            
            return jsonify({
                'status': 'success',
                'result': result,
                'filename': file.filename
            })
        else:
            # Clean up uploaded file
            os.remove(filepath)
            
            return jsonify({
                'status': 'error',
                'message': 'Failed to process video'
            }), 500
            
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Prediction failed: {str(e)}'
        }), 500

@app.route('/api/model-info', methods=['GET'])
def model_info():
    """Get information about the current model"""
    if detector.model is None:
        return jsonify({
            'status': 'error',
            'message': 'No model loaded'
        }), 400
    
    try:
        model_summary = []
        detector.model.summary(print_fn=lambda x: model_summary.append(x))
        
        return jsonify({
            'status': 'success',
            'model_loaded': True,
            'input_shape': detector.input_shape,
            'num_classes': detector.num_classes,
            'model_summary': '\n'.join(model_summary)
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Failed to get model info: {str(e)}'
        }), 500

@app.route('/api/evaluate', methods=['POST'])
def evaluate_model():
    """Evaluate model performance on test dataset"""
    try:
        data = request.get_json()
        dataset_path = data.get('dataset_path', '../UADFV')
        
        if detector.model is None:
            return jsonify({
                'status': 'error',
                'message': 'No model loaded'
            }), 400
        
        # Evaluate model
        report, cm = detector.evaluate_model(dataset_path)
        
        return jsonify({
            'status': 'success',
            'classification_report': report,
            'confusion_matrix': cm.tolist()
        })
        
    except Exception as e:
        logger.error(f"Evaluation error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Evaluation failed: {str(e)}'
        }), 500

@app.errorhandler(413)
def too_large(e):
    return jsonify({
        'status': 'error',
        'message': 'File too large. Maximum size is 500MB.'
    }), 413

@app.errorhandler(404)
def not_found(e):
    return jsonify({
        'status': 'error',
        'message': 'Endpoint not found'
    }), 404

@app.route('/api/generate-report', methods=['POST'])
def generate_report():
    """Generate PDF report for deepfake detection results"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['filename', 'prediction', 'confidence', 'frames_analyzed', 'fake_probability', 'real_probability']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'status': 'error',
                    'message': f'Missing required field: {field}'
                }), 400
        
        filename = data.get('filename', 'unknown_video')
        prediction = data.get('prediction', 'unknown')
        confidence = float(data.get('confidence', 0))
        frames_analyzed = int(data.get('frames_analyzed', 0))
        fake_probability = float(data.get('fake_probability', 0))
        real_probability = float(data.get('real_probability', 0))
        chart_image_base64 = data.get('chart_image', None)
        model_version = data.get('model_version', 'deepfake_model.h5')
        
        # Create PDF in memory
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
        story = []
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1a1a1a'),
            spaceAfter=30,
            alignment=TA_CENTER
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#333333'),
            spaceAfter=12,
            spaceBefore=12
        )
        
        normal_style = ParagraphStyle(
            'CustomNormal',
            parent=styles['Normal'],
            fontSize=11,
            textColor=colors.HexColor('#555555'),
            spaceAfter=8
        )
        
        # Title
        story.append(Paragraph("Deepfake Detection Report", title_style))
        story.append(Spacer(1, 0.3*inch))
        
        # Report metadata table
        report_data = [
            ['File Name:', filename],
            ['Prediction:', prediction.upper()],
            ['Confidence:', f'{(confidence * 100):.1f}%'],
            ['Frames Analyzed:', str(frames_analyzed)],
            ['Model Version:', model_version],
            ['Report Generated:', datetime.now().strftime('%Y-%m-%d %H:%M:%S')]
        ]
        
        report_table = Table(report_data, colWidths=[2*inch, 4*inch])
        report_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f0f0f0')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ]))
        story.append(report_table)
        story.append(Spacer(1, 0.3*inch))
        
        # Probability breakdown
        story.append(Paragraph("Probability Breakdown", heading_style))
        prob_data = [
            ['Category', 'Probability'],
            ['Real Probability', f'{(real_probability * 100):.2f}%'],
            ['Fake Probability', f'{(fake_probability * 100):.2f}%']
        ]
        
        prob_table = Table(prob_data, colWidths=[3*inch, 3*inch])
        prob_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4a5568')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('BACKGROUND', (0, 1), (0, 1), colors.HexColor('#22c55e') if real_probability > fake_probability else colors.HexColor('#ef4444')),
            ('BACKGROUND', (0, 2), (0, 2), colors.HexColor('#ef4444') if fake_probability > real_probability else colors.HexColor('#22c55e')),
        ]))
        story.append(prob_table)
        story.append(Spacer(1, 0.3*inch))
        
        # Chart image (if provided)
        if chart_image_base64:
            try:
                # Decode base64 image
                chart_data = base64.b64decode(chart_image_base64.split(',')[1] if ',' in chart_image_base64 else chart_image_base64)
                chart_img = Image(BytesIO(chart_data), width=5*inch, height=3*inch)
                story.append(Paragraph("Frame-by-Frame Confidence Analysis", heading_style))
                story.append(chart_img)
                story.append(Spacer(1, 0.2*inch))
            except Exception as e:
                logger.warning(f"Failed to embed chart image: {e}")
        
        # Summary
        story.append(Paragraph("Analysis Summary", heading_style))
        
        if prediction.lower() == 'fake':
            summary_text = f"The analysis suggests this video is likely a deepfake based on frame inconsistencies and AI detection patterns. The model detected {fake_probability*100:.1f}% probability of the content being artificially generated. {frames_analyzed} frames were analyzed with an overall confidence of {confidence*100:.1f}%."
        else:
            summary_text = f"The analysis suggests this video is likely authentic. The model detected {real_probability*100:.1f}% probability of the content being genuine. {frames_analyzed} frames were analyzed with an overall confidence of {confidence*100:.1f}%."
        
        story.append(Paragraph(summary_text, normal_style))
        story.append(Spacer(1, 0.2*inch))
        
        # Footer note
        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=9,
            textColor=colors.HexColor('#888888'),
            alignment=TA_CENTER,
            spaceBefore=20
        )
        story.append(Spacer(1, 0.3*inch))
        story.append(Paragraph("This report was generated automatically by the Deepfake Detection System.", footer_style))
        story.append(Paragraph("For questions or concerns, please contact the system administrator.", footer_style))
        
        # Build PDF
        doc.build(story)
        
        # Get PDF bytes
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        # Create response
        response = Response(
            pdf_bytes,
            mimetype='application/pdf',
            headers={
                'Content-Disposition': f'attachment; filename=deepfake_report_{secure_filename(filename)}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf'
            }
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Report generation error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to generate report: {str(e)}'
        }), 500

@app.route('/api/history', methods=['POST'])
def create_history():
    """Record a history action"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        action_type = data.get('action_type')
        
        if not user_id or not action_type:
            return jsonify({
                'status': 'error',
                'message': 'user_id and action_type are required'
            }), 400
        
        if action_type not in ['scan', 'news_view']:
            return jsonify({
                'status': 'error',
                'message': 'action_type must be "scan" or "news_view"'
            }), 400
        
        # Verify user exists
        conn = get_db()
        c = conn.cursor()
        c.execute('SELECT id FROM users WHERE id = ?', (user_id,))
        if not c.fetchone():
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'User not found'
            }), 404
        
        # Create history entry
        history_id = secrets.token_hex(16)
        
        # Get current time in IST
        ist = pytz.timezone('Asia/Kolkata')
        current_time = datetime.now(ist)
        timestamp_str = current_time.strftime('%Y-%m-%d %H:%M:%S')
        
        if action_type == 'scan':
            file_name = data.get('file_name')
            prediction = data.get('prediction')
            confidence = data.get('confidence')
            report_url = data.get('report_url')
            
            c.execute('''
                INSERT INTO history (id, user_id, action_type, file_name, prediction, confidence, report_url, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (history_id, user_id, action_type, file_name, prediction, confidence, report_url, timestamp_str))
        else:  # news_view
            news_title = data.get('news_title')
            news_url = data.get('news_url')
            
            c.execute('''
                INSERT INTO history (id, user_id, action_type, news_title, news_url, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (history_id, user_id, action_type, news_title, news_url, timestamp_str))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'message': 'History recorded successfully',
            'history_id': history_id
        })
        
    except Exception as e:
        logger.error(f"History creation error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to record history: {str(e)}'
        }), 500

@app.route('/api/history/<user_id>', methods=['GET'])
def get_history(user_id):
    """Get history for a specific user"""
    try:
        # Verify user exists
        conn = get_db()
        c = conn.cursor()
        c.execute('SELECT id FROM users WHERE id = ?', (user_id,))
        if not c.fetchone():
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'User not found'
            }), 404
        
        # Get history entries sorted by timestamp DESC
        c.execute('''
            SELECT id, action_type, file_name, prediction, confidence, 
                   news_title, news_url, timestamp, report_url
            FROM history
            WHERE user_id = ?
            ORDER BY timestamp DESC
        ''', (user_id,))
        
        rows = c.fetchall()
        conn.close()
        
        history = []
        for row in rows:
            history.append({
                'id': row[0],
                'action_type': row[1],
                'file_name': row[2],
                'prediction': row[3],
                'confidence': row[4],
                'news_title': row[5],
                'news_url': row[6],
                'timestamp': row[7],
                'report_url': row[8]
            })
        
        return jsonify({
            'status': 'success',
            'history': history
        })
        
    except Exception as e:
        logger.error(f"History fetch error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch history: {str(e)}'
        }), 500

@app.route('/api/reports', methods=['POST'])
def create_report():
    """Save a new report record"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        file_name = data.get('file_name')
        prediction = data.get('prediction')
        confidence = data.get('confidence')
        report_url = data.get('report_url')
        
        if not user_id or not file_name or not prediction or not confidence or not report_url:
            return jsonify({
                'status': 'error',
                'message': 'Missing required fields: user_id, file_name, prediction, confidence, report_url'
            }), 400
        
        # Verify user exists
        conn = get_db()
        c = conn.cursor()
        c.execute('SELECT id FROM users WHERE id = ?', (user_id,))
        if not c.fetchone():
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'User not found'
            }), 404
        
        # Get current time in IST
        ist = pytz.timezone('Asia/Kolkata')
        current_time = datetime.now(ist)
        timestamp_str = current_time.strftime('%Y-%m-%d %H:%M:%S')
        
        # Create report entry
        report_id = secrets.token_hex(16)
        frames_analyzed = data.get('frames_analyzed')
        model_version = data.get('model_version', 'deepfake_model.h5')
        
        c.execute('''
            INSERT INTO reports (id, user_id, file_name, prediction, confidence, frames_analyzed, report_url, model_version, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (report_id, user_id, file_name, prediction, confidence, frames_analyzed, report_url, model_version, timestamp_str))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'message': 'Report saved successfully',
            'report_id': report_id
        })
        
    except Exception as e:
        logger.error(f"Report creation error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to save report: {str(e)}'
        }), 500

@app.route('/api/reports/<user_id>', methods=['GET'])
def get_user_reports(user_id):
    """Get all reports for a specific user"""
    try:
        # Verify user exists
        conn = get_db()
        c = conn.cursor()
        c.execute('SELECT id, role FROM users WHERE id = ?', (user_id,))
        user = c.fetchone()
        if not user:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'User not found'
            }), 404
        
        # Get reports for the user, sorted by created_at DESC
        c.execute('''
            SELECT id, file_name, prediction, confidence, frames_analyzed, 
                   report_url, model_version, created_at
            FROM reports
            WHERE user_id = ?
            ORDER BY created_at DESC
        ''', (user_id,))
        
        rows = c.fetchall()
        conn.close()
        
        reports = []
        for row in rows:
            reports.append({
                'id': row[0],
                'file_name': row[1],
                'prediction': row[2],
                'confidence': row[3],
                'frames_analyzed': row[4],
                'report_url': row[5],
                'model_version': row[6],
                'created_at': row[7]
            })
        
        return jsonify({
            'status': 'success',
            'reports': reports
        })
        
    except Exception as e:
        logger.error(f"Reports fetch error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch reports: {str(e)}'
        }), 500

@app.route('/api/reports', methods=['GET'])
def get_all_reports():
    """Get all reports (admin only)"""
    try:
        # Check for admin authorization
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({
                'status': 'error',
                'message': 'user_id is required'
            }), 400
        
        # Verify user exists and is admin
        conn = get_db()
        c = conn.cursor()
        c.execute('SELECT id, role FROM users WHERE id = ?', (user_id,))
        user = c.fetchone()
        if not user:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'User not found'
            }), 404
        
        if user[1] != 'admin':
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Admin access required'
            }), 403
        
        # Get all reports with user info, sorted by created_at DESC
        c.execute('''
            SELECT r.id, r.user_id, u.email, u.name, r.file_name, r.prediction, 
                   r.confidence, r.frames_analyzed, r.report_url, r.model_version, r.created_at
            FROM reports r
            JOIN users u ON r.user_id = u.id
            ORDER BY r.created_at DESC
        ''')
        
        rows = c.fetchall()
        conn.close()
        
        reports = []
        for row in rows:
            reports.append({
                'id': row[0],
                'user_id': row[1],
                'user_email': row[2],
                'user_name': row[3],
                'file_name': row[4],
                'prediction': row[5],
                'confidence': row[6],
                'frames_analyzed': row[7],
                'report_url': row[8],
                'model_version': row[9],
                'created_at': row[10]
            })
        
        return jsonify({
            'status': 'success',
            'reports': reports
        })
        
    except Exception as e:
        logger.error(f"All reports fetch error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch reports: {str(e)}'
        }), 500

@app.route('/api/dashboard/<user_id>', methods=['GET'])
def get_dashboard(user_id):
    """Get dashboard data for a specific user"""
    try:
        # Verify user exists
        conn = get_db()
        c = conn.cursor()
        c.execute('SELECT id, role FROM users WHERE id = ?', (user_id,))
        user = c.fetchone()
        if not user:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'User not found'
            }), 404
        
        user_role = user[1]
        
        # Get total analyses count
        if user_role == 'admin':
            c.execute('SELECT COUNT(*) FROM analyses')
            total_analyses = c.fetchone()[0]
            
            c.execute('SELECT COUNT(*) FROM analyses WHERE prediction = ?', ('FAKE',))
            deepfakes_detected = c.fetchone()[0]
            
            c.execute('SELECT AVG(confidence) FROM analyses')
            avg_confidence = c.fetchone()[0] or 0
            accuracy_rate = avg_confidence * 100
            
            c.execute('SELECT AVG(processing_time) FROM analyses WHERE processing_time IS NOT NULL')
            avg_processing_time = c.fetchone()[0] or 0
            
            # Get recent analyses (all users)
            c.execute('''
                SELECT a.id, a.file_name, a.prediction, a.confidence, a.created_at, a.processing_time
                FROM analyses a
                ORDER BY a.created_at DESC
                LIMIT 10
            ''')
        else:
            c.execute('SELECT COUNT(*) FROM analyses WHERE user_id = ?', (user_id,))
            total_analyses = c.fetchone()[0]
            
            c.execute('SELECT COUNT(*) FROM analyses WHERE user_id = ? AND prediction = ?', (user_id, 'FAKE'))
            deepfakes_detected = c.fetchone()[0]
            
            c.execute('SELECT AVG(confidence) FROM analyses WHERE user_id = ?', (user_id,))
            avg_confidence = c.fetchone()[0] or 0
            accuracy_rate = avg_confidence * 100
            
            c.execute('SELECT AVG(processing_time) FROM analyses WHERE user_id = ? AND processing_time IS NOT NULL', (user_id,))
            avg_processing_time = c.fetchone()[0] or 0
            
            # Get recent analyses (user-specific)
            c.execute('''
                SELECT id, file_name, prediction, confidence, created_at, processing_time
                FROM analyses
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT 10
            ''', (user_id,))
        
        recent_rows = c.fetchall()
        recent_analyses = []
        for row in recent_rows:
            recent_analyses.append({
                'id': row[0],
                'file_name': row[1],
                'prediction': row[2],
                'confidence': row[3],
                'created_at': row[4],
                'processing_time': row[5]
            })
        
        # Get notifications (user-specific + global)
        c.execute('''
            SELECT id, title, message, type, timestamp, is_read
            FROM notifications
            WHERE user_id = ? OR user_id IS NULL
            ORDER BY timestamp DESC
            LIMIT 10
        ''', (user_id,))
        
        notification_rows = c.fetchall()
        notifications = []
        for row in notification_rows:
            notifications.append({
                'id': row[0],
                'title': row[1],
                'message': row[2],
                'type': row[3],
                'timestamp': row[4],
                'is_read': bool(row[5])
            })
        
        conn.close()
        
        return jsonify({
            'status': 'success',
            'totalAnalyses': total_analyses,
            'deepfakesDetected': deepfakes_detected,
            'accuracyRate': round(accuracy_rate, 1),
            'avgProcessingTime': round(avg_processing_time, 1),
            'recentAnalyses': recent_analyses,
            'notifications': notifications
        })
        
    except Exception as e:
        logger.error(f"Dashboard fetch error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch dashboard data: {str(e)}'
        }), 500

@app.route('/api/notifications/<user_id>', methods=['GET'])
def get_notifications(user_id):
    """Get notifications for a specific user"""
    try:
        conn = get_db()
        c = conn.cursor()
        
        # Get notifications (user-specific + global)
        c.execute('''
            SELECT id, title, message, type, timestamp, is_read
            FROM notifications
            WHERE user_id = ? OR user_id IS NULL
            ORDER BY timestamp DESC
            LIMIT 50
        ''', (user_id,))
        
        rows = c.fetchall()
        conn.close()
        
        notifications = []
        for row in rows:
            notifications.append({
                'id': row[0],
                'title': row[1],
                'message': row[2],
                'type': row[3],
                'timestamp': row[4],
                'is_read': bool(row[5])
            })
        
        return jsonify({
            'status': 'success',
            'notifications': notifications
        })
        
    except Exception as e:
        logger.error(f"Notifications fetch error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch notifications: {str(e)}'
        }), 500

@app.route('/api/notifications/<notification_id>', methods=['PATCH'])
def mark_notification_read(notification_id):
    """Mark a notification as read"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({
                'status': 'error',
                'message': 'user_id is required'
            }), 400
        
        conn = get_db()
        c = conn.cursor()
        
        # Verify notification exists and belongs to user or is global
        c.execute('SELECT user_id FROM notifications WHERE id = ?', (notification_id,))
        notif = c.fetchone()
        
        if not notif:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Notification not found'
            }), 404
        
        # Update notification
        c.execute('''
            UPDATE notifications
            SET is_read = 1
            WHERE id = ? AND (user_id = ? OR user_id IS NULL)
        ''', (notification_id, user_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'message': 'Notification marked as read'
        })
        
    except Exception as e:
        logger.error(f"Notification update error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to update notification: {str(e)}'
        }), 500

@app.route('/api/analyses', methods=['POST'])
def create_analysis():
    """Record a new analysis"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        file_name = data.get('file_name')
        prediction = data.get('prediction')
        confidence = data.get('confidence')
        processing_time = data.get('processing_time')
        
        if not user_id or not file_name or not prediction or not confidence:
            return jsonify({
                'status': 'error',
                'message': 'Missing required fields'
            }), 400
        
        # Verify user exists
        conn = get_db()
        c = conn.cursor()
        c.execute('SELECT id FROM users WHERE id = ?', (user_id,))
        if not c.fetchone():
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'User not found'
            }), 404
        
        # Get current time in IST
        ist = pytz.timezone('Asia/Kolkata')
        current_time = datetime.now(ist)
        timestamp_str = current_time.strftime('%Y-%m-%d %H:%M:%S')
        
        # Create analysis entry
        analysis_id = secrets.token_hex(16)
        
        c.execute('''
            INSERT INTO analyses (id, user_id, file_name, prediction, confidence, processing_time, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (analysis_id, user_id, file_name, prediction, confidence, processing_time, timestamp_str))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'message': 'Analysis recorded successfully',
            'analysis_id': analysis_id
        })
        
    except Exception as e:
        logger.error(f"Analysis creation error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to record analysis: {str(e)}'
        }), 500

@app.route('/api/admin/reset-data', methods=['POST'])
def reset_user_data():
    """Reset all user data (admin only) - Deletes all analyses, reports, history, and notifications"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({
                'status': 'error',
                'message': 'user_id is required'
            }), 400
        
        # Verify admin access
        is_admin, admin_info = verify_admin(user_id)
        if not is_admin:
            return jsonify({
                'status': 'error',
                'message': 'Admin access required'
            }), 403
        
        admin_id = admin_info['id']
        admin_email = admin_info['email']
        
        conn = get_db()
        # Disable foreign key constraints temporarily to allow deletion
        conn.execute('PRAGMA foreign_keys = OFF')
        c = conn.cursor()
        
        # Get counts before deletion for logging
        c.execute('SELECT COUNT(*) FROM analyses')
        analyses_count = c.fetchone()[0]
        
        c.execute('SELECT COUNT(*) FROM reports')
        reports_count = c.fetchone()[0]
        
        c.execute('SELECT COUNT(*) FROM history')
        history_count = c.fetchone()[0]
        
        c.execute('SELECT COUNT(*) FROM notifications')
        notifications_count = c.fetchone()[0]
        
        # Delete all data from tables (keeping users table intact)
        # Delete in order to respect foreign key dependencies
        logger.info(f"Deleting data: {analyses_count} analyses, {reports_count} reports, {history_count} history, {notifications_count} notifications")
        
        c.execute('DELETE FROM analyses')
        deleted_analyses = c.rowcount
        c.execute('DELETE FROM reports')
        deleted_reports = c.rowcount
        c.execute('DELETE FROM history')
        deleted_history = c.rowcount
        c.execute('DELETE FROM notifications')
        deleted_notifications = c.rowcount
        
        logger.info(f"Deleted rows: {deleted_analyses} analyses, {deleted_reports} reports, {deleted_history} history, {deleted_notifications} notifications")
        
        # Commit deletions immediately
        conn.commit()
        
        # Verify deletion was successful
        c.execute('SELECT COUNT(*) FROM analyses')
        remaining_analyses = c.fetchone()[0]
        c.execute('SELECT COUNT(*) FROM reports')
        remaining_reports = c.fetchone()[0]
        c.execute('SELECT COUNT(*) FROM history')
        remaining_history = c.fetchone()[0]
        c.execute('SELECT COUNT(*) FROM notifications')
        remaining_notifications = c.fetchone()[0]
        
        logger.info(f"Verification counts: {remaining_analyses} analyses, {remaining_reports} reports, {remaining_history} history, {remaining_notifications} notifications remaining")
        
        if remaining_analyses > 0 or remaining_reports > 0 or remaining_history > 0 or remaining_notifications > 0:
            error_msg = f"Deletion incomplete. Remaining: {remaining_analyses} analyses, {remaining_reports} reports, {remaining_history} history, {remaining_notifications} notifications"
            logger.error(error_msg)
            conn.close()
            return jsonify({
                'status': 'error',
                'message': error_msg
            }), 500
        
        # Re-enable foreign key constraints
        conn.execute('PRAGMA foreign_keys = ON')
        
        # Create new user: mantasha@gmail.com
        c.execute('SELECT COUNT(*) FROM users WHERE email = ?', ('mantasha@gmail.com',))
        if c.fetchone()[0] == 0:
            new_user_id = secrets.token_hex(16)
            new_user_password = generate_password_hash('mantasha@123')
            c.execute('''
                INSERT INTO users (id, email, password, role, name)
                VALUES (?, ?, ?, ?, ?)
            ''', (new_user_id, 'mantasha@gmail.com', new_user_password, 'user', 'Mantasha User'))
            logger.info("New user created: mantasha@gmail.com / mantasha@123")
        else:
            logger.info("User mantasha@gmail.com already exists, skipping creation")
        
        # Log the admin action
        details = f"Deleted {analyses_count} analyses, {reports_count} reports, {history_count} history entries, {notifications_count} notifications"
        log_admin_action(admin_id, admin_email, 'RESET_USER_DATA', details)
        
        conn.commit()
        conn.close()
        
        logger.info(f"User data reset completed by admin: {admin_email}. Verified: all data cleared.")
        
        return jsonify({
            'status': 'success',
            'message': 'All user data cleared. New user added.',
            'deleted': {
                'analyses': analyses_count,
                'reports': reports_count,
                'history': history_count,
                'notifications': notifications_count
            }
        })
        
    except Exception as e:
        logger.error(f"Reset data error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to reset data: {str(e)}'
        }), 500

@app.route('/api/admin/users', methods=['GET'])
def get_all_users():
    """Get all users with statistics (admin only)"""
    try:
        user_id = request.args.get('admin_id')
        
        if not user_id:
            return jsonify({
                'status': 'error',
                'message': 'admin_id is required'
            }), 400
        
        # Verify admin access
        is_admin, admin_info = verify_admin(user_id)
        if not is_admin:
            return jsonify({
                'status': 'error',
                'message': 'Admin access required'
            }), 403
        
        conn = get_db()
        c = conn.cursor()
        
        # Get all users with their statistics
        c.execute('''
            SELECT 
                u.id,
                u.email,
                u.name,
                u.role,
                u.created_at,
                COUNT(DISTINCT a.id) as total_analyses,
                COUNT(DISTINCT r.id) as total_reports
            FROM users u
            LEFT JOIN analyses a ON u.id = a.user_id
            LEFT JOIN reports r ON u.id = r.user_id
            GROUP BY u.id, u.email, u.name, u.role, u.created_at
            ORDER BY u.created_at DESC
        ''')
        
        rows = c.fetchall()
        conn.close()
        
        users = []
        for row in rows:
            users.append({
                'id': row[0],
                'email': row[1],
                'name': row[2] or row[1].split('@')[0],
                'role': row[3],
                'created_at': row[4],
                'total_analyses': row[5],
                'total_reports': row[6]
            })
        
        return jsonify({
            'status': 'success',
            'users': users,
            'total_users': len(users)
        })
        
    except Exception as e:
        logger.error(f"Get users error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch users: {str(e)}'
        }), 500

@app.route('/api/admin/users/<user_id>', methods=['GET'])
def get_user_details(user_id):
    """Get detailed user information (admin only)"""
    try:
        admin_id = request.args.get('admin_id')
        
        if not admin_id:
            return jsonify({
                'status': 'error',
                'message': 'admin_id is required'
            }), 400
        
        # Verify admin access
        is_admin, admin_info = verify_admin(admin_id)
        if not is_admin:
            return jsonify({
                'status': 'error',
                'message': 'Admin access required'
            }), 403
        
        conn = get_db()
        c = conn.cursor()
        
        # Get user info
        c.execute('SELECT id, email, name, role, created_at FROM users WHERE id = ?', (user_id,))
        user = c.fetchone()
        
        if not user:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'User not found'
            }), 404
        
        # Get recent analyses
        c.execute('''
            SELECT id, file_name, prediction, confidence, created_at, processing_time
            FROM analyses
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 10
        ''', (user_id,))
        analyses_rows = c.fetchall()
        
        # Get recent reports
        c.execute('''
            SELECT id, file_name, prediction, confidence, created_at, report_url
            FROM reports
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 10
        ''', (user_id,))
        reports_rows = c.fetchall()
        
        conn.close()
        
        recent_analyses = []
        for row in analyses_rows:
            recent_analyses.append({
                'id': row[0],
                'file_name': row[1],
                'prediction': row[2],
                'confidence': row[3],
                'created_at': row[4],
                'processing_time': row[5]
            })
        
        recent_reports = []
        for row in reports_rows:
            recent_reports.append({
                'id': row[0],
                'file_name': row[1],
                'prediction': row[2],
                'confidence': row[3],
                'created_at': row[4],
                'report_url': row[5]
            })
        
        return jsonify({
            'status': 'success',
            'user': {
                'id': user[0],
                'email': user[1],
                'name': user[2] or user[1].split('@')[0],
                'role': user[3],
                'created_at': user[4]
            },
            'recent_analyses': recent_analyses,
            'recent_reports': recent_reports
        })
        
    except Exception as e:
        logger.error(f"Get user details error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch user details: {str(e)}'
        }), 500

@app.route('/api/admin/users/<user_id>/reset', methods=['POST'])
def reset_user_data_single(user_id):
    """Reset data for a specific user (admin only)"""
    try:
        data = request.get_json()
        admin_id = data.get('admin_id')
        
        if not admin_id:
            return jsonify({
                'status': 'error',
                'message': 'admin_id is required'
            }), 400
        
        # Verify admin access
        is_admin, admin_info = verify_admin(admin_id)
        if not is_admin:
            return jsonify({
                'status': 'error',
                'message': 'Admin access required'
            }), 403
        
        # Verify target user exists
        conn = get_db()
        c = conn.cursor()
        c.execute('SELECT id, email FROM users WHERE id = ?', (user_id,))
        target_user = c.fetchone()
        
        if not target_user:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'User not found'
            }), 404
        
        # Get counts before deletion
        c.execute('SELECT COUNT(*) FROM analyses WHERE user_id = ?', (user_id,))
        analyses_count = c.fetchone()[0]
        
        c.execute('SELECT COUNT(*) FROM reports WHERE user_id = ?', (user_id,))
        reports_count = c.fetchone()[0]
        
        c.execute('SELECT COUNT(*) FROM history WHERE user_id = ?', (user_id,))
        history_count = c.fetchone()[0]
        
        c.execute('SELECT COUNT(*) FROM notifications WHERE user_id = ?', (user_id,))
        notifications_count = c.fetchone()[0]
        
        # Delete user's data
        c.execute('DELETE FROM analyses WHERE user_id = ?', (user_id,))
        c.execute('DELETE FROM reports WHERE user_id = ?', (user_id,))
        c.execute('DELETE FROM history WHERE user_id = ?', (user_id,))
        c.execute('DELETE FROM notifications WHERE user_id = ?', (user_id,))
        
        # Log the admin action
        details = f"Reset data for user {target_user[1]}: {analyses_count} analyses, {reports_count} reports, {history_count} history entries, {notifications_count} notifications"
        log_admin_action(admin_info['id'], admin_info['email'], 'RESET_USER_DATA_SINGLE', details)
        
        conn.commit()
        conn.close()
        
        logger.info(f"User data reset completed for {target_user[1]} by admin: {admin_info['email']}")
        
        return jsonify({
            'status': 'success',
            'message': f'User data cleared for {target_user[1]}',
            'deleted': {
                'analyses': analyses_count,
                'reports': reports_count,
                'history': history_count,
                'notifications': notifications_count
            }
        })
        
    except Exception as e:
        logger.error(f"Reset user data error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to reset user data: {str(e)}'
        }), 500

@app.route('/api/admin/users/<user_id>', methods=['DELETE'])
def delete_user(user_id):
    """Delete a user (admin only)"""
    try:
        data = request.get_json()
        admin_id = data.get('admin_id')
        
        if not admin_id:
            return jsonify({
                'status': 'error',
                'message': 'admin_id is required'
            }), 400
        
        # Verify admin access
        is_admin, admin_info = verify_admin(admin_id)
        if not is_admin:
            return jsonify({
                'status': 'error',
                'message': 'Admin access required'
            }), 403
        
        # Prevent deleting yourself
        if user_id == admin_id:
            return jsonify({
                'status': 'error',
                'message': 'Cannot delete your own account'
            }), 400
        
        conn = get_db()
        c = conn.cursor()
        
        # Get user info before deletion
        c.execute('SELECT email FROM users WHERE id = ?', (user_id,))
        target_user = c.fetchone()
        
        if not target_user:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'User not found'
            }), 404
        
        # Delete user's data first
        c.execute('DELETE FROM analyses WHERE user_id = ?', (user_id,))
        c.execute('DELETE FROM reports WHERE user_id = ?', (user_id,))
        c.execute('DELETE FROM history WHERE user_id = ?', (user_id,))
        c.execute('DELETE FROM notifications WHERE user_id = ?', (user_id,))
        c.execute('DELETE FROM admin_logs WHERE admin_id = ?', (user_id,))
        
        # Delete user
        c.execute('DELETE FROM users WHERE id = ?', (user_id,))
        
        # Log the admin action
        log_admin_action(admin_info['id'], admin_info['email'], 'DELETE_USER', f"Deleted user: {target_user[0]}")
        
        conn.commit()
        conn.close()
        
        logger.info(f"User {target_user[0]} deleted by admin: {admin_info['email']}")
        
        return jsonify({
            'status': 'success',
            'message': f'User {target_user[0]} deleted successfully'
        })
        
    except Exception as e:
        logger.error(f"Delete user error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to delete user: {str(e)}'
        }), 500

@app.route('/api/admin/reports', methods=['GET'])
def get_all_reports_admin():
    """Get all reports with filters (admin only)"""
    try:
        admin_id = request.args.get('admin_id')
        result_filter = request.args.get('result')  # 'FAKE' or 'REAL'
        user_id_filter = request.args.get('user_id')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        
        if not admin_id:
            return jsonify({
                'status': 'error',
                'message': 'admin_id is required'
            }), 400
        
        # Verify admin access
        is_admin, admin_info = verify_admin(admin_id)
        if not is_admin:
            return jsonify({
                'status': 'error',
                'message': 'Admin access required'
            }), 403
        
        conn = get_db()
        c = conn.cursor()
        
        # Build query with filters
        query = '''
            SELECT 
                r.id,
                r.user_id,
                u.email,
                u.name,
                r.file_name,
                r.prediction,
                r.confidence,
                r.frames_analyzed,
                r.report_url,
                r.model_version,
                r.created_at
            FROM reports r
            JOIN users u ON r.user_id = u.id
            WHERE 1=1
        '''
        params = []
        
        if result_filter:
            query += ' AND r.prediction = ?'
            params.append(result_filter.upper())
        
        if user_id_filter:
            query += ' AND r.user_id = ?'
            params.append(user_id_filter)
        
        if date_from:
            query += ' AND DATE(r.created_at) >= ?'
            params.append(date_from)
        
        if date_to:
            query += ' AND DATE(r.created_at) <= ?'
            params.append(date_to)
        
        query += ' ORDER BY r.created_at DESC'
        
        c.execute(query, params)
        rows = c.fetchall()
        
        # Get statistics
        c.execute('SELECT COUNT(*) FROM reports')
        total_reports = c.fetchone()[0]
        
        c.execute('SELECT COUNT(*) FROM reports WHERE prediction = ?', ('FAKE',))
        fake_reports = c.fetchone()[0]
        
        c.execute('SELECT AVG(confidence) FROM reports')
        avg_confidence = c.fetchone()[0] or 0
        
        c.execute('SELECT MAX(created_at) FROM reports')
        most_recent = c.fetchone()[0]
        
        conn.close()
        
        reports = []
        for row in rows:
            reports.append({
                'id': row[0],
                'user_id': row[1],
                'user_email': row[2],
                'user_name': row[3],
                'file_name': row[4],
                'prediction': row[5],
                'confidence': row[6],
                'frames_analyzed': row[7],
                'report_url': row[8],
                'model_version': row[9],
                'created_at': row[10]
            })
        
        return jsonify({
            'status': 'success',
            'reports': reports,
            'statistics': {
                'total_reports': total_reports,
                'fake_reports': fake_reports,
                'real_reports': total_reports - fake_reports,
                'fake_percentage': (fake_reports / total_reports * 100) if total_reports > 0 else 0,
                'avg_confidence': round(avg_confidence * 100, 2),
                'most_recent': most_recent
            }
        })
        
    except Exception as e:
        logger.error(f"Get reports error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch reports: {str(e)}'
        }), 500

@app.route('/api/admin/reports/<report_id>', methods=['DELETE'])
def delete_report(report_id):
    """Delete a report (admin only)"""
    try:
        data = request.get_json()
        admin_id = data.get('admin_id')
        
        if not admin_id:
            return jsonify({
                'status': 'error',
                'message': 'admin_id is required'
            }), 400
        
        # Verify admin access
        is_admin, admin_info = verify_admin(admin_id)
        if not is_admin:
            return jsonify({
                'status': 'error',
                'message': 'Admin access required'
            }), 403
        
        conn = get_db()
        c = conn.cursor()
        
        # Get report info before deletion
        c.execute('SELECT file_name FROM reports WHERE id = ?', (report_id,))
        report = c.fetchone()
        
        if not report:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Report not found'
            }), 404
        
        # Delete report
        c.execute('DELETE FROM reports WHERE id = ?', (report_id,))
        
        # Log the admin action
        log_admin_action(admin_info['id'], admin_info['email'], 'DELETE_REPORT', f"Deleted report: {report[0]}")
        
        conn.commit()
        conn.close()
        
        logger.info(f"Report {report[0]} deleted by admin: {admin_info['email']}")
        
        return jsonify({
            'status': 'success',
            'message': 'Report deleted successfully'
        })
        
    except Exception as e:
        logger.error(f"Delete report error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to delete report: {str(e)}'
        }), 500

@app.route('/api/profile/<user_id>', methods=['GET'])
def get_user_profile(user_id):
    """Get user profile with statistics"""
    try:
        conn = get_db()
        c = conn.cursor()
        
        # Get user info
        c.execute('SELECT id, email, name, role, created_at FROM users WHERE id = ?', (user_id,))
        user = c.fetchone()
        
        if not user:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'User not found'
            }), 404
        
        # Get statistics
        c.execute('SELECT COUNT(*) FROM analyses WHERE user_id = ?', (user_id,))
        total_analyses = c.fetchone()[0]
        
        c.execute('SELECT COUNT(*) FROM reports WHERE user_id = ?', (user_id,))
        total_reports = c.fetchone()[0]
        
        # Get last login (we'll use last analysis/report timestamp as proxy)
        c.execute('''
            SELECT MAX(created_at) FROM (
                SELECT created_at FROM analyses WHERE user_id = ?
                UNION ALL
                SELECT created_at FROM reports WHERE user_id = ?
            )
        ''', (user_id, user_id))
        last_activity = c.fetchone()[0]
        
        conn.close()
        
        return jsonify({
            'status': 'success',
            'profile': {
                'id': user[0],
                'email': user[1],
                'name': user[2] or user[1].split('@')[0],
                'role': user[3],
                'created_at': user[4],
                'last_login': last_activity or user[4],
                'total_analyses': total_analyses,
                'total_reports': total_reports
            }
        })
        
    except Exception as e:
        logger.error(f"Get profile error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch profile: {str(e)}'
        }), 500

@app.route('/api/profile/<user_id>', methods=['PUT'])
def update_user_profile(user_id):
    """Update user profile (name and/or password)"""
    try:
        data = request.get_json()
        name = data.get('name')
        password = data.get('password')
        current_password = data.get('current_password')
        
        conn = get_db()
        c = conn.cursor()
        
        # Verify user exists
        c.execute('SELECT id, email, password FROM users WHERE id = ?', (user_id,))
        user = c.fetchone()
        
        if not user:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'User not found'
            }), 404
        
        # If password is being updated, verify current password
        if password:
            if not current_password:
                conn.close()
                return jsonify({
                    'status': 'error',
                    'message': 'Current password is required to change password'
                }), 400
            
            if not check_password_hash(user[2], current_password):
                conn.close()
                return jsonify({
                    'status': 'error',
                    'message': 'Current password is incorrect'
                }), 401
            
            # Update password
            hashed_password = generate_password_hash(password)
            c.execute('UPDATE users SET password = ? WHERE id = ?', (hashed_password, user_id))
            logger.info(f"Password updated for user: {user[1]}")
        
        # Update name if provided
        if name:
            c.execute('UPDATE users SET name = ? WHERE id = ?', (name.strip(), user_id))
            logger.info(f"Name updated for user: {user[1]}")
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'message': 'Profile updated successfully'
        })
        
    except Exception as e:
        logger.error(f"Update profile error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to update profile: {str(e)}'
        }), 500

@app.errorhandler(500)
def internal_error(e):
    return jsonify({
        'status': 'error',
        'message': 'Internal server error'
        }), 500

# Support Center API Endpoints

@app.route('/api/support/expert-request', methods=['POST'])
def create_expert_request():
    """Create an expert verification request"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        name = data.get('name')
        email = data.get('email')
        file_reference = data.get('file_reference', '')
        description = data.get('description')
        
        if not user_id or not name or not email or not description:
            return jsonify({
                'status': 'error',
                'message': 'Missing required fields: user_id, name, email, description'
            }), 400
        
        conn = get_db()
        c = conn.cursor()
        request_id = secrets.token_hex(16)
        timestamp_str = datetime.now(pytz.UTC).strftime('%Y-%m-%d %H:%M:%S')
        
        c.execute('''
            INSERT INTO expert_requests (id, user_id, name, email, file_reference, description, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (request_id, user_id, name, email, file_reference, description, 'pending', timestamp_str))
        
        conn.commit()
        conn.close()
        
        logger.info(f"Expert request created: {request_id} by user {user_id}")
        
        return jsonify({
            'status': 'success',
            'message': 'Expert request submitted successfully',
            'request_id': request_id
        })
        
    except Exception as e:
        logger.error(f"Create expert request error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to create expert request: {str(e)}'
        }), 500

@app.route('/api/support/complaint', methods=['POST'])
def create_complaint():
    """Create a complaint"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        name = data.get('name')
        email = data.get('email')
        complaint_type = data.get('type')
        description = data.get('description')
        evidence_file = data.get('evidence_file', '')
        
        if not user_id or not name or not email or not complaint_type or not description:
            return jsonify({
                'status': 'error',
                'message': 'Missing required fields: user_id, name, email, type, description'
            }), 400
        
        conn = get_db()
        c = conn.cursor()
        complaint_id = secrets.token_hex(16)
        timestamp_str = datetime.now(pytz.UTC).strftime('%Y-%m-%d %H:%M:%S')
        
        c.execute('''
            INSERT INTO complaints (id, user_id, name, email, type, description, evidence_file, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (complaint_id, user_id, name, email, complaint_type, description, evidence_file, 'pending', timestamp_str))
        
        conn.commit()
        conn.close()
        
        logger.info(f"Complaint created: {complaint_id} by user {user_id}")
        
        return jsonify({
            'status': 'success',
            'message': 'Complaint submitted successfully',
            'complaint_id': complaint_id
        })
        
    except Exception as e:
        logger.error(f"Create complaint error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to create complaint: {str(e)}'
        }), 500

@app.route('/api/support/track-complaint', methods=['GET'])
def track_complaint():
    """Track a complaint by ID or email"""
    try:
        complaint_id = request.args.get('id')
        email = request.args.get('email')
        
        if not complaint_id and not email:
            return jsonify({
                'status': 'error',
                'message': 'Please provide either complaint ID or email'
            }), 400
        
        conn = get_db()
        c = conn.cursor()
        
        if complaint_id:
            c.execute('''
                SELECT id, user_id, name, email, type, description, status, created_at
                FROM complaints
                WHERE id = ?
            ''', (complaint_id,))
        else:
            c.execute('''
                SELECT id, user_id, name, email, type, description, status, created_at
                FROM complaints
                WHERE email = ?
                ORDER BY created_at DESC
                LIMIT 1
            ''', (email,))
        
        row = c.fetchone()
        conn.close()
        
        if not row:
            return jsonify({
                'status': 'error',
                'message': 'No complaint found with the provided information'
            }), 404
        
        return jsonify({
            'status': 'success',
            'complaint': {
                'id': row[0],
                'user_id': row[1],
                'name': row[2],
                'email': row[3],
                'type': row[4],
                'description': row[5],
                'status': row[6],
                'created_at': row[7]
            }
        })
        
    except Exception as e:
        logger.error(f"Track complaint error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to track complaint: {str(e)}'
        }), 500

@app.route('/api/support/subscribe', methods=['POST'])
def subscribe_newsletter():
    """Subscribe to digital safety newsletter"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        email = data.get('email')
        
        if not email:
            return jsonify({
                'status': 'error',
                'message': 'Email is required'
            }), 400
        
        conn = get_db()
        c = conn.cursor()
        
        # Check if already subscribed
        c.execute('SELECT id FROM subscriptions WHERE email = ? AND is_active = 1', (email,))
        existing = c.fetchone()
        
        if existing:
            conn.close()
            return jsonify({
                'status': 'success',
                'message': 'You are already subscribed to our newsletter'
            })
        
        subscription_id = secrets.token_hex(16)
        timestamp_str = datetime.now(pytz.UTC).strftime('%Y-%m-%d %H:%M:%S')
        
        c.execute('''
            INSERT INTO subscriptions (id, user_id, email, subscribed_at, is_active)
            VALUES (?, ?, ?, ?, ?)
        ''', (subscription_id, user_id, email, timestamp_str, 1))
        
        conn.commit()
        conn.close()
        
        logger.info(f"Newsletter subscription: {email}")
        
        return jsonify({
            'status': 'success',
            'message': 'Successfully subscribed to digital safety newsletter'
        })
        
    except Exception as e:
        logger.error(f"Subscribe newsletter error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to subscribe: {str(e)}'
        }), 500

@app.route('/api/support/daily-tips', methods=['GET'])
def get_daily_tips():
    """Get active daily safety tips"""
    try:
        conn = get_db()
        c = conn.cursor()
        
        c.execute('''
            SELECT id, tip_text, category
            FROM daily_tips
            WHERE is_active = 1
            ORDER BY created_at DESC
        ''')
        
        rows = c.fetchall()
        conn.close()
        
        tips = [{
            'id': row[0],
            'text': row[1],
            'category': row[2]
        } for row in rows]
        
        return jsonify({
            'status': 'success',
            'tips': tips
        })
        
    except Exception as e:
        logger.error(f"Get daily tips error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch tips: {str(e)}'
        }), 500

@app.route('/api/blogs', methods=['GET'])
def get_blogs():
    """Get all blogs, sorted by date DESC"""
    try:
        conn = get_db()
        c = conn.cursor()
        
        c.execute('''
            SELECT id, title, content, image_url, author, date, created_at
            FROM blogs
            ORDER BY date DESC, created_at DESC
        ''')
        
        rows = c.fetchall()
        conn.close()
        
        blogs = [{
            'id': row[0],
            'title': row[1],
            'content': row[2],
            'image_url': row[3],
            'author': row[4],
            'date': row[5],
            'created_at': row[6]
        } for row in rows]
        
        return jsonify({
            'status': 'success',
            'blogs': blogs
        })
        
    except Exception as e:
        logger.error(f"Get blogs error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch blogs: {str(e)}'
        }), 500

@app.route('/api/blogs/<blog_id>', methods=['GET'])
def get_blog(blog_id):
    """Get a single blog by ID"""
    try:
        conn = get_db()
        c = conn.cursor()
        
        c.execute('''
            SELECT id, title, content, image_url, author, date, created_at
            FROM blogs
            WHERE id = ?
        ''', (blog_id,))
        
        row = c.fetchone()
        conn.close()
        
        if not row:
            return jsonify({
                'status': 'error',
                'message': 'Blog not found'
            }), 404
        
        blog = {
            'id': row[0],
            'title': row[1],
            'content': row[2],
            'image_url': row[3],
            'author': row[4],
            'date': row[5],
            'created_at': row[6]
        }
        
        return jsonify({
            'status': 'success',
            'blog': blog
        })
        
    except Exception as e:
        logger.error(f"Get blog error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch blog: {str(e)}'
        }), 500

# Forum API Endpoints

@app.route('/api/forum/posts', methods=['GET'])
def get_forum_posts():
    """Get all forum posts with optional search and filter"""
    try:
        search_query = request.args.get('search', '').strip()
        topic_filter = request.args.get('topic', '').strip()
        
        conn = get_db()
        c = conn.cursor()
        
        # Build query with filters
        query = '''
            SELECT id, user_id, username, topic, content, likes, created_at
            FROM forum_posts
            WHERE 1=1
        '''
        params = []
        
        if search_query:
            query += ' AND (content LIKE ? OR username LIKE ?)'
            search_pattern = f'%{search_query}%'
            params.extend([search_pattern, search_pattern])
        
        if topic_filter:
            query += ' AND topic = ?'
            params.append(topic_filter)
        
        query += ' ORDER BY created_at DESC'
        
        c.execute(query, params)
        rows = c.fetchall()
        
        # Get comments count for each post
        posts = []
        for row in rows:
            post_id = row[0]
            c.execute('SELECT COUNT(*) FROM forum_comments WHERE post_id = ?', (post_id,))
            comments_count = c.fetchone()[0]
            
            posts.append({
                'id': row[0],
                'user_id': row[1],
                'username': row[2],
                'topic': row[3],
                'content': row[4],
                'likes': row[5],
                'created_at': row[6],
                'comments_count': comments_count
            })
        
        conn.close()
        
        return jsonify({
            'status': 'success',
            'posts': posts
        })
        
    except Exception as e:
        logger.error(f"Get forum posts error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch posts: {str(e)}'
        }), 500

@app.route('/api/forum/posts', methods=['POST'])
def create_forum_post():
    """Create a new forum post"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        topic = data.get('topic')
        content = data.get('content', '').strip()
        
        if not user_id or not topic or not content:
            return jsonify({
                'status': 'error',
                'message': 'Missing required fields: user_id, topic, content'
            }), 400
        
        if len(content) == 0:
            return jsonify({
                'status': 'error',
                'message': 'Please enter something before posting.'
            }), 400
        
        # Verify user exists and get username
        conn = get_db()
        c = conn.cursor()
        c.execute('SELECT id, email, name FROM users WHERE id = ?', (user_id,))
        user = c.fetchone()
        
        if not user:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'User not found'
            }), 404
        
        username = user[2] or user[1].split('@')[0]
        
        # Get current time in IST
        ist = pytz.timezone('Asia/Kolkata')
        current_time = datetime.now(ist)
        timestamp_str = current_time.strftime('%Y-%m-%d %H:%M:%S')
        
        # Create post
        post_id = secrets.token_hex(16)
        c.execute('''
            INSERT INTO forum_posts (id, user_id, username, topic, content, likes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (post_id, user_id, username, topic, content, 0, timestamp_str))
        
        conn.commit()
        conn.close()
        
        logger.info(f"Forum post created: {post_id} by user {user_id}")
        
        return jsonify({
            'status': 'success',
            'message': 'Post created successfully',
            'post_id': post_id
        })
        
    except Exception as e:
        logger.error(f"Create forum post error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to create post: {str(e)}'
        }), 500

@app.route('/api/forum/posts/<post_id>/like', methods=['PUT'])
def like_forum_post(post_id):
    """Like a forum post"""
    try:
        conn = get_db()
        c = conn.cursor()
        
        # Check if post exists
        c.execute('SELECT id, likes FROM forum_posts WHERE id = ?', (post_id,))
        post = c.fetchone()
        
        if not post:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Post not found'
            }), 404
        
        # Increment likes
        new_likes = post[1] + 1
        c.execute('UPDATE forum_posts SET likes = ? WHERE id = ?', (new_likes, post_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'message': 'Post liked successfully',
            'likes': new_likes
        })
        
    except Exception as e:
        logger.error(f"Like forum post error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to like post: {str(e)}'
        }), 500

@app.route('/api/forum/posts/<post_id>', methods=['DELETE'])
def delete_forum_post(post_id):
    """Delete a forum post (admin only or post owner)"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({
                'status': 'error',
                'message': 'user_id is required'
            }), 400
        
        conn = get_db()
        c = conn.cursor()
        
        # Check if post exists and get owner
        c.execute('SELECT user_id FROM forum_posts WHERE id = ?', (post_id,))
        post = c.fetchone()
        
        if not post:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Post not found'
            }), 404
        
        # Check if user is admin or post owner
        c.execute('SELECT role FROM users WHERE id = ?', (user_id,))
        user = c.fetchone()
        
        if not user:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'User not found'
            }), 404
        
        is_admin = user[0] == 'admin'
        is_owner = post[0] == user_id
        
        if not (is_admin or is_owner):
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Unauthorized: Only admin or post owner can delete'
            }), 403
        
        # Delete post (comments will be deleted via CASCADE)
        c.execute('DELETE FROM forum_posts WHERE id = ?', (post_id,))
        
        if is_admin:
            # Log admin action
            c.execute('SELECT email FROM users WHERE id = ?', (user_id,))
            admin_email = c.fetchone()[0]
            log_admin_action(user_id, admin_email, 'DELETE_FORUM_POST', f"Deleted post: {post_id}")
        
        conn.commit()
        conn.close()
        
        logger.info(f"Forum post deleted: {post_id} by user {user_id}")
        
        return jsonify({
            'status': 'success',
            'message': 'Post deleted successfully'
        })
        
    except Exception as e:
        logger.error(f"Delete forum post error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to delete post: {str(e)}'
        }), 500

@app.route('/api/forum/posts/<post_id>/comments', methods=['GET'])
def get_forum_comments(post_id):
    """Get all comments for a forum post"""
    try:
        conn = get_db()
        c = conn.cursor()
        
        c.execute('''
            SELECT id, user_id, username, content, created_at
            FROM forum_comments
            WHERE post_id = ?
            ORDER BY created_at ASC
        ''', (post_id,))
        
        rows = c.fetchall()
        conn.close()
        
        comments = [{
            'id': row[0],
            'user_id': row[1],
            'username': row[2],
            'content': row[3],
            'created_at': row[4]
        } for row in rows]
        
        return jsonify({
            'status': 'success',
            'comments': comments
        })
        
    except Exception as e:
        logger.error(f"Get forum comments error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch comments: {str(e)}'
        }), 500

@app.route('/api/forum/posts/<post_id>/comments', methods=['POST'])
def create_forum_comment(post_id):
    """Create a new comment on a forum post"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        content = data.get('content', '').strip()
        
        if not user_id or not content:
            return jsonify({
                'status': 'error',
                'message': 'Missing required fields: user_id, content'
            }), 400
        
        if len(content) == 0:
            return jsonify({
                'status': 'error',
                'message': 'Please enter something before commenting.'
            }), 400
        
        # Verify user exists and get username
        conn = get_db()
        c = conn.cursor()
        
        # Check if post exists
        c.execute('SELECT id FROM forum_posts WHERE id = ?', (post_id,))
        post = c.fetchone()
        
        if not post:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Post not found'
            }), 404
        
        # Get user info
        c.execute('SELECT id, email, name FROM users WHERE id = ?', (user_id,))
        user = c.fetchone()
        
        if not user:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'User not found'
            }), 404
        
        username = user[2] or user[1].split('@')[0]
        
        # Get current time in IST
        ist = pytz.timezone('Asia/Kolkata')
        current_time = datetime.now(ist)
        timestamp_str = current_time.strftime('%Y-%m-%d %H:%M:%S')
        
        # Create comment
        comment_id = secrets.token_hex(16)
        c.execute('''
            INSERT INTO forum_comments (id, post_id, user_id, username, content, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (comment_id, post_id, user_id, username, content, timestamp_str))
        
        conn.commit()
        conn.close()
        
        logger.info(f"Forum comment created: {comment_id} on post {post_id} by user {user_id}")
        
        return jsonify({
            'status': 'success',
            'message': 'Comment added successfully',
            'comment_id': comment_id
        })
        
    except Exception as e:
        logger.error(f"Create forum comment error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to create comment: {str(e)}'
        }), 500

@app.route('/api/forum/comments/<comment_id>', methods=['DELETE'])
def delete_forum_comment(comment_id):
    """Delete a forum comment (admin only or comment owner)"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({
                'status': 'error',
                'message': 'user_id is required'
            }), 400
        
        conn = get_db()
        c = conn.cursor()
        
        # Check if comment exists and get owner
        c.execute('SELECT user_id FROM forum_comments WHERE id = ?', (comment_id,))
        comment = c.fetchone()
        
        if not comment:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Comment not found'
            }), 404
        
        # Check if user is admin or comment owner
        c.execute('SELECT role FROM users WHERE id = ?', (user_id,))
        user = c.fetchone()
        
        if not user:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'User not found'
            }), 404
        
        is_admin = user[0] == 'admin'
        is_owner = comment[0] == user_id
        
        if not (is_admin or is_owner):
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Unauthorized: Only admin or comment owner can delete'
            }), 403
        
        # Delete comment
        c.execute('DELETE FROM forum_comments WHERE id = ?', (comment_id,))
        
        if is_admin:
            # Log admin action
            c.execute('SELECT email FROM users WHERE id = ?', (user_id,))
            admin_email = c.fetchone()[0]
            log_admin_action(user_id, admin_email, 'DELETE_FORUM_COMMENT', f"Deleted comment: {comment_id}")
        
        conn.commit()
        conn.close()
        
        logger.info(f"Forum comment deleted: {comment_id} by user {user_id}")
        
        return jsonify({
            'status': 'success',
            'message': 'Comment deleted successfully'
        })
        
    except Exception as e:
        logger.error(f"Delete forum comment error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to delete comment: {str(e)}'
        }), 500

if __name__ == '__main__':
    # Try to load existing model
    if os.path.exists(MODEL_PATH):
        try:
            detector.load_model(MODEL_PATH)
            logger.info("Pre-trained model loaded successfully")
        except Exception as e:
            logger.warning(f"Failed to load pre-trained model: {e}")
    
    # Start Flask server
    app.run(host='0.0.0.0', port=5000, debug=True)
