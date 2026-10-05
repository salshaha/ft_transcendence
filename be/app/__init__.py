# __init__.py

from flask import Flask

def create_app():
    app = Flask(__name__)

    # Load configuration
    app.config.from_object("app.config")

    # Register blueprints
    from app.auth.routes import auth_bp
    from app.routes.tasks import tasks_bp
    from app.routes.users import users_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(tasks_bp, url_prefix="/api")
    app.register_blueprint(users_bp, url_prefix="/api")

    return app