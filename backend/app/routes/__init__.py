from app.routes.auth import auth_bp
from app.routes.cellar import cellar_bp
from app.routes.health import health_bp
from app.routes.wines import wines_bp

__all__ = ["auth_bp", "cellar_bp", "health_bp", "wines_bp"]
