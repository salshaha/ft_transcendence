from flask import Flask, jsonify
from flask_cors import CORS
from flask_migrate import Migrate

from app.extensions import db


def create_app():
    app = Flask(__name__)
    app.config.from_object("app.config")

    CORS(
        app,
        resources={
            r"/api/*": {"origins": app.config["FRONTEND_ORIGINS"]},
            r"/auth/*": {"origins": app.config["FRONTEND_ORIGINS"]},
        },
        supports_credentials=True,
    )

    db.init_app(app)
    Migrate(app, db)

    # Import every model before registering blueprints so both Alembic and
    # the application metadata see the complete schema.
    from app import models  # noqa: F401
    from app.auth.routes import auth_bp, microsoft_bp
    from app.cli import register_cli
    from app.routes.admin import admin_bp
    from app.routes.instructor import instructor_bp
    from app.routes.presence import presence_bp
    from app.routes.student import student_bp
    from app.routes.students import students_bp
    from app.routes.task_collaboration import task_collaboration_bp
    from app.routes.tasks import tasks_bp
    from app.routes.users import users_bp
    from app.realtime import init_realtime
    from app.security.csrf import init_csrf
    from app.services.storage import init_storage

    init_csrf(app)
    init_storage(app)
    init_realtime(app)
    register_cli(app)

    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(microsoft_bp, url_prefix="/auth", name="microsoft_auth_root")
    app.register_blueprint(microsoft_bp, url_prefix="/api/auth", name="microsoft_auth_api")
    app.register_blueprint(instructor_bp, url_prefix="/api/instructor")
    app.register_blueprint(presence_bp, url_prefix="/api/presence")
    app.register_blueprint(student_bp, url_prefix="/api/student")
    app.register_blueprint(students_bp, url_prefix="/api/students")
    app.register_blueprint(task_collaboration_bp, url_prefix="/api")
    app.register_blueprint(tasks_bp, url_prefix="/api")
    app.register_blueprint(users_bp, url_prefix="/api")

    @app.errorhandler(413)
    def request_too_large(_error):
        return jsonify({
            "message": "The uploaded file is larger than the server limit"
        }), 413

    return app
