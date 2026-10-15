# __init__.py

from flask import Flask
from app.extensions import db
from flask_migrate import Migrate


def create_app():
    app = Flask(__name__)

    # Load configuration
    app.config.from_object("app.config")
    db.init_app(app)
    Migrate(app, db)

    from app.models.user import User

    # Register blueprints
    from app.auth.routes import auth_bp
    from app.routes.tasks import tasks_bp
    from app.routes.users import users_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(tasks_bp, url_prefix="/api")
    app.register_blueprint(users_bp, url_prefix="/api")

    return app