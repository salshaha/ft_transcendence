from flask_socketio import SocketIO
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import BigInteger
from sqlalchemy.ext.compiler import compiles

db = SQLAlchemy()
socketio = SocketIO()


@compiles(BigInteger, "sqlite")
def _sqlite_big_integer(type_, compiler, **kwargs):
    return "INTEGER"
