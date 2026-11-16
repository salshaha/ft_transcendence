from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate

from app.extensions import db


def create_app():
    app = Flask(__name__)
    app.config.from_object("app.config")

    CORS(
        app,
        resources={
            r"/api/*": {"origins": [app.config["FRONTEND_ORIGIN"]]},
        },
        supports_credentials=True,
    )

    db.init_app(app)
    Migrate(app, db)

    from app.models.user import User  # noqa: F401
    from app.auth.routes import auth_bp
    from app.routes.instructor import instructor_bp
    from app.routes.student import student_bp
    from app.routes.tasks import tasks_bp
    from app.routes.users import users_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(instructor_bp, url_prefix="/api/instructor")
    app.register_blueprint(student_bp, url_prefix="/api/student")
    app.register_blueprint(tasks_bp, url_prefix="/api")
    app.register_blueprint(users_bp, url_prefix="/api")

    return app
